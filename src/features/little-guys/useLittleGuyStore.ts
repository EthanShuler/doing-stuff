import { useCallback, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { LittleGuy, Profile } from '../../types'
import { supabase } from '../../lib/supabase'
import {
  PROFILE_COLUMNS,
  SEED_PROFILES,
  SEED_SELF_ID,
  errorMessage,
  idFactory,
  syncTable,
  toProfile,
  upsertById,
  useSpaceSync,
} from '../../data/spaceSync'
import type { ProfileRow } from '../../data/spaceSync'
import { removeLittleGuyPhoto, uploadLittleGuyPhoto } from './photos'

// Data seam for the little guy collection, mirroring the other stores' two modes:
//   • Supabase keys present → live: reads/writes the `little_guys` table scoped
//     to the space (shared data — uniform space-member RLS). Also reads profiles
//     and the ordered membership, since each guy has an owner to name.
//   • No keys → in-memory seed so the UI can be developed offline.
//
// Photos ride along as public-bucket URLs (see photos.ts); the store uploads on
// demand and best-effort deletes orphaned objects when a guy or his photo goes
// away.

interface Snapshot {
  guys: LittleGuy[]
  profiles: Profile[]
  /** Space member ids in join order — the owner picker / pill order. */
  memberIds: string[]
}

function seed(): Snapshot {
  // Exercises every state the UI derives: owned by each member, an ownerless
  // guy (so the "Nobody in particular" pill appears), and a bare guy with no
  // source or personality yet.
  return {
    profiles: SEED_PROFILES,
    memberIds: ['u1', 'u2'],
    guys: [
      { id: 'g1', name: 'Peeker', imageUrl: '', source: 'Meg, for my birthday', ownerId: 'u1', personality: 'nosy', description: 'Hangs off the edge of the shelf watching everything.', createdBy: 'u1', createdAt: '2026-03-04T09:00:00Z' },
      { id: 'g2', name: 'Sleepy Steve', imageUrl: '', source: 'Kinokuniya, Seattle', ownerId: 'u1', personality: 'extremely tired', description: 'Face-down on the desk. Relatable.', createdBy: 'u1', createdAt: '2026-04-12T09:00:00Z' },
      { id: 'g3', name: 'Bartholomew', imageUrl: '', source: 'gift shop in Kyoto', ownerId: 'u2', personality: 'a menace', description: 'Keeps getting into the plant.', createdBy: 'u2', createdAt: '2026-02-20T09:00:00Z' },
      { id: 'g4', name: 'Little Chef', imageUrl: '', source: 'Squabby', ownerId: 'u2', personality: 'ambitious', description: 'Lives on the kitchen windowsill, supervising.', createdBy: 'u1', createdAt: '2026-05-30T09:00:00Z' },
      { id: 'g5', name: 'Desk Guy', imageUrl: '', source: '', ownerId: null, personality: '', description: 'Communal property. Nobody remembers where he came from.', createdBy: 'u2', createdAt: '2026-01-08T09:00:00Z' },
    ],
  }
}

// --- Row → app-type mapper (DB is snake_case) ---

type LittleGuyRow = {
  id: string
  name: string
  image_url: string | null
  source: string | null
  owner_id: string | null
  personality: string | null
  description: string | null
  created_by: string | null
  created_at: string
}

const toLittleGuy = (r: LittleGuyRow): LittleGuy => ({
  id: r.id,
  name: r.name,
  imageUrl: r.image_url ?? '',
  source: r.source ?? '',
  ownerId: r.owner_id,
  personality: r.personality ?? '',
  description: r.description ?? '',
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const LITTLE_GUY_COLUMNS = 'id,name,image_url,source,owner_id,personality,description,created_by,created_at'

// In-memory fallback only: stable client ids for seed-mode edits.
const nextId = idFactory('gx', 100)

/** The fields the add/edit modal writes. `ownerId` is null for "nobody in
 *  particular". */
export interface LittleGuyDraft {
  name: string
  imageUrl: string
  source: string
  ownerId: string | null
  personality: string
  description: string
}

export interface LittleGuyStore {
  guys: LittleGuy[]
  profiles: Profile[]
  /** Space member ids in join order — drives the owner picker and pills. */
  memberIds: string[]
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Downscale + upload a photo, returning its public URL for the draft.
   *  Throws on failure (the modal shows the reason and keeps its old image). */
  uploadPhoto: (file: File) => Promise<string>
  /** Add a little guy. Throws on failure (modal stays open). */
  addLittleGuy: (draft: LittleGuyDraft) => Promise<void>
  /** Edit a little guy. Throws on failure. */
  updateLittleGuy: (id: string, draft: LittleGuyDraft) => Promise<void>
  /** Delete a little guy (and best-effort his uploaded photo). Throws on failure. */
  deleteLittleGuy: (id: string) => Promise<void>
}

const draftFields = (draft: LittleGuyDraft) => ({
  name: draft.name.trim(),
  imageUrl: draft.imageUrl.trim(),
  source: draft.source.trim(),
  ownerId: draft.ownerId,
  personality: draft.personality.trim(),
  description: draft.description.trim(),
})

export function useLittleGuyStore(spaceId: string | null): LittleGuyStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [guys, setGuys] = useState<LittleGuy[]>(initial?.guys ?? [])
  const [profiles, setProfiles] = useState<Profile[]>(initial?.profiles ?? [])
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  // Latest guys, read by update/delete to find the prior photo without
  // re-creating their callbacks on every change.
  const guysRef = useRef(guys)
  guysRef.current = guys

  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [guyRes, profileRes, memberRes] = await Promise.all([
      supabase.from('little_guys').select(LITTLE_GUY_COLUMNS).eq('space_id', spaceId).order('created_at'),
      supabase.from('profiles').select(PROFILE_COLUMNS),
      supabase.from('space_members').select('user_id,created_at').eq('space_id', spaceId).order('created_at'),
    ])
    const err = guyRes.error ?? profileRes.error ?? memberRes.error
    if (err) throw err
    return {
      guys: (guyRes.data as LittleGuyRow[]).map(toLittleGuy),
      profiles: (profileRes.data as ProfileRow[]).map(toProfile),
      memberIds: (memberRes.data as { user_id: string }[]).map((m) => m.user_id),
    }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setGuys(snap.guys)
    setProfiles(snap.profiles)
    setMemberIds(snap.memberIds)
  }, [])

  // Only the guys stream — profiles and membership change rarely (and a rejoin
  // refetches the full snapshot anyway).
  const wire = useCallback(
    (channel: RealtimeChannel, spaceFilter: string) =>
      syncTable(channel, spaceFilter, 'little_guys', toLittleGuy, setGuys),
    [],
  )

  useSpaceSync({
    spaceId,
    channelPrefix: 'little-guys',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  const uploadPhoto = useCallback(
    async (file: File) => {
      setError(null)
      try {
        return await uploadLittleGuyPhoto(spaceId, file)
      } catch (err) {
        setError(errorMessage(err))
        throw err
      }
    },
    [spaceId],
  )

  const addLittleGuy = useCallback(
    async (draft: LittleGuyDraft) => {
      const fields = draftFields(draft)
      if (!fields.name) return
      setError(null)
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('little_guys')
          .insert({
            space_id: spaceId,
            name: fields.name,
            image_url: fields.imageUrl,
            source: fields.source,
            owner_id: fields.ownerId,
            personality: fields.personality,
            description: fields.description,
          })
          .select(LITTLE_GUY_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const created = toLittleGuy(data as LittleGuyRow)
        upsertById(setGuys, created)
        return
      }
      setGuys((prev) => [
        ...prev,
        { id: nextId(), ...fields, createdBy: SEED_SELF_ID, createdAt: new Date().toISOString() },
      ])
    },
    [spaceId],
  )

  const updateLittleGuy = useCallback(
    async (id: string, draft: LittleGuyDraft) => {
      const fields = draftFields(draft)
      if (!fields.name) return
      setError(null)
      const prior = guysRef.current.find((g) => g.id === id)
      if (supabase && spaceId) {
        const { error: err } = await supabase
          .from('little_guys')
          .update({
            name: fields.name,
            image_url: fields.imageUrl,
            source: fields.source,
            owner_id: fields.ownerId,
            personality: fields.personality,
            description: fields.description,
          })
          .eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      // The old photo is unreachable once the row points elsewhere.
      if (prior && prior.imageUrl && prior.imageUrl !== fields.imageUrl) {
        removeLittleGuyPhoto(prior.imageUrl)
      }
      setGuys((prev) => prev.map((g) => (g.id === id ? { ...g, ...fields } : g)))
    },
    [spaceId],
  )

  const deleteLittleGuy = useCallback(
    async (id: string) => {
      setError(null)
      const prior = guysRef.current.find((g) => g.id === id)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('little_guys').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      if (prior?.imageUrl) removeLittleGuyPhoto(prior.imageUrl)
      setGuys((prev) => prev.filter((g) => g.id !== id))
    },
    [spaceId],
  )

  return {
    guys,
    profiles,
    memberIds,
    loading,
    error,
    clearError,
    uploadPhoto,
    addLittleGuy,
    updateLittleGuy,
    deleteLittleGuy,
  }
}
