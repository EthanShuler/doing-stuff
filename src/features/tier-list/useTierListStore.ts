import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Profile, Tier, TierItem, TierKind, TierPlacement, WatchlistItem } from '../../types'
import { supabase } from '../../lib/supabase'
import { renormalizedPositions } from './derive'

// Data seam for the tier lists, mirroring useActivityStore's two modes:
//   • Supabase keys present → live: reads/writes `tier_items` + `tier_placements`
//     scoped to the space. The pool is shared; placements are per-person (RLS
//     lets members read each other's placements but write only their own).
//   • No keys → in-memory seed so the boards can be developed offline.
//
// The store holds items of BOTH kinds and placements of ALL users; the page
// derives one (kind, viewer) board at a time, so switching Movies ↔ TV or
// You ↔ Partner never refetches.

interface Snapshot {
  items: TierItem[]
  placements: TierPlacement[]
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
    items: [
      { id: 'm1', kind: 'movie', title: 'Spirited Away', imageUrl: '', createdBy: 'u1', createdAt: '2026-06-01T09:00:00Z' },
      { id: 'm2', kind: 'movie', title: 'The Princess Bride', imageUrl: '', createdBy: 'u2', createdAt: '2026-06-02T09:00:00Z' },
      { id: 'm3', kind: 'movie', title: 'Blade Runner 2049', imageUrl: '', createdBy: 'u1', createdAt: '2026-06-03T09:00:00Z' },
      { id: 'm4', kind: 'movie', title: 'Paddington 2', imageUrl: '', createdBy: 'u2', createdAt: '2026-06-04T09:00:00Z' },
      { id: 'm5', kind: 'movie', title: 'The Room', imageUrl: '', createdBy: 'u1', createdAt: '2026-06-05T09:00:00Z' },
      { id: 'm6', kind: 'movie', title: 'Everything Everywhere All at Once', imageUrl: '', createdBy: 'u2', createdAt: '2026-06-06T09:00:00Z' },
      { id: 't1', kind: 'tv', title: 'Severance', imageUrl: '', createdBy: 'u1', createdAt: '2026-06-01T10:00:00Z' },
      { id: 't2', kind: 'tv', title: 'The Great British Bake Off', imageUrl: '', createdBy: 'u2', createdAt: '2026-06-02T10:00:00Z' },
      { id: 't3', kind: 'tv', title: 'Avatar: The Last Airbender', imageUrl: '', createdBy: 'u1', createdAt: '2026-06-03T10:00:00Z' },
      { id: 't4', kind: 'tv', title: 'Emily in Paris', imageUrl: '', createdBy: 'u2', createdAt: '2026-06-04T10:00:00Z' },
    ],
    // Both viewers have rankings so the You/Partner toggle is demoable offline;
    // a few items stay unranked to exercise the shelf.
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
    ],
    // A couple open wishes per kind so the watchlist is demoable offline.
    watchlist: [
      { id: 'w1', kind: 'movie', title: 'Dune: Part Two', imageUrl: '', tierItemId: null, createdBy: 'u1', createdAt: '2026-06-10T09:00:00Z' },
      { id: 'w2', kind: 'movie', title: 'Past Lives', imageUrl: '', tierItemId: null, createdBy: 'u2', createdAt: '2026-06-11T09:00:00Z' },
      { id: 'w3', kind: 'tv', title: 'The Bear', imageUrl: '', tierItemId: null, createdBy: 'u1', createdAt: '2026-06-10T10:00:00Z' },
    ],
  }
}

// --- Row → app-type mappers (DB is snake_case) ---

