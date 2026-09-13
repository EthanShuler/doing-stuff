import { useCallback, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ListDef, ListItem, ListRef } from '../../types'
import { supabase } from '../../lib/supabase'
import { today } from '../../lib/format'
import { firstGrapheme } from '../../lib/text'
import { renormalizedPositions } from '../../lib/order'
import { datesArePersonal } from '../tier-list/derive'
import { kindColumn, listIdOf, nextPosition, pruneListDef, refOf } from './derive'
import type { ListDefDraft } from './ListDefModal'
import { SEED_SELF_ID, errorMessage, idFactory, syncTable, upsertById, useSpaceSync } from '../../data/spaceSync'

// Data seam for the Lists feature, with the same two modes as every other
// store:
//   • Supabase keys present → live: reads/writes `lists` + `list_items` scoped
//     to the space, streaming the partner's edits over one realtime channel.
//   • No keys → an in-memory seed so the whole UI can be worked on offline.
//
// The store holds EVERY list's rows; the page filters to one ref at a time, so
// switching Movies ↔ TV ↔ Groceries never refetches.
//
// Two things about the rows are worth keeping in mind:
//
//  • The book reading list is PER PERSON. Rows are owned via `created_by`, RLS
//    lets only the owner write a book row, and the page shows only the
//    viewer's. Every other list is shared.
//  • "Done" is two different columns. A movie/TV/book row is done once
//    checking it off has created its `tier_items` row and linked it
//    (`tier_item_id`); a free-form row has no board, so it just stamps
//    `done_on`. Deleting that tier item later REOPENS the row — the DB's
//    `on delete set null` fires, and the cascaded UPDATE arrives here as an
//    ordinary realtime UPDATE on `list_items`, so nothing cross-table is read.

interface Snapshot {
  /** The space's free-form lists ("Groceries"), in creation order. */
  lists: ListDef[]
  /** Every list's rows — the page filters by ref. */
  items: ListItem[]
}

function seed(): Snapshot {
  return {
    lists: [{ id: 'g1', name: 'Groceries', emoji: '🛒', createdBy: 'u1', createdAt: '2026-09-01T09:00:00Z' }],
    items: [
      // Movies — the shared watchlist, one row already checked off.
      { id: 'w1', key: 'movie', title: 'Dune: Part Two', imageUrl: '', creator: 'Denis Villeneuve', position: 1, tierItemId: null, doneOn: null, createdBy: 'u1', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'w2', key: 'movie', title: 'Past Lives', imageUrl: '', creator: 'Celine Song', position: 2, tierItemId: null, doneOn: null, createdBy: 'u2', createdAt: '2026-09-02T10:00:00Z' },
      // Checked off: it made tier item m6 (the tier board's own seed store —
      // see checkOff below on why the two seeds don't talk to each other).
      { id: 'w5', key: 'movie', title: 'Everything Everywhere All at Once', imageUrl: '', creator: '', position: 3, tierItemId: 'm6', doneOn: null, createdBy: 'u1', createdAt: '2026-09-03T10:00:00Z' },
      { id: 'w3', key: 'tv', title: 'The Bear', imageUrl: '', creator: 'Christopher Storer', position: 1, tierItemId: null, doneOn: null, createdBy: 'u1', createdAt: '2026-09-01T11:00:00Z' },
      // Books are a PER-PERSON list: w4 is the seed viewer's (u1), w6 is the
      // partner's — so the personal filter is demoable offline.
      { id: 'w4', key: 'book', title: 'The Priory of the Orange Tree', imageUrl: '', creator: 'Samantha Shannon', position: 1, tierItemId: null, doneOn: null, createdBy: 'u1', createdAt: '2026-09-01T12:00:00Z' },
      { id: 'w6', key: 'book', title: 'Babel', imageUrl: '', creator: 'R. F. Kuang', position: 2, tierItemId: null, doneOn: null, createdBy: 'u2', createdAt: '2026-09-02T12:00:00Z' },
      // The free-form list: one open row, one stamped done.
      { id: 'w7', key: 'custom:g1', title: 'Oat milk', imageUrl: '', creator: '', position: 1, tierItemId: null, doneOn: null, createdBy: 'u1', createdAt: '2026-09-04T09:00:00Z' },
      { id: 'w8', key: 'custom:g1', title: 'Coffee beans', imageUrl: '', creator: 'the dark roast', position: 2, tierItemId: null, doneOn: '2026-09-05', createdBy: 'u2', createdAt: '2026-09-04T10:00:00Z' },
    ],
  }
}

