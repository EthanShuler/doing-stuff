import { useCallback, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ParkVisit, Profile } from '../../types'
import { supabase } from '../../lib/supabase'
import {
  PROFILE_COLUMNS,
  idFactory,
  syncTable,
  toProfile,
  upsertById,
  useSpaceSync,
} from '../../data/spaceSync'
import type { ProfileRow } from '../../data/spaceSync'

// Data seam for the parks tracker, mirroring the other stores' two modes:
//   • Supabase keys present → live: reads/writes `park_visits` scoped to the
//     space (shared data — uniform space-member RLS). Also reads profiles and
//     the ordered membership: person-fixed pin colors are assigned by join
//     order, so the store must know who joined first.
//   • No keys → in-memory seed so the UI can be developed offline.
//
// The parks themselves are static in-repo data (parks.ts) — only visits sync.

interface Snapshot {
  visits: ParkVisit[]
  profiles: Profile[]
  /** Space member ids in join order (first = the space's creator). */
  memberIds: string[]
}

// Seed viewer: keyless mode has no auth user (matches the other seeds).
const SEED_SELF_ID = 'u1'

function seed(): Snapshot {
  return {
    profiles: [
      { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
      { id: 'u2', email: 'jordan@example.com', displayName: 'Jordan' },
    ],
    memberIds: ['u1', 'u2'],
    // Exercises every status the UI derives: a repeat park (Yosemite twice,
    // once together), solo parks for each member, an undated childhood visit,
    // a both-but-separately park (Great Smokies), and off-continental pins
    // (Hawaii + Alaska).
    visits: [
      { id: 'v1', parkCode: 'yose', date: '2023-08-14', notes: 'Half Dome permits next time.', attendeeIds: ['u1', 'u2'], separate: false, createdBy: 'u1', createdAt: '2023-08-15T09:00:00Z' },
      { id: 'v2', parkCode: 'yose', date: '2019-06-02', notes: '', attendeeIds: ['u1'], separate: false, createdBy: 'u1', createdAt: '2019-06-03T09:00:00Z' },
      { id: 'v3', parkCode: 'zion', date: '2024-04-20', notes: 'The Narrows!', attendeeIds: ['u1', 'u2'], separate: false, createdBy: 'u2', createdAt: '2024-04-21T09:00:00Z' },
      { id: 'v4', parkCode: 'acad', date: '2022-10-08', notes: 'Peak foliage.', attendeeIds: ['u2'], separate: false, createdBy: 'u2', createdAt: '2022-10-09T09:00:00Z' },
      { id: 'v5', parkCode: 'grca', date: null, notes: 'Family trip as a kid — no idea when.', attendeeIds: ['u1'], separate: false, createdBy: 'u1', createdAt: '2026-01-05T09:00:00Z' },
      { id: 'v6', parkCode: 'hale', date: '2025-02-11', notes: 'Sunrise at the summit.', attendeeIds: ['u1', 'u2'], separate: false, createdBy: 'u1', createdAt: '2025-02-12T09:00:00Z' },
      { id: 'v7', parkCode: 'dena', date: '2018-07-30', notes: '', attendeeIds: ['u2'], separate: false, createdBy: 'u2', createdAt: '2018-07-31T09:00:00Z' },
      { id: 'v8', parkCode: 'grsm', date: null, notes: 'Both went as kids — decades apart.', attendeeIds: ['u1', 'u2'], separate: true, createdBy: 'u1', createdAt: '2026-02-01T09:00:00Z' },
    ],
  }
}

// --- Row → app-type mapper (DB is snake_case) ---

type VisitRow = {
  id: string
  park_code: string
  visited_on: string | null
  notes: string | null
  attendee_ids: string[] | null
  separate: boolean | null
  created_by: string | null
  created_at: string
}

const toVisit = (r: VisitRow): ParkVisit => ({
  id: r.id,
  parkCode: r.park_code,
  date: r.visited_on,
  notes: r.notes ?? '',
  attendeeIds: r.attendee_ids ?? [],
  separate: r.separate ?? false,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const VISIT_COLUMNS = 'id,park_code,visited_on,notes,attendee_ids,separate,created_by,created_at'

// In-memory fallback only: stable client ids for seed-mode edits.
const nextId = idFactory('vx', 100)

/** The fields the visit form writes. `date` is '' for "sometime, long ago";
 *  `separate` is the "we've both been, but on different trips" shorthand and
 *  only means anything with more than one attendee. */
export interface VisitDraft {
  parkCode: string
  date: string
  notes: string
  attendeeIds: string[]
  separate: boolean
}

export interface ParkStore {
  visits: ParkVisit[]
  profiles: Profile[]
  /** Space member ids in join order — drives the person-fixed colors. */
  memberIds: string[]
  /** The signed-in member (or the seed viewer in keyless mode). */
  selfId: string | null
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Log a trip. Throws on failure (the modal stays open; error has the reason). */
  addVisit: (draft: VisitDraft) => Promise<void>
  /** Edit a trip. Throws on failure. */
  updateVisit: (id: string, draft: VisitDraft) => Promise<void>
  /** Delete a trip. Throws on failure. */
  deleteVisit: (id: string) => Promise<void>
}

export function useParkStore(spaceId: string | null, userId: string | null): ParkStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [visits, setVisits] = useState<ParkVisit[]>(initial?.visits ?? [])
  const [profiles, setProfiles] = useState<Profile[]>(initial?.profiles ?? [])
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  const selfId = supabase ? userId : SEED_SELF_ID

  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [visitRes, profileRes, memberRes] = await Promise.all([
      supabase.from('park_visits').select(VISIT_COLUMNS).eq('space_id', spaceId).order('created_at'),
      supabase.from('profiles').select(PROFILE_COLUMNS),
      supabase
        .from('space_members')
        .select('user_id,created_at')
        .eq('space_id', spaceId)
        .order('created_at'),
    ])
    const err = visitRes.error ?? profileRes.error ?? memberRes.error
    if (err) throw err
    return {
      visits: (visitRes.data as VisitRow[]).map(toVisit),
      profiles: (profileRes.data as ProfileRow[]).map(toProfile),
      memberIds: (memberRes.data as { user_id: string }[]).map((m) => m.user_id),
    }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setVisits(snap.visits)
    setProfiles(snap.profiles)
    setMemberIds(snap.memberIds)
  }, [])

  // Only visits stream — profiles and membership change rarely (and a rejoin
  // refetches the full snapshot anyway).
  const wire = useCallback(
    (channel: RealtimeChannel, spaceFilter: string) =>
      syncTable(channel, spaceFilter, 'park_visits', toVisit, setVisits),
    [],
  )

  useSpaceSync({
    spaceId,
    channelPrefix: 'parks',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  const addVisit = useCallback(
    async (draft: VisitDraft) => {
      if (!draft.parkCode || draft.attendeeIds.length === 0) return
      setError(null)
      const fields = {
        parkCode: draft.parkCode,
        date: draft.date || null,
        notes: draft.notes.trim(),
        attendeeIds: draft.attendeeIds,
        // The flag is meaningless on a solo trip — never persist it there.
        separate: draft.attendeeIds.length > 1 && draft.separate,
      }
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('park_visits')
          .insert({
            space_id: spaceId,
            park_code: fields.parkCode,
            visited_on: fields.date,
            notes: fields.notes,
            attendee_ids: fields.attendeeIds,
            separate: fields.separate,
          })
          .select(VISIT_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const created = toVisit(data as VisitRow)
        upsertById(setVisits, created)
        return
      }
      setVisits((prev) => [
        ...prev,
        { id: nextId(), ...fields, createdBy: selfId, createdAt: new Date().toISOString() },
      ])
    },
    [spaceId, selfId],
  )

  const updateVisit = useCallback(
    async (id: string, draft: VisitDraft) => {
      if (!draft.parkCode || draft.attendeeIds.length === 0) return
      setError(null)
      const fields = {
        parkCode: draft.parkCode,
        date: draft.date || null,
        notes: draft.notes.trim(),
        attendeeIds: draft.attendeeIds,
        separate: draft.attendeeIds.length > 1 && draft.separate,
      }
      if (supabase && spaceId) {
        const { error: err } = await supabase
          .from('park_visits')
          .update({
            park_code: fields.parkCode,
            visited_on: fields.date,
            notes: fields.notes,
            attendee_ids: fields.attendeeIds,
            separate: fields.separate,
          })
          .eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setVisits((prev) => (prev.map((v) => (v.id === id ? { ...v, ...fields } : v))))
    },
    [spaceId],
  )

  const deleteVisit = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('park_visits').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setVisits((prev) => prev.filter((v) => v.id !== id))
    },
    [spaceId],
  )

  return {
    visits,
    profiles,
    memberIds,
    selfId,
    loading,
    error,
    clearError,
    addVisit,
    updateVisit,
    deleteVisit,
  }
}