type TierItemRow = {
  id: string
  kind: string
  title: string
  image_url: string | null
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
type ProfileRow = { id: string; email: string | null; display_name: string | null }
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
const toProfile = (r: ProfileRow): Profile => ({ id: r.id, email: r.email, displayName: r.display_name })
const toWatchlistItem = (r: WatchlistItemRow): WatchlistItem => ({
  id: r.id,
  kind: r.kind as TierKind,
  title: r.title,
  imageUrl: r.image_url ?? '',
  tierItemId: r.tier_item_id,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const TIER_ITEM_COLUMNS = 'id,kind,title,image_url,created_by,created_at'
const TIER_PLACEMENT_COLUMNS = 'id,item_id,user_id,tier,position'
const WATCHLIST_COLUMNS = 'id,kind,title,image_url,tier_item_id,created_by,created_at'

const message = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'

// In-memory fallback only: stable client ids for seed-mode edits.
let idCounter = 500
function nextId(): string {
  idCounter += 1
  return `tx${idCounter}`
}

// A placement's logical identity is (itemId, userId) — the DB enforces it
// unique. Upserting by that pair (rather than row id) keeps local state
// duplicate-free even when an optimistic write and its realtime echo carry
// different ids for the same ranking.
const upsertPlacement = (set: Dispatch<SetStateAction<TierPlacement[]>>, p: TierPlacement) =>
  set((prev) => [...prev.filter((x) => !(x.itemId === p.itemId && x.userId === p.userId)), p])

export interface TierListStore {
  /** The shared pool — both kinds; filter with deriveBoard. */
  items: TierItem[]
  /** All members' placements; deriveBoard picks one viewer's. */
  placements: TierPlacement[]
  /** The shared watchlist — both kinds; filter by kind in the UI. */
  watchlist: WatchlistItem[]
  profiles: Profile[]
  /** Whose board "You" is: the auth user, or the seed self in keyless mode. */
  selfId: string | null
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Add to the shared pool. Throws on failure (the modal stays open). */
  addItem: (kind: TierKind, title: string, imageUrl: string) => Promise<void>
  /** Edit a pool item's title/poster. Throws on failure. */
  updateItem: (id: string, title: string, imageUrl: string) => Promise<void>
  /** Remove from the pool — deletes EVERYONE's placements of it. Throws on failure. */
  deleteItem: (id: string) => Promise<void>

  /** Rank (or re-rank) an item on the caller's own board. Inline flow: records
   *  the error and resyncs instead of throwing; the card snaps back. */
  placeItem: (itemId: string, tier: Tier, position: number) => Promise<void>
  /** Drop an item back to the unranked shelf (deletes the placement row). */
  unplaceItem: (itemId: string) => Promise<void>
  /** Rewrite one tier's ordering at integer positions (float-precision rescue). */
  placeTier: (tier: Tier, orderedItemIds: string[]) => Promise<void>

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
  const [items, setItems] = useState<TierItem[]>(() => (supabase ? [] : seed().items))
  const [placements, setPlacements] = useState<TierPlacement[]>(() => (supabase ? [] : seed().placements))
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => (supabase ? [] : seed().watchlist))
  const [profiles, setProfiles] = useState<Profile[]>(() => (supabase ? [] : seed().profiles))
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  const selfId = supabase ? userId : SEED_SELF_ID

  // Fetch one full snapshot (live mode only). Shared by the initial load, the
  // resync after a realtime reconnect, and the recovery path after a failed
  // optimistic drop. Throws on the first failed query.
  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [its, places, profs, watches] = await Promise.all([
      supabase.from('tier_items').select(TIER_ITEM_COLUMNS).eq('space_id', spaceId).order('created_at'),
      supabase.from('tier_placements').select(TIER_PLACEMENT_COLUMNS).eq('space_id', spaceId).order('position'),
      // RLS scopes this to the current user + anyone they share a space with.
      supabase.from('profiles').select('id,email,display_name'),
      supabase.from('watchlist_items').select(WATCHLIST_COLUMNS).eq('space_id', spaceId).order('created_at'),
    ])
    if (its.error) throw its.error
    if (places.error) throw places.error
    if (profs.error) throw profs.error
    if (watches.error) throw watches.error
    return {
      items: (its.data as TierItemRow[]).map(toTierItem),
      placements: (places.data as TierPlacementRow[]).map(toTierPlacement),
      profiles: (profs.data as ProfileRow[]).map(toProfile),
      watchlist: (watches.data as WatchlistItemRow[]).map(toWatchlistItem),
    }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setItems(snap.items)
    setPlacements(snap.placements)
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
      .catch((err) => setError(message(err)))
  }, [fetchAll, applySnapshot])

  // Initial load (live mode only; waits for the space to resolve).
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
        if (!cancelled) setError(message(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [spaceId, fetchAll, applySnapshot])

  // Realtime: stream the partner's pool additions and placement changes in
  // live. Same shape as useActivityStore's channel, but its own channel name —
  // both stores can be mounted in one session and names must not collide.
  useEffect(() => {
    if (!supabase || !spaceId) return
    const client = supabase
    let cancelled = false

    const spaceFilter = `space_id=eq.${spaceId}`
    let channel = client.channel(`tier:${spaceId}`)

    const upsertItem = (item: TierItem) =>
      setItems((prev) =>
        prev.some((x) => x.id === item.id)
          ? prev.map((x) => (x.id === item.id ? item : x))
          : [...prev, item],
      )

    const upsertWatch = (w: WatchlistItem) =>
      setWatchlist((prev) =>
        prev.some((x) => x.id === w.id) ? prev.map((x) => (x.id === w.id ? w : x)) : [...prev, w],
      )

    // INSERT/UPDATE are filtered to this space server-side. DELETE can't be —
    // Postgres puts only the primary key in the replicated old record — so we
    // listen unfiltered and drop the id if we happen to hold it.
    channel = channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tier_items', filter: spaceFilter }, (p) =>
        upsertItem(toTierItem(p.new as TierItemRow)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tier_items', filter: spaceFilter }, (p) =>
        upsertItem(toTierItem(p.new as TierItemRow)),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tier_items' }, (p) => {
        const id = (p.old as { id: string }).id
        setItems((prev) => prev.filter((x) => x.id !== id))
        // The DB cascades the item's placements; those arrive as their own
        // DELETE events, so no local mirroring is needed here.
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tier_placements', filter: spaceFilter }, (p) =>
        upsertPlacement(setPlacements, toTierPlacement(p.new as TierPlacementRow)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tier_placements', filter: spaceFilter }, (p) =>
        upsertPlacement(setPlacements, toTierPlacement(p.new as TierPlacementRow)),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tier_placements' }, (p) => {
        const id = (p.old as { id: string }).id
        setPlacements((prev) => prev.filter((x) => x.id !== id))
      })
      // Watchlist: shared, so INSERT/UPDATE (incl. the tier_item_id set-null that
      // a cascaded tier-item delete produces) stream in filtered to the space.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'watchlist_items', filter: spaceFilter }, (p) =>
        upsertWatch(toWatchlistItem(p.new as WatchlistItemRow)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watchlist_items', filter: spaceFilter }, (p) =>
        upsertWatch(toWatchlistItem(p.new as WatchlistItemRow)),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'watchlist_items' }, (p) => {
        const id = (p.old as { id: string }).id
        setWatchlist((prev) => prev.filter((x) => x.id !== id))
      })

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
          if (!cancelled) setError(message(err))
        })
    })

    return () => {
      cancelled = true
      client.removeChannel(channel)
    }
  }, [spaceId, fetchAll, applySnapshot])

  // --- Pool actions. These throw on failure so the item modal can stay open. ---

  const addItem = useCallback(
    async (kind: TierKind, title: string, imageUrl: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('tier_items')
          .insert({ space_id: spaceId, kind, title: trimmed, image_url: image })
          .select(TIER_ITEM_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        setItems((prev) => [...prev, toTierItem(data as TierItemRow)])
        return
      }
      setItems((prev) => [
        ...prev,
        { id: nextId(), kind, title: trimmed, imageUrl: image, createdBy: selfId, createdAt: new Date().toISOString() },
      ])
    },
    [spaceId, selfId],
  )

  const updateItem = useCallback(
    async (id: string, title: string, imageUrl: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      if (supabase && spaceId) {
        const { error: err } = await supabase
          .from('tier_items')
          .update({ title: trimmed, image_url: image })
          .eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, title: trimmed, imageUrl: image } : x)))
    },
    [spaceId],
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
      // DB cascades every member's placements of the item; mirror it locally.
      setItems((prev) => prev.filter((x) => x.id !== id))
      setPlacements((prev) => prev.filter((p) => p.itemId !== id))
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
      if (supabase && spaceId) {
        // 1. Create the tier item in the shared pool (lands on both unranked shelves).
        const { data: itemData, error: itemErr } = await supabase
          .from('tier_items')
          .insert({ space_id: spaceId, kind: wi.kind, title: wi.title, image_url: wi.imageUrl })
          .select(TIER_ITEM_COLUMNS)
          .single()
        if (itemErr) {
          setError(itemErr.message)
          return
        }
        const created = toTierItem(itemData as TierItemRow)
        setItems((prev) => (prev.some((x) => x.id === created.id) ? prev : [...prev, created]))
        // 2. Link the watchlist item to it (marks it done).
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
        createdBy: selfId,
        createdAt: new Date().toISOString(),
      }
      setItems((prev) => [...prev, created])
      setWatchlist((prev) => prev.map((w) => (w.id === wi.id ? { ...w, tierItemId: created.id } : w)))
    },
    [spaceId, selfId, resync],
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
    addWatchlistItem,
    updateWatchlistItem,
    deleteWatchlistItem,
    checkOffWatchlistItem,
    uncheckWatchlistItem,
  }
}