// --- Row → app-type mappers (DB is snake_case) ---

type ListRow = {
  id: string
  name: string
  emoji: string | null
  created_by: string | null
  created_at: string
}
type ListItemRow = {
  id: string
  kind: string
  list_id: string | null
  title: string
  image_url: string | null
  creator: string | null
  position: number
  tier_item_id: string | null
  done_on: string | null
  created_by: string | null
  created_at: string
}

const toListDef = (r: ListRow): ListDef => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji ?? '',
  createdBy: r.created_by,
  createdAt: r.created_at,
})
const toListItem = (r: ListItemRow): ListItem => ({
  id: r.id,
  // The DB splits the list across two columns; the app carries one ref.
  key: refOf(r.kind, r.list_id),
  title: r.title,
  imageUrl: r.image_url ?? '',
  creator: r.creator ?? '',
  position: r.position,
  tierItemId: r.tier_item_id,
  doneOn: r.done_on,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const LIST_COLUMNS = 'id,name,emoji,created_by,created_at'
const LIST_ITEM_COLUMNS = 'id,kind,list_id,title,image_url,creator,position,tier_item_id,done_on,created_by,created_at'

// In-memory fallback only: stable client ids for seed-mode edits.
const nextId = idFactory('lx', 500)

export interface ListStore {
  /** The space's free-form lists, oldest first (picker pill order). */
  lists: ListDef[]
  /** Every list's rows; the page filters by ref. */
  items: ListItem[]
  /** Who "you" are: the auth user, or the seed self in keyless mode. Books
   *  are filtered against this. */
  selfId: string | null
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Create a free-form list. Resolves the created row so the caller can
   *  navigate to it. Throws on failure (the modal stays open). */
  addList: (draft: ListDefDraft) => Promise<ListDef>
  /** Rename / re-emoji a list. Throws on failure. */
  updateList: (id: string, draft: ListDefDraft) => Promise<void>
  /** Delete a list — ONE DB delete; Postgres cascades its rows. Mirrored
   *  locally with pruneListDef. Throws on failure. */
  deleteList: (id: string) => Promise<void>

  /** Add a row to the bottom of a list's queue. Resolves false when the write
   *  failed, so the quick-add input can put the text back. */
  addItem: (ref: ListRef, title: string, imageUrl: string, creator: string) => Promise<boolean>
  /** Edit a row's title / image / creator. Throws (the modal stays open). */
  updateItem: (id: string, title: string, imageUrl: string, creator: string) => Promise<void>
  /** Remove a row. Throws on failure. */
  deleteItem: (id: string) => Promise<void>

  /** A drag settled: move one open row to this queue position. Inline flow —
   *  records the error and resyncs instead of throwing. */
  moveItem: (id: string, position: number) => Promise<void>
  /** Float precision ran out — rewrite the open queue at integer positions. */
  renormalize: (orderedIds: string[]) => Promise<void>

  /** Check a row off. Movie/TV/book: creates the shared tier item (dated
   *  today) and links to it, so it lands on the board's unranked shelf.
   *  Free-form: stamps today's date on the row. Inline flow. */
  checkOff: (item: ListItem) => Promise<void>
  /** Reopen a checked row. Any tier item it made stays on the board. */
  uncheck: (item: ListItem) => Promise<void>
}

/** Normalize a list draft for saving: trimmed name, exactly one emoji. */
const cleanListDraft = (draft: ListDefDraft) => ({
  name: draft.name.trim(),
  emoji: firstGrapheme(draft.emoji),
})

export function useListStore(spaceId: string | null, userId: string | null = null): ListStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [lists, setLists] = useState<ListDef[]>(initial?.lists ?? [])
  const [items, setItems] = useState<ListItem[]>(initial?.items ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  const selfId = supabase ? userId : SEED_SELF_ID

  // Fetch one full snapshot (live mode only). Shared by the initial load, the
  // resync after a realtime reconnect, and the recovery after a failed inline
  // write. No profiles: nothing here shows who added a row.
  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [ls, its] = await Promise.all([
      supabase.from('lists').select(LIST_COLUMNS).eq('space_id', spaceId).order('created_at'),
      supabase.from('list_items').select(LIST_ITEM_COLUMNS).eq('space_id', spaceId).order('position'),
    ])
    if (ls.error) throw ls.error
    if (its.error) throw its.error
    return {
      lists: (ls.data as ListRow[]).map(toListDef),
      items: (its.data as ListItemRow[]).map(toListItem),
    }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setLists(snap.lists)
    setItems(snap.items)
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

  // Wire this store's tables onto the realtime channel (see useSpaceSync). A
  // cascaded delete (a list's rows) needs no special-casing — the DB emits the
  // dependent deletes as their own events; so does the `set null` that reopens
  // a row whose tier item was deleted, as a plain UPDATE.
  const wire = useCallback((channel: RealtimeChannel, spaceFilter: string) => {
    channel = syncTable(channel, spaceFilter, 'lists', toListDef, setLists)
    channel = syncTable(channel, spaceFilter, 'list_items', toListItem, setItems)
    return channel
  }, [])

  useSpaceSync({
    spaceId,
    channelPrefix: 'lists',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  // --- List actions. A free-form list row is shared space data (uniform RLS),
  //     so either member can create, rename, or delete one. All three throw so
  //     the modal can stay open. ---

  const addList = useCallback(
    async (draft: ListDefDraft): Promise<ListDef> => {
      const clean = cleanListDraft(draft)
      setError(null)
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('lists')
          .insert({ space_id: spaceId, ...clean })
          .select(LIST_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const created = toListDef(data as ListRow)
        // upsert, not append: the realtime echo of this write may land first.
        upsertById(setLists, created)
        return created
      }
      const created: ListDef = { id: nextId(), ...clean, createdBy: selfId, createdAt: new Date().toISOString() }
      setLists((prev) => [...prev, created])
      return created
    },
    [spaceId, selfId],
  )

  const updateList = useCallback(
    async (id: string, draft: ListDefDraft) => {
      const clean = cleanListDraft(draft)
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('lists').update(clean).eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...clean } : l)))
    },
    [spaceId],
  )

  const deleteList = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('lists').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      // One DB delete; Postgres cascades the list's rows. Those deletes arrive
      // as their own realtime events, but mirror them now so this tab doesn't
      // render a list of orphans for a beat.
      setLists((prev) => prev.filter((l) => l.id !== id))
      setItems((prev) => pruneListDef(prev, id))
    },
    [spaceId],
  )

  // --- Row actions. addItem is inline (the quick-add field keeps the text on
  //     failure); update/delete throw so the edit modal can stay open. ---

  const addItem = useCallback(
    async (ref: ListRef, title: string, imageUrl: string, creator: string): Promise<boolean> => {
      const trimmed = title.trim()
      if (!trimmed) return false
      setError(null)
      const image = imageUrl.trim()
      const maker = creator.trim()
      // New rows join the back of the queue (the top is "next up").
      const position = nextPosition(items, ref)
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('list_items')
          // kind + list_id always travel together — the DB CHECK ties them, so
          // a missed site fails as a store error, never as bad data.
          .insert({ space_id: spaceId, kind: kindColumn(ref), list_id: listIdOf(ref), title: trimmed, image_url: image, creator: maker, position })
          .select(LIST_ITEM_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          return false
        }
        upsertById(setItems, toListItem(data as ListItemRow))
        return true
      }
      setItems((prev) => [
        ...prev,
        { id: nextId(), key: ref, title: trimmed, imageUrl: image, creator: maker, position, tierItemId: null, doneOn: null, createdBy: selfId, createdAt: new Date().toISOString() },
      ])
      return true
    },
    [spaceId, selfId, items],
  )

  const updateItem = useCallback(
    async (id: string, title: string, imageUrl: string, creator: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      const maker = creator.trim()
      if (supabase && spaceId) {
        const { error: err } = await supabase
          .from('list_items')
          .update({ title: trimmed, image_url: image, creator: maker })
          .eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setItems((prev) => prev.map((w) => (w.id === id ? { ...w, title: trimmed, imageUrl: image, creator: maker } : w)))
    },
    [spaceId],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('list_items').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setItems((prev) => prev.filter((w) => w.id !== id))
    },
    [spaceId],
  )

  // --- Reorder (drag) actions. Inline flows: optimistic local move first; on
  //     failure record the error and resync — the row snaps back and the
  //     banner says why. ---

  const moveItem = useCallback(
    async (id: string, position: number) => {
      setError(null)
      setItems((prev) => prev.map((w) => (w.id === id ? { ...w, position } : w)))
      if (!supabase || !spaceId) return
      const { error: err } = await supabase.from('list_items').update({ position }).eq('id', id)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, resync],
  )

  const renormalize = useCallback(
    async (orderedIds: string[]) => {
      setError(null)
      const rewrites = renormalizedPositions(orderedIds)
      const positionById = new Map(rewrites.map((r) => [r.itemId, r.position]))
      setItems((prev) => prev.map((w) => (positionById.has(w.id) ? { ...w, position: positionById.get(w.id)! } : w)))
      if (!supabase || !spaceId) return
      // Row-by-row updates: unlike placements there's no upsert target that
      // wouldn't need every NOT NULL column. Rare path (float precision ran
      // out), tiny lists — sequential is fine.
      for (const { itemId, position } of rewrites) {
        const { error: err } = await supabase.from('list_items').update({ position }).eq('id', itemId)
        if (err) {
          setError(err.message)
          resync()
          return
        }
      }
    },
    [spaceId, resync],
  )

  // Rows with a check-off in flight: local state stays unchanged until the
  // insert round-trips, so without this a double-click on a slow connection
  // would create two pool items for one row.
  const checkingOff = useRef<Set<string>>(new Set())

  const checkOff = useCallback(
    async (item: ListItem) => {
      // Already done (or mid-check-off) — nothing to do.
      if (item.tierItemId || item.doneOn || checkingOff.current.has(item.id)) return
      checkingOff.current.add(item.id)
      try {
        setError(null)

        // A free-form list has no board to promote onto: the row just gets a
        // date stamp of its own.
        if (listIdOf(item.key)) {
          const stamp = today()
          setItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, doneOn: stamp } : w)))
          if (!supabase || !spaceId) return
          const { error: err } = await supabase.from('list_items').update({ done_on: stamp }).eq('id', item.id)
          if (err) {
            setError(err.message)
            resync()
          }
          return
        }

        // Movie / TV / book: checking off means "just finished it" → dated
        // today. For movies/TV that's the tier item's SHARED watched date;
        // for books it's the CHECKER's own completion row, so the partner's
        // copy lands on their Unread shelf.
        //
        // Past the free-form branch above, the ref is a built-in — and a
        // built-in ListRef is spelled exactly like the matching board's
        // ListKey, which is what lets the tier feature's date switch read it.
        const boardKey = item.key as 'movie' | 'tv' | 'book'
        const personal = datesArePersonal(boardKey)
        if (supabase && spaceId) {
          // 1. Create the tier item in the shared pool.
          const { data: itemData, error: itemErr } = await supabase
            .from('tier_items')
            .insert({
              space_id: spaceId,
              kind: boardKey,
              list_id: null,
              title: item.title,
              image_url: item.imageUrl,
              creator: item.creator,
              done_on: personal ? null : today(),
            })
            .select('id')
            .single()
          if (itemErr) {
            setError(itemErr.message)
            return
          }
          const tierItemId = (itemData as { id: string }).id
          // 2. Your own completion record (books). The tier item exists either
          //    way, so a failure here only surfaces the banner.
          if (personal && selfId) {
            const { error: compErr } = await supabase
              .from('tier_item_completions')
              .upsert(
                { space_id: spaceId, item_id: tierItemId, user_id: selfId, done_on: today() },
                { onConflict: 'item_id,user_id' },
              )
            if (compErr) setError(compErr.message)
          }
          // 3. Link the row to it (which is what marks it done).
          const { error: linkErr } = await supabase
            .from('list_items')
            .update({ tier_item_id: tierItemId })
            .eq('id', item.id)
          if (linkErr) {
            // The tier item exists; the link write failed. Surface it and
            // resync so local state matches the DB.
            setError(linkErr.message)
            resync()
            return
          }
          setItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, tierItemId } : w)))
          return
        }

        // Seed mode: stamp a fake tier item id so the row reads as done. The
        // tier boards run a SEPARATE in-memory store, so no card actually
        // appears over there until a reload against a real backend.
        const fakeTierItemId = nextId()
        setItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, tierItemId: fakeTierItemId } : w)))
      } finally {
        checkingOff.current.delete(item.id)
      }
    },
    [spaceId, selfId, resync],
  )

  const uncheck = useCallback(
    async (item: ListItem) => {
      setError(null)
      // Reopen the row; any tier item it created stays on the board.
      setItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, tierItemId: null, doneOn: null } : w)))
      if (!supabase || !spaceId) return
      const { error: err } = await supabase
        .from('list_items')
        .update({ tier_item_id: null, done_on: null })
        .eq('id', item.id)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, resync],
  )

  return {
    lists,
    items,
    selfId,
    loading,
    error,
    clearError,
    addList,
    updateList,
    deleteList,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    renormalize,
    checkOff,
    uncheck,
  }
}
