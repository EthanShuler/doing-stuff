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

// --- Keyless-mode seed identities: every feature's in-memory seed shares the
//     same two demo members, with the first one acting as the signed-in user. ---

export const SEED_SELF_ID = 'u1'
export const SEED_PROFILES: Profile[] = [
  { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
  { id: 'u2', email: 'jordan@example.com', displayName: 'Jordan' },
]

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
 *   1. Open one realtime channel, wired up by the caller, and subscribe.
 *   2. Fetch the snapshot when the channel reports SUBSCRIBED. Reading only
 *      after the join is what makes the handoff race-free: anything written
 *      before the read is in the snapshot, anything after it arrives as an
 *      event. Doing it in this order means ONE fetch, not the two (mount +
 *      join) an eager initial load would cost.
 *   3. Every later SUBSCRIBED is a rejoin after a drop (laptop sleep,
 *      network blip), so it refetches to cover the gap. applySnapshot is
 *      idempotent, so overlapping loads are harmless — an `inFlight` guard
 *      collapses them anyway.
 *
 * Realtime is a nice-to-have, never a gate on seeing your data: if the
 * channel errors or times out before the first load, we fetch regardless,
 * and a 1.5s timer fetches anyway if no status has arrived at all (a slow
 * or hung websocket must not hold the page blank). `loading` flips false
 * once that first load settles, successfully or not.
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
  // One effect: subscribe, then load off the join. Realtime also streams the
  // partner's changes into local state so their edits appear without a
  // reload — that requires the tables to be in the `supabase_realtime`
  // publication (see schema.sql). DB cascades arrive as their own events, so
  // wires need no special-casing for them.
  useEffect(() => {
    if (!supabase || !spaceId) return
    const client = supabase
    let cancelled = false
    /** Collapses overlapping loads (e.g. the fallback timer racing a join). */
    let inFlight = false
    /** A load requested while one was already running — re-run once, so a
     *  join that lands mid-fetch still gets a read that provably follows it. */
    let queued = false
    /** The first load is the one `loading` is about; later ones are refreshes. */
    let loadedOnce = false

    setLoading(true)
    setError(null)

    const load = () => {
      if (cancelled) return
      if (inFlight) {
        queued = true
        return
      }
      inFlight = true
      fetchAll()
        .then((snap) => {
          if (!cancelled && snap) applySnapshot(snap)
        })
        .catch((err) => {
          if (!cancelled) setError(errorMessage(err))
        })
        .finally(() => {
          inFlight = false
          if (cancelled) return
          // Whether or not it worked, the page stops waiting on it.
          if (!loadedOnce) {
            loadedOnce = true
            setLoading(false)
          }
          if (queued) {
            queued = false
            load()
          }
        })
    }

    const channel = wire(client.channel(`${channelPrefix}:${spaceId}`), `space_id=eq.${spaceId}`)

    channel.subscribe((status) => {
      if (cancelled) return
      if (status === 'SUBSCRIBED') {
        // Every join loads: the first one is the initial snapshot (read after
        // the join, so nothing can slip between the two), later ones cover
        // whatever was missed while the socket was down.
        load()
      } else if (!loadedOnce && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
        // Realtime unavailable — show the data anyway rather than a blank page.
        load()
      }
    })

    // Backstop: a websocket that neither joins nor reports an error would
    // otherwise hold the first paint forever.
    const fallback = setTimeout(() => {
      if (!loadedOnce) load()
    }, 1500)

    return () => {
      cancelled = true
      clearTimeout(fallback)
      client.removeChannel(channel)
    }
  }, [spaceId, channelPrefix, fetchAll, applySnapshot, setLoading, setError, wire])
}
