import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'

// Shared machinery for a feature's space-scoped data store. Every store hook
// (useActivityStore, useTierListStore, …) follows the same shape:
//   • fetch one full snapshot of its tables on load,
//   • stream the partner's edits in over one realtime channel,
//   • refetch the snapshot when a dropped channel rejoins.
// The domain-specific parts (row mappers, actions, seed data) stay in each
// feature's store; this module owns the plumbing they all repeat.

/** Human-readable message for a failed store action. */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'

// --- Profiles: every store fetches the same co-member identities. ---

export type ProfileRow = { id: string; email: string | null; display_name: string | null }
export const toProfile = (r: ProfileRow): Profile => ({ id: r.id, email: r.email, displayName: r.display_name })
export const PROFILE_COLUMNS = 'id,email,display_name'

// --- List-state helpers keyed by row id. Used both by realtime handlers
//     (which makes echoes of this client's own writes idempotent) and by
//     optimistic local updates. ---

export const upsertById = <T extends { id: string }>(set: Dispatch<SetStateAction<T[]>>, item: T) =>
  set((prev) =>
    prev.some((x) => x.id === item.id)
      ? prev.map((x) => (x.id === item.id ? item : x))
      : [...prev, item],
  )

export const removeById = <T extends { id: string }>(set: Dispatch<SetStateAction<T[]>>, id: string) =>
  set((prev) => (prev.some((x) => x.id === id) ? prev.filter((x) => x.id !== id) : prev))

/** Stable client ids for seed-mode edits (in-memory fallback only). */
export function idFactory(prefix: string, start: number): () => string {
  let counter = start
  return () => {
    counter += 1
    return `${prefix}${counter}`
  }
}

/**
 * Subscribe one table's INSERT/UPDATE/DELETE events into a list state.
 * INSERT/UPDATE are filtered to the space server-side. DELETE can't be —
 * Postgres puts only the primary key in the replicated old record — so we
 * listen unfiltered and drop the id if we happen to hold it. Pass a custom
 * `upsert` when the row's logical identity isn't its id (e.g. tier placements
 * are unique per (itemId, userId), so an optimistic write and its realtime
 * echo may carry different row ids for the same ranking).
 */
export function syncTable<Row extends object, T extends { id: string }>(
  channel: RealtimeChannel,
  spaceFilter: string,
  table: string,
  map: (row: Row) => T,
  set: Dispatch<SetStateAction<T[]>>,
  upsert: (set: Dispatch<SetStateAction<T[]>>, item: T) => void = upsertById,
): RealtimeChannel {
  return channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: spaceFilter }, (p) =>
      upsert(set, map(p.new as Row)),
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: spaceFilter }, (p) =>
      upsert(set, map(p.new as Row)),
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) =>
      removeById(set, (p.old as { id: string }).id),
    )
}

/**
 * The load-and-sync lifecycle every store shares (live mode only; no-op
 * without keys or before the space resolves):
 *
 *   1. Fetch the initial snapshot and apply it.
 *   2. Open one realtime channel, wired up by the caller.
 *   3. On a rejoin after a drop (laptop sleep, network blip), refetch the
 *      snapshot to cover anything missed while disconnected.
 *
 * `fetchAll`, `applySnapshot`, and `wire` must be referentially stable
 * (useCallback) — they're effect dependencies.
 */
export function useSpaceSync<Snapshot>({
  spaceId,
  channelPrefix,
  fetchAll,
  applySnapshot,
  setLoading,
  setError,
  wire,
}: {
  spaceId: string | null
  /** Unique per store — both stores can be mounted in one session and their
   *  channel names must not collide. */
  channelPrefix: string
  /** Fetch one full snapshot; throws on the first failed query. */
  fetchAll: () => Promise<Snapshot | null>
  applySnapshot: (snap: Snapshot) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  /** Attach the store's postgres_changes handlers (see syncTable) and return
   *  the channel. */
  wire: (channel: RealtimeChannel, spaceFilter: string) => RealtimeChannel
}) {
  // Initial load.
  useEffect(() => {
    if (!supabase || !spaceId) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const snap = await fetchAll()
        if (!cancelled && snap) applySnapshot(snap)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [spaceId, fetchAll, applySnapshot, setLoading, setError])

  // Realtime: stream the partner's changes into local state so their edits
  // appear without a reload. Requires the tables to be in the
  // `supabase_realtime` publication (see schema.sql). DB cascades arrive as
  // their own events, so wires need no special-casing for them.
  useEffect(() => {
    if (!supabase || !spaceId) return
    const client = supabase
    let cancelled = false

    const channel = wire(client.channel(`${channelPrefix}:${spaceId}`), `space_id=eq.${spaceId}`)

    let subscribedOnce = false
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      // The first subscribe races the initial load, which already covers it.
      // Later ones mean the socket dropped and rejoined — refetch to pick up
      // anything missed while disconnected.
      if (!subscribedOnce) {
        subscribedOnce = true
        return
      }
      fetchAll()
        .then((snap) => {
          if (!cancelled && snap) applySnapshot(snap)
        })
        .catch((err) => {
          if (!cancelled) setError(errorMessage(err))
        })
    })

    return () => {
      cancelled = true
      client.removeChannel(channel)
    }
  }, [spaceId, channelPrefix, fetchAll, applySnapshot, setError, wire])
}
