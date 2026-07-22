import { useCallback, useEffect, useRef, useState } from 'react'
import type { PracticeDay } from '../../types'
import { supabase } from '../../lib/supabase'
import { errorMessage, idFactory, SEED_SELF_ID } from '../../data/spaceSync'
import { isoDate, today } from '../../lib/format'

// Data seam for the Bassoon circle-of-fifths daily key, mirroring the other
// stores' two modes but deliberately lighter:
//   • Supabase keys present → live: reads/writes `music_practice_days` scoped
//     to the space AND this user (personal data — split RLS like placements).
//   • No keys → in-memory seed so the wheel works offline.
//
// No realtime channel (unlike the shared-data stores): this is solo,
// rarely-simultaneous state, so another device just picks up the latest on its
// next load. One row per calendar day; picking again overwrites that day.

type PracticeDayRow = {
  id: string
  practice_date: string
  position: number
  tempo: number | null
  user_id: string
  created_at: string
}

// The row's owner (user_id) is its "who" — mapped onto PracticeDay.createdBy.
const toPracticeDay = (r: PracticeDayRow): PracticeDay => ({
  id: r.id,
  date: r.practice_date,
  position: r.position,
  tempo: r.tempo,
  createdBy: r.user_id,
  createdAt: r.created_at,
})

const DAY_COLUMNS = 'id,practice_date,position,tempo,user_id,created_at'

// In-memory fallback only: stable client ids for seed-mode edits.
const nextId = idFactory('mpd', 100)

/** ISO date `n` days before today, in local time (seed data only). */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function seed(): PracticeDay[] {
  // A couple of recent days so the wheel opens with a carry-forward hint and a
  // "last practiced" line, but today itself is unset (you pick it).
  return [
    { id: 'mpd1', date: daysAgo(3), position: 0, tempo: 60, createdBy: SEED_SELF_ID, createdAt: `${daysAgo(3)}T09:00:00Z` },
    { id: 'mpd2', date: daysAgo(1), position: 1, tempo: 72, createdBy: SEED_SELF_ID, createdAt: `${daysAgo(1)}T09:00:00Z` },
  ]
}

export interface BassoonStore {
  days: PracticeDay[]
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void
  /** Log (or overwrite) today's practice: a circle position + optional tempo
   *  (BPM, or null). Records the error without throwing — the UI just snaps
   *  back on failure. */
  logDay: (position: number, tempo: number | null) => Promise<void>
}

export function useBassoonStore(spaceId: string | null, userId: string | null): BassoonStore {
  const live = Boolean(supabase && spaceId && userId)
  // Keyless dev mode seeds synchronously so the wheel never flashes empty.
  const [days, setDays] = useState<PracticeDay[]>(() => (supabase ? [] : seed()))
  const [loading, setLoading] = useState<boolean>(live)
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  // Initial load (live mode only). No realtime — see the module note.
  useEffect(() => {
    if (!supabase || !spaceId || !userId) return
    const client = supabase
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await client
        .from('music_practice_days')
        .select(DAY_COLUMNS)
        .eq('space_id', spaceId)
        .eq('user_id', userId)
        .order('practice_date')
      if (cancelled) return
      if (err) setError(errorMessage(err))
      else setDays((data as PracticeDayRow[]).map(toPracticeDay))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [spaceId, userId])

  // Replace any existing row for the same day (one key per day), else append.
  const putDay = useCallback((row: PracticeDay) => {
    setDays((prev) => [...prev.filter((d) => d.date !== row.date), row])
  }, [])

  // Latest days, read by setTodayKey to revert an optimistic write without
  // re-creating the callback on every change.
  const daysRef = useRef(days)
  daysRef.current = days

  const logDay = useCallback(
    async (position: number, tempo: number | null) => {
      const date = today()
      setError(null)
      if (supabase && spaceId && userId) {
        // Show the pick immediately, then reconcile with the server row (or
        // roll back to the pre-write snapshot on failure).
        const snapshot = daysRef.current
        putDay({ id: `optimistic-${date}`, date, position, tempo, createdBy: userId, createdAt: new Date().toISOString() })
        const { data, error: err } = await supabase
          .from('music_practice_days')
          .upsert(
            { space_id: spaceId, user_id: userId, practice_date: date, position, tempo },
            { onConflict: 'user_id,practice_date' },
          )
          .select(DAY_COLUMNS)
          .single()
        if (err) {
          setDays(snapshot)
          setError(err.message)
          return
        }
        putDay(toPracticeDay(data as PracticeDayRow))
        return
      }
      // Seed mode: keep the existing row's id if today was already logged.
      setDays((prev) => {
        const existing = prev.find((d) => d.date === date)
        const row: PracticeDay = existing
          ? { ...existing, position, tempo }
          : { id: nextId(), date, position, tempo, createdBy: SEED_SELF_ID, createdAt: new Date().toISOString() }
        return [...prev.filter((d) => d.date !== date), row]
      })
    },
    [spaceId, userId, putDay],
  )

  return { days, loading, error, clearError, logDay }
}
