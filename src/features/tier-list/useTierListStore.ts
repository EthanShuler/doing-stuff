import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Profile, Tier, TierItem, TierKind, TierPlacement, TierRead, WatchlistItem } from '../../types'
import { supabase } from '../../lib/supabase'
import { today } from '../../lib/format'
import { datesArePersonal, normalizeTags, renormalizedPositions } from './derive'
import { PROFILE_COLUMNS, errorMessage, idFactory, syncTable, toProfile, useSpaceSync } from '../../data/spaceSync'
import type { ProfileRow } from '../../data/spaceSync'

// Data seam for the tier lists, mirroring useActivityStore's two modes:
//   • Supabase keys present → live: reads/writes `tier_items` + `tier_placements`
//     (+ `tier_item_reads` for books) scoped to the space. The pool is shared;
//     placements and read records are per-person (RLS lets members read each
//     other's but write only their own).
//   • No keys → in-memory seed so the boards can be developed offline.
//
// The store holds items of ALL kinds and placements/reads of ALL users; the
// page derives one (kind, viewer) board at a time, so switching Movies ↔ TV ↔
// Books or You ↔ Partner never refetches.
//
// Watched/read dates split by kind (see datesArePersonal in derive.ts):
// movies/TV carry one shared `watched_on` on the item; books ignore it and
// track each member's own date in `tier_item_reads`.

interface Snapshot {
  items: TierItem[]
  placements: TierPlacement[]
  reads: TierRead[]
  profiles: Profile[]
  watchlist: WatchlistItem[]
}

// Seed viewer: keyless mode has no auth user, so the page ranks as this
// profile (matches the doing-stuff seed's "Avery").
const SEED_SELF_ID = 'u1'

function seed(): Snapshot {
  return {
    profiles: [
      { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
      { id: 'u2', email: 'jordan@example.com', displayName: 'Jordan' },
    ],
    // A few items carry tags so the filter pills are demoable offline.
    items: [
      { id: 'm1', kind: 'movie', title: 'Spirited Away', imageUrl: '', watchedOn: '2026-06-01', tags: ['fantasy', 'ghibli'], createdBy: 'u1', createdAt: '2026-06-01T09:00:00Z' },
      { id: 'm2', kind: 'movie', title: 'The Princess Bride', imageUrl: '', watchedOn: '2026-06-02', tags: ['fantasy'], createdBy: 'u2', createdAt: '2026-06-02T09:00:00Z' },
      { id: 'm3', kind: 'movie', title: 'Blade Runner 2049', imageUrl: '', watchedOn: null, tags: ['sci-fi'], createdBy: 'u1', createdAt: '2026-06-03T09:00:00Z' },
      { id: 'm4', kind: 'movie', title: 'Paddington 2', imageUrl: '', watchedOn: '2026-06-14', tags: [], createdBy: 'u2', createdAt: '2026-06-04T09:00:00Z' },
      { id: 'm5', kind: 'movie', title: 'The Room', imageUrl: '', watchedOn: null, tags: [], createdBy: 'u1', createdAt: '2026-06-05T09:00:00Z' },
      { id: 'm6', kind: 'movie', title: 'Everything Everywhere All at Once', imageUrl: '', watchedOn: '2026-06-20', tags: ['sci-fi'], createdBy: 'u2', createdAt: '2026-06-06T09:00:00Z' },
      { id: 't1', kind: 'tv', title: 'Severance', imageUrl: '', watchedOn: '2026-06-08', tags: ['sci-fi'], createdBy: 'u1', createdAt: '2026-06-01T10:00:00Z' },
      { id: 't2', kind: 'tv', title: 'The Great British Bake Off', imageUrl: '', watchedOn: null, tags: [], createdBy: 'u2', createdAt: '2026-06-02T10:00:00Z' },
      { id: 't3', kind: 'tv', title: 'Avatar: The Last Airbender', imageUrl: '', watchedOn: '2026-06-15', tags: ['fantasy'], createdBy: 'u1', createdAt: '2026-06-03T10:00:00Z' },
      { id: 't4', kind: 'tv', title: 'Emily in Paris', imageUrl: '', watchedOn: null, tags: [], createdBy: 'u2', createdAt: '2026-06-04T10:00:00Z' },
      // Books keep watchedOn null — read state is per person, in `reads` below.
      { id: 'b1', kind: 'book', title: 'Piranesi', imageUrl: '', watchedOn: null, tags: ['fantasy'], createdBy: 'u1', createdAt: '2026-06-01T11:00:00Z' },
      { id: 'b2', kind: 'book', title: 'Project Hail Mary', imageUrl: '', watchedOn: null, tags: ['sci-fi'], createdBy: 'u1', createdAt: '2026-06-02T11:00:00Z' },
      { id: 'b3', kind: 'book', title: 'Tomorrow, and Tomorrow, and Tomorrow', imageUrl: '', watchedOn: null, tags: [], createdBy: 'u2', createdAt: '2026-06-03T11:00:00Z' },
      { id: 'b4', kind: 'book', title: 'The Hobbit', imageUrl: '', watchedOn: null, tags: ['fantasy', 'childhood reads'], createdBy: 'u1', createdAt: '2026-06-04T11:00:00Z' },
      { id: 'b5', kind: 'book', title: 'Circe', imageUrl: '', watchedOn: null, tags: [], createdBy: 'u2', createdAt: '2026-06-05T11:00:00Z' },
    ],
    // Both viewers have rankings so the You/Partner toggle is demoable offline;
    // a few items stay unranked — and some undated → unwatched — to exercise
    // both shelves.
    placements: [
      { id: 'p1', itemId: 'm1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'p2', itemId: 'm4', userId: 'u1', tier: 'S', position: 2 },
      { id: 'p3', itemId: 'm2', userId: 'u1', tier: 'A', position: 1 },
      { id: 'p4', itemId: 'm5', userId: 'u1', tier: 'F', position: 1 },
      { id: 'p5', itemId: 'm1', userId: 'u2', tier: 'A', position: 1 },
      { id: 'p6', itemId: 'm3', userId: 'u2', tier: 'S', position: 1 },
      { id: 'p7', itemId: 'm5', userId: 'u2', tier: 'B', position: 1 },
      { id: 'p8', itemId: 't1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'p9', itemId: 't4', userId: 'u1', tier: 'D', position: 1 },
      { id: 'p10', itemId: 't1', userId: 'u2', tier: 'B', position: 1 },
      { id: 'p11', itemId: 't4', userId: 'u2', tier: 'S', position: 1 },
      { id: 'p12', itemId: 'b1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'p13', itemId: 'b1', userId: 'u2', tier: 'A', position: 1 },
      { id: 'p14', itemId: 'b2', userId: 'u1', tier: 'A', position: 1 },
      { id: 'p15', itemId: 'b3', userId: 'u2', tier: 'S', position: 1 },
    ],
    // Book read records: b1 read by both, b2/b4 only by u1, b3 only by u2, b5
    // by neither — so each seed board shows a different Unread shelf.
    reads: [
      { id: 'r1', itemId: 'b1', userId: 'u1', readOn: '2026-06-05' },
      { id: 'r2', itemId: 'b1', userId: 'u2', readOn: '2026-06-12' },
      { id: 'r3', itemId: 'b2', userId: 'u1', readOn: '2026-06-18' },
      { id: 'r4', itemId: 'b3', userId: 'u2', readOn: '2026-06-20' },
      { id: 'r5', itemId: 'b4', userId: 'u1', readOn: '2026-06-25' },
    ],
    // A couple open wishes per kind so the watchlist is demoable offline.
    watchlist: [
      { id: 'w1', kind: 'movie', title: 'Dune: Part Two', imageUrl: '', tierItemId: null, createdBy: 'u1', createdAt: '2026-06-10T09:00:00Z' },
      { id: 'w2', kind: 'movie', title: 'Past Lives', imageUrl: '', tierItemId: null, createdBy: 'u2', createdAt: '2026-06-11T09:00:00Z' },
      { id: 'w3', kind: 'tv', title: 'The Bear', imageUrl: '', tierItemId: null, createdBy: 'u1', createdAt: '2026-06-10T10:00:00Z' },
      { id: 'w4', kind: 'book', title: 'The Priory of the Orange Tree', imageUrl: '', tierItemId: null, createdBy: 'u2', createdAt: '2026-06-10T11:00:00Z' },
    ],
  }
}

// --- Row → app-type mappers (DB is snake_case) ---

type TierItemRow = {
  id: string
  kind: string
  title: string
  image_url: string | null
  watched_on: string | null
  tags: string[] | null
  created_by: string | null
  created_at: string
}
type TierPlacementRow = {
  id: string
  item_id: string
  user_id: string
  tier: string
  position: number
}
type TierReadRow = {
  id: string
  item_id: string
  user_id: string
  read_on: string
}
type WatchlistItemRow = {
  id: string
  kind: string
  title: string
  image_url: string | null
  tier_item_id: string | null
  created_by: string | null
  created_at: string
}

const toTierItem = (r: TierItemRow): TierItem => ({
  id: r.id,
  kind: r.kind as TierKind,
  title: r.title,
  imageUrl: r.image_url ?? '',
  watchedOn: r.watched_on,
  tags: r.tags ?? [],
  createdBy: r.created_by,
  createdAt: r.created_at,
})
const toTierPlacement = (r: TierPlacementRow): TierPlacement => ({
  id: r.id,
  itemId: r.item_id,
  userId: r.user_id,
  tier: r.tier as Tier,
  position: r.position,
})
const toTierRead = (r: TierReadRow): TierRead => ({
  id: r.id,
  itemId: r.item_id,
  userId: r.user_id,
  readOn: r.read_on,
})
const toWatchlistItem = (r: WatchlistItemRow): WatchlistItem => ({
  id: r.id,
  kind: r.kind as TierKind,
  title: r.title,
  imageUrl: r.image_url ?? '',
  tierItemId: r.tier_item_id,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const TIER_ITEM_COLUMNS = 'id,kind,title,image_url,watched_on,tags,created_by,created_at'
const TIER_PLACEMENT_COLUMNS = 'id,item_id,user_id,tier,position'
const TIER_READ_COLUMNS = 'id,item_id,user_id,read_on'
const WATCHLIST_COLUMNS = 'id,kind,title,image_url,tier_item_id,created_by,created_at'

// In-memory fallback only: stable client ids for seed-mode edits.
const nextId = idFactory('tx', 500)

// A placement's logical identity is (itemId, userId) — the DB enforces it
// unique. Upserting by that pair (rather than row id) keeps local state
// duplicate-free even when an optimistic write and its realtime echo carry
// different ids for the same ranking.
const upsertPlacement = (set: Dispatch<SetStateAction<TierPlacement[]>>, p: TierPlacement) =>
  set((prev) => [...prev.filter((x) => !(x.itemId === p.itemId && x.userId === p.userId)), p])

// Same story for a book's read record: unique per (itemId, userId).
const upsertRead = (set: Dispatch<SetStateAction<TierRead[]>>, r: TierRead) =>
  set((prev) => [...prev.filter((x) => !(x.itemId === r.itemId && x.userId === r.userId)), r])

export interface TierListStore {
  /** The shared pool — all kinds; filter with deriveBoard. */
  items: TierItem[]
  /** All members' placements; deriveBoard picks one viewer's. */
  placements: TierPlacement[]
  /** All members' book read records; deriveBoard picks one viewer's. */
  reads: TierRead[]
  /** The shared watchlist — all kinds; filter by kind in the UI. */
  watchlist: WatchlistItem[]
  profiles: Profile[]
  /** Whose board "You" is: the auth user, or the seed self in keyless mode. */
  selfId: string | null
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Add to the shared pool. `dateOn` is an ISO date or null (= none yet):
   *  the shared watched date for movies/TV, YOUR OWN read date for books.
   *  `tags` are shared filter labels (normalized before saving).
   *  Throws only when the item itself fails (the modal stays open). */
  addItem: (kind: TierKind, title: string, imageUrl: string, dateOn: string | null, tags: string[]) => Promise<void>
  /** Edit a pool item's title/image/tags + its date (same per-kind date
   *  semantics as addItem). Throws only when the item write fails. */
  updateItem: (id: string, kind: TierKind, title: string, imageUrl: string, dateOn: string | null, tags: string[]) => Promise<void>
  /** Remove from the pool — deletes EVERYONE's placements (and, for books,
   *  read records) of it. Throws on failure. */
  deleteItem: (id: string) => Promise<void>

  /** Rank (or re-rank) an item on the caller's own board. Inline flow: records
   *  the error and resyncs instead of throwing; the card snaps back. */
  placeItem: (itemId: string, tier: Tier, position: number) => Promise<void>
  /** Drop an item back to the unranked shelf (deletes the placement row). */
  unplaceItem: (itemId: string) => Promise<void>
  /** Rewrite one tier's ordering at integer positions (float-precision rescue). */
  placeTier: (tier: Tier, orderedItemIds: string[]) => Promise<void>
  /** Set or clear a pool item's shared watched date (drag on/off the unwatched
   *  shelf). Movies/TV only. Inline flow — records the error and resyncs
   *  instead of throwing. */
  setWatchedOn: (itemId: string, watchedOn: string | null) => Promise<void>
  /** Set or clear YOUR OWN read record for a book (drag on/off the Unread
   *  shelf, or the date field in the edit modal). null deletes the record —
   *  "I haven't read this". Inline flow — records the error and resyncs. */
  setReadOn: (itemId: string, readOn: string | null) => Promise<void>

  /** Add a "want to watch" item to the shared watchlist. Throws on failure. */
  addWatchlistItem: (kind: TierKind, title: string, imageUrl: string) => Promise<void>
  /** Edit a watchlist item's title/poster (open items only). Throws on failure. */
  updateWatchlistItem: (id: string, title: string, imageUrl: string) => Promise<void>
  /** Remove a watchlist item (does not touch any tier item it created). Throws on failure. */
  deleteWatchlistItem: (id: string) => Promise<void>
  /** Check off an open item: create the tier item in the pool and link to it.
   *  Inline flow — records the error instead of throwing. */
  checkOffWatchlistItem: (item: WatchlistItem) => Promise<void>
  /** Reopen a checked item (clears the link; the tier item stays on the board). */
  uncheckWatchlistItem: (id: string) => Promise<void>
}

export function useTierListStore(spaceId: string | null, userId: string | null = null): TierListStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  // Built once — every list below initializes from the same snapshot.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [items, setItems] = useState<TierItem[]>(initial?.items ?? [])
  const [placements, setPlacements] = useState<TierPlacement[]>(initial?.placements ?? [])
  const [reads, setReads] = useState<TierRead[]>(initial?.reads ?? [])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initial?.watchlist ?? [])
  const [profiles, setProfiles] = useState<Profile[]>(initial?.profiles ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  const selfId = supabase ? userId : SEED_SELF_ID

  // Fetch one full snapshot (live mode only). Shared by the initial load, the
  // resync after a realtime reconnect, and the recovery path after a failed
  // optimistic drop. Throws on the first failed query.
  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [its, places, reads_, profs, watches] = await Promise.all([
      supabase.from('tier_items').select(TIER_ITEM_COLUMNS).eq('space_id', spaceId).order('created_at'),
      supabase.from('tier_placements').select(TIER_PLACEMENT_COLUMNS).eq('space_id', spaceId).order('position'),
      supabase.from('tier_item_reads').select(TIER_READ_COLUMNS).eq('space_id', spaceId).order('created_at'),
      // RLS scopes this to the current user + anyone they share a space with.
      supabase.from('profiles').select(PROFILE_COLUMNS),
      supabase.from('watchlist_items').select(WATCHLIST_COLUMNS).eq('space_id', spaceId).order('created_at'),
    ])
    if (its.error) throw its.error
    if (places.error) throw places.error
    if (reads_.error) throw reads_.error
    if (profs.error) throw profs.error
    if (watches.error) throw watches.error
    return {
      items: (its.data as TierItemRow[]).map(toTierItem),
      placements: (places.data as TierPlacementRow[]).map(toTierPlacement),
      reads: (reads_.data as TierReadRow[]).map(toTierRead),
      profiles: (profs.data as ProfileRow[]).map(toProfile),
      watchlist: (watches.data as WatchlistItemRow[]).map(toWatchlistItem),
    }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setItems(snap.items)
    setPlacements(snap.placements)
    setReads(snap.reads)
    setProfiles(snap.profiles)
    setWatchlist(snap.watchlist)
  }, [])

  // Resync after a failed inline write: the optimistic local change is wrong,
  // so pull the truth back down (the data set is tiny).
  const resync = useCallback(() => {
    fetchAll()
      .then((snap) => {
        if (snap) applySnapshot(snap)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [fetchAll, applySnapshot])

  // Wire this store's tables onto the realtime channel (see useSpaceSync).
  // Placements and read records pass their (itemId, userId)-keyed upserts;
  // a cascaded tier-item delete needs no special-casing — the DB emits the
  // dependent deletes (and the watchlist set-null UPDATE) as their own events.
  const wire = useCallback((channel: RealtimeChannel, spaceFilter: string) => {
    channel = syncTable(channel, spaceFilter, 'tier_items', toTierItem, setItems)
    channel = syncTable(channel, spaceFilter, 'tier_placements', toTierPlacement, setPlacements, upsertPlacement)
    channel = syncTable(channel, spaceFilter, 'tier_item_reads', toTierRead, setReads, upsertRead)
    channel = syncTable(channel, spaceFilter, 'watchlist_items', toWatchlistItem, setWatchlist)
    return channel
  }, [])

  useSpaceSync({
    spaceId,
    channelPrefix: 'tier',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  // Your own read record for a book: null deletes it ("I haven't read this"),
  // a date upserts it. Only ever touches rows with your user_id — the
  // partner's read state is theirs (and RLS enforces it). Declared ahead of
  // the pool actions because addItem/updateItem/checkOff compose it.
  const setReadOn = useCallback(
    async (itemId: string, readOn: string | null) => {
      if (!selfId) return
      setError(null)
      if (readOn === null) {
        // Optimistic: the card lands on the Unread shelf instantly.
        setReads((prev) => prev.filter((r) => !(r.itemId === itemId && r.userId === selfId)))
        if (!supabase || !spaceId) return
        const { error: err } = await supabase
          .from('tier_item_reads')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', selfId)
        if (err) {
          setError(err.message)
          resync()
        }
        return
      }
      // Optimistic with a temp id — reconciliation upserts by (itemId, userId).
      upsertRead(setReads, { id: nextId(), itemId, userId: selfId, readOn })
      if (!supabase || !spaceId) return
      const { data, error: err } = await supabase
        .from('tier_item_reads')
        .upsert(
          { space_id: spaceId, item_id: itemId, user_id: selfId, read_on: readOn },
          { onConflict: 'item_id,user_id' },
        )
        .select(TIER_READ_COLUMNS)
        .single()
      if (err) {
        setError(err.message)
        resync()
        return
      }
      upsertRead(setReads, toTierRead(data as TierReadRow))
    },
    [spaceId, selfId, resync],
  )

  // --- Pool actions. These throw on failure so the item modal can stay open. ---

  const addItem = useCallback(
    async (kind: TierKind, title: string, imageUrl: string, dateOn: string | null, tags: string[]) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      const cleanTags = normalizeTags(tags)
      // Books: the date is YOUR read record, not the shared item's.
      const personal = datesArePersonal(kind)
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('tier_items')
          .insert({ space_id: spaceId, kind, title: trimmed, image_url: image, watched_on: personal ? null : dateOn, tags: cleanTags })
          .select(TIER_ITEM_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const created = toTierItem(data as TierItemRow)
        setItems((prev) => [...prev, created])
        // The item exists either way now, so a failed read-record write only
        // surfaces the error banner (setReadOn resyncs) — no throw.
        if (personal && dateOn) await setReadOn(created.id, dateOn)
        return
      }
      const created: TierItem = {
        id: nextId(),
        kind,
        title: trimmed,
        imageUrl: image,
        watchedOn: personal ? null : dateOn,
        tags: cleanTags,
        createdBy: selfId,
        createdAt: new Date().toISOString(),
      }
      setItems((prev) => [...prev, created])
      if (personal && dateOn) await setReadOn(created.id, dateOn)
    },
    [spaceId, selfId, setReadOn],
  )

  const updateItem = useCallback(
    async (id: string, kind: TierKind, title: string, imageUrl: string, dateOn: string | null, tags: string[]) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      const cleanTags = normalizeTags(tags)
      const personal = datesArePersonal(kind)
      if (supabase && spaceId) {
        // For books, leave the shared watched_on alone — the date belongs to
        // the caller's own read record instead.
        const patch = personal
          ? { title: trimmed, image_url: image, tags: cleanTags }
          : { title: trimmed, image_url: image, tags: cleanTags, watched_on: dateOn }
        const { error: err } = await supabase.from('tier_items').update(patch).eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setItems((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, title: trimmed, imageUrl: image, tags: cleanTags, ...(personal ? {} : { watchedOn: dateOn }) }
            : x,
        ),
      )
      // Sync your read record to the field: a date upserts, blank deletes.
      // Inline flow (no throw) — the item edit above already landed.
      if (personal) await setReadOn(id, dateOn)
    },
    [spaceId, setReadOn],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('tier_items').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      // DB cascades every member's placements (and read records) of the item;
      // mirror it locally.
      setItems((prev) => prev.filter((x) => x.id !== id))
      setPlacements((prev) => prev.filter((p) => p.itemId !== id))
      setReads((prev) => prev.filter((r) => r.itemId !== id))
      // The FK is ON DELETE SET NULL, so any watchlist item that produced this
      // tier item reopens. Mirror that locally too.
      setWatchlist((prev) => prev.map((w) => (w.tierItemId === id ? { ...w, tierItemId: null } : w)))
    },
    [spaceId],
  )

  // --- Placement actions (drops). Inline flows: optimistic local move first,
  //     then the write; on failure record the error and resync — the card
  //     visibly snaps back and the banner says why. ---

  const placeItem = useCallback(
    async (itemId: string, tier: Tier, position: number) => {
      if (!selfId) return
      setError(null)
      // Optimistic: the drop settles instantly. A temp id is fine — realtime
      // echoes and reconciliation upsert by (itemId, userId), not row id.
      upsertPlacement(setPlacements, { id: nextId(), itemId, userId: selfId, tier, position })
      if (!supabase || !spaceId) return
      const { data, error: err } = await supabase
        .from('tier_placements')
        .upsert(
          // user_id explicitly (not left to the DB default) so the ON CONFLICT
          // (item_id, user_id) target matches on re-ranks.
          { space_id: spaceId, item_id: itemId, user_id: selfId, tier, position },
          { onConflict: 'item_id,user_id' },
        )
        .select(TIER_PLACEMENT_COLUMNS)
        .single()
      if (err) {
        setError(err.message)
        resync()
        return
      }
      upsertPlacement(setPlacements, toTierPlacement(data as TierPlacementRow))
    },
    [spaceId, selfId, resync],
  )

  const unplaceItem = useCallback(
    async (itemId: string) => {
      if (!selfId) return
      setError(null)
      setPlacements((prev) => prev.filter((p) => !(p.itemId === itemId && p.userId === selfId)))
      if (!supabase || !spaceId) return
      const { error: err } = await supabase
        .from('tier_placements')
        .delete()
        .eq('item_id', itemId)
        .eq('user_id', selfId)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, selfId, resync],
  )

  const placeTier = useCallback(
    async (tier: Tier, orderedItemIds: string[]) => {
      if (!selfId) return
      setError(null)
      const rewrites = renormalizedPositions(orderedItemIds)
      for (const { itemId, position } of rewrites) {
        upsertPlacement(setPlacements, { id: nextId(), itemId, userId: selfId, tier, position })
      }
      if (!supabase || !spaceId) return
      const { data, error: err } = await supabase
        .from('tier_placements')
        .upsert(
          rewrites.map(({ itemId, position }) => ({
            space_id: spaceId,
            item_id: itemId,
            user_id: selfId,
            tier,
            position,
          })),
          { onConflict: 'item_id,user_id' },
        )
        .select(TIER_PLACEMENT_COLUMNS)
      if (err) {
        setError(err.message)
        resync()
        return
      }
      for (const row of data as TierPlacementRow[]) upsertPlacement(setPlacements, toTierPlacement(row))
    },
    [spaceId, selfId, resync],
  )

  const setWatchedOn = useCallback(
    async (itemId: string, watchedOn: string | null) => {
      setError(null)
      // Optimistic: the card lands on its new shelf instantly.
      setItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, watchedOn } : x)))
      if (!supabase || !spaceId) return
      const { error: err } = await supabase.from('tier_items').update({ watched_on: watchedOn }).eq('id', itemId)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, resync],
  )

  // --- Watchlist actions. Add/update/delete throw so the modal can stay open;
  //     check-off / uncheck are inline (checkbox) and record the error instead. ---

  const addWatchlistItem = useCallback(
    async (kind: TierKind, title: string, imageUrl: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('watchlist_items')
          .insert({ space_id: spaceId, kind, title: trimmed, image_url: image })
          .select(WATCHLIST_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        setWatchlist((prev) => [...prev, toWatchlistItem(data as WatchlistItemRow)])
        return
      }
      setWatchlist((prev) => [
        ...prev,
        { id: nextId(), kind, title: trimmed, imageUrl: image, tierItemId: null, createdBy: selfId, createdAt: new Date().toISOString() },
      ])
    },
    [spaceId, selfId],
  )

  const updateWatchlistItem = useCallback(
    async (id: string, title: string, imageUrl: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      if (supabase && spaceId) {
        const { error: err } = await supabase
          .from('watchlist_items')
          .update({ title: trimmed, image_url: image })
          .eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setWatchlist((prev) => prev.map((w) => (w.id === id ? { ...w, title: trimmed, imageUrl: image } : w)))
    },
    [spaceId],
  )

  const deleteWatchlistItem = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('watchlist_items').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setWatchlist((prev) => prev.filter((w) => w.id !== id))
    },
    [spaceId],
  )

  const checkOffWatchlistItem = useCallback(
    async (wi: WatchlistItem) => {
      // Already checked off — nothing to do.
      if (wi.tierItemId) return
      setError(null)
      // Checking off means "just finished it" → dated today. For movies/TV
      // that's the shared watched date; for books it's the CHECKER's own read
      // record — the partner's copy lands on their Unread shelf.
      const personal = datesArePersonal(wi.kind)
      if (supabase && spaceId) {
        // 1. Create the tier item in the shared pool.
        const { data: itemData, error: itemErr } = await supabase
          .from('tier_items')
          .insert({
            space_id: spaceId,
            kind: wi.kind,
            title: wi.title,
            image_url: wi.imageUrl,
            watched_on: personal ? null : today(),
          })
          .select(TIER_ITEM_COLUMNS)
          .single()
        if (itemErr) {
          setError(itemErr.message)
          return
        }
        const created = toTierItem(itemData as TierItemRow)
        setItems((prev) => (prev.some((x) => x.id === created.id) ? prev : [...prev, created]))
        // 2. Your read record (books). A failure surfaces the banner and
        //    resyncs inside setReadOn; the item is on the board regardless.
        if (personal) await setReadOn(created.id, today())
        // 3. Link the watchlist item to it (marks it done).
        const { error: linkErr } = await supabase
          .from('watchlist_items')
          .update({ tier_item_id: created.id })
          .eq('id', wi.id)
        if (linkErr) {
          // The tier item exists; the link write failed. Surface it and resync
          // so local state matches the DB (the item is on the board regardless).
          setError(linkErr.message)
          resync()
          return
        }
        setWatchlist((prev) => prev.map((w) => (w.id === wi.id ? { ...w, tierItemId: created.id } : w)))
        return
      }
      // Seed mode: create the pool item and link locally.
      const created: TierItem = {
        id: nextId(),
        kind: wi.kind,
        title: wi.title,
        imageUrl: wi.imageUrl,
        watchedOn: personal ? null : today(),
        tags: [],
        createdBy: selfId,
        createdAt: new Date().toISOString(),
      }
      setItems((prev) => [...prev, created])
      if (personal) await setReadOn(created.id, today())
      setWatchlist((prev) => prev.map((w) => (w.id === wi.id ? { ...w, tierItemId: created.id } : w)))
    },
    [spaceId, selfId, resync, setReadOn],
  )

  const uncheckWatchlistItem = useCallback(
    async (id: string) => {
      setError(null)
      // Reopen the wish; the tier item it created stays on the board.
      setWatchlist((prev) => prev.map((w) => (w.id === id ? { ...w, tierItemId: null } : w)))
      if (!supabase || !spaceId) return
      const { error: err } = await supabase.from('watchlist_items').update({ tier_item_id: null }).eq('id', id)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, resync],
  )

  return {
    items,
    placements,
    reads,
    watchlist,
    profiles,
    selfId,
    loading,
    error,
    clearError,
    addItem,
    updateItem,
    deleteItem,
    placeItem,
    unplaceItem,
    placeTier,
    setWatchedOn,
    setReadOn,
    addWatchlistItem,
    updateWatchlistItem,
    deleteWatchlistItem,
    checkOffWatchlistItem,
    uncheckWatchlistItem,
  }
}
