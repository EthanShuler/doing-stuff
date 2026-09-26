import { useCallback, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Season, SeasonItem } from '../../types'
import { supabase } from '../../lib/supabase'
import { today } from '../../lib/format'
import { firstGrapheme } from '../../lib/text'
import {
  canNestUnder,
  cloneSeasonItems,
  isFixed,
  itemsOfSeason,
  nextPosition,
  positionAfter,
  pruneItem,
  pruneSeason,
} from './derive'
import type { SeasonDraft, SeasonItemDraft } from './derive'
import { SEED_SELF_ID, errorMessage, idFactory, syncTable, upsertById, useSpaceSync } from '../../data/spaceSync'

// Data seam for the Seasons feature (the seasonal bucket list), with the same
// two modes as every other store:
//   • Supabase keys present → live: reads/writes `seasons` + `season_items`
//     scoped to the space, streaming the partner's edits over one channel.
//   • No keys → an in-memory seed (the Fall 2026 list) so the whole UI can be
//     worked on offline.
//
// The store holds EVERY season's items; the page filters to one season, so
// switching seasons never refetches. Both tables are shared space data.
//
// Error style follows the lists store: modal actions (season create / edit /
// delete, item edit / delete) record the error AND throw so the modal stays
// open; inline flows (quick-add, duplicate, plan, check-off) record it and
// resync instead — addItem / duplicateItem resolve null on failure.

// --- Seed: the Fall 2026 list ---------------------------------------------------
// Same content and plan/done/fixed/by state as the live import SQL. Written
// as a spec (section › subsection › items, "children" = sub-options) and
// expanded with positions 1, 2, 3, … in list order, children right after
// their parent.

type SeedSpec = {
  title: string
  note?: string
  url?: string
  fixedOn?: string
  byOn?: string
  plannedOn?: string
  doneOn?: string
  children?: SeedSpec[]
}

const COLOR_MAP = 'https://www.dnr.state.mn.us/fall_colors/index.html'
const COLOR_NOTE = 'check the online color map!'

const FALL_2026: [section: string, subsection: string, items: SeedSpec[]][] = [
  ['Food', 'Baked goods', [
    { title: 'pumpkin bread', plannedOn: '2026-09-26' },
    { title: 'carmelita bars' },
    { title: 'ginger snaps' },
    { title: 'golden graham bars' },
    { title: 'apple cider donuts' },
  ]],
  ['Food', 'Meals', [
    { title: 'butternut squash something' },
    { title: 'pot pie' },
    { title: 'soups' },
    { title: 'sauerkraut? cabbage something…' },
  ]],
  ['Drinks', 'Alcoholic', [
    { title: 'mulled wine' },
    { title: 'hard cider', children: [
      { title: 'Sociable Cider Werks', note: 'hot mulled cider' },
      { title: 'Urban Forage Winery' },
    ] },
    { title: 'brewery' },
  ]],
  ['Drinks', 'NA', [{ title: 'apple cider' }, { title: 'chai tea' }]],
  ['Indoor', 'Movies', [{ title: 'Pirates of the Caribbean' }, { title: 'Harry Potter' }, { title: 'Twilight' }]],
  ['Indoor', 'TV', [{ title: 'Over the Garden Wall' }]],
  ['Indoor', 'Video games', [
    { title: 'Night in the Woods' },
    { title: 'Wizard101' },
    { title: 'It Takes Two', children: [{ title: 'It Takes Two sequel game', plannedOn: '2026-09-26' }] },
  ]],
  ['Indoor', 'Board games', [{ title: 'cribbage' }, { title: 'puzzle' }]],
  ['Indoor', 'Music', [{ title: "It's the Great Pumpkin, Charlie Brown – Vince Guaraldi" }]],
  ['Outdoor', 'Fall colors', [
    { title: 'color walk', note: COLOR_NOTE, url: COLOR_MAP, byOn: '2026-10-18' },
    { title: 'color drive', note: COLOR_NOTE, url: COLOR_MAP, byOn: '2026-10-18' },
    { title: 'UMN Landscape Arboretum', byOn: '2026-10-18' },
  ]],
  ['Outdoor', 'Fall produce', [
    { title: 'apple orchard', byOn: '2026-10-31', children: [{ title: 'Sweetland' }] },
    { title: 'pumpkin patch / carving pumpkins', byOn: '2026-10-31' },
    { title: 'acquire farm produce / baked goods' },
  ]],
  ['Halloween', '', [
    { title: 'costumed activity', byOn: '2026-10-31' },
    { title: 'halloween party', byOn: '2026-10-31' },
    { title: 'haunted house / hayride / maze', byOn: '2026-10-31' },
  ]],
  ['Event', '', [
    // Done on its day: planned too, so it shows checked on that weekend card.
    { title: 'ren faire', plannedOn: '2026-09-26', doneOn: '2026-09-26' },
    { title: 'oktoberfest', byOn: '2026-10-31', children: [{ title: "Waldmann's (St. Paul)" }] },
    { title: 'Bare Bones' },
    { title: 'Twin Cities Book Festival', fixedOn: '2026-11-07' },
  ]],
  ['Unsorted', '', [
    { title: 'Over the Garden Wall or a movie?', plannedOn: '2026-09-26' },
    { title: 'mulled wine / cider?', plannedOn: '2026-09-26' },
  ]],
]

export interface Snapshot {
  seasons: Season[]
  items: SeasonItem[]
}

/** The keyless-mode snapshot (exported for the derive tests). */
export function seed(): Snapshot {
  const seasonId = 'fall-2026'
  const createdAt = '2026-09-22T09:00:00Z'
  const items: SeasonItem[] = []
  let position = 0
  const push = (section: string, subsection: string, spec: SeedSpec, parentId: string | null) => {
    position += 1
    const id = `si${position}`
    items.push({
      id,
      seasonId,
      parentId,
      section,
      subsection,
      title: spec.title,
      note: spec.note ?? '',
      url: spec.url ?? '',
      position,
      fixedOn: spec.fixedOn ?? null,
      byOn: spec.byOn ?? null,
      plannedOn: spec.plannedOn ?? null,
      doneOn: spec.doneOn ?? null,
      createdBy: SEED_SELF_ID,
      createdAt,
    })
    for (const child of spec.children ?? []) push(section, subsection, child, id)
  }
  for (const [section, subsection, specs] of FALL_2026) for (const spec of specs) push(section, subsection, spec, null)
  return {
    seasons: [{ id: seasonId, name: 'Fall 2026', emoji: '🍂', startsOn: '2026-09-22', endsOn: '2026-11-15', createdBy: SEED_SELF_ID, createdAt }],
    items,
  }
}

// --- Row → app-type mappers (DB is snake_case) ---

type SeasonRow = {
  id: string
  name: string
  emoji: string
  starts_on: string
  ends_on: string
  created_by: string | null
  created_at: string
}
type SeasonItemRow = {
  id: string
  season_id: string
  parent_id: string | null
  section: string
  subsection: string
  title: string
  note: string
  url: string
  position: number
  fixed_on: string | null
  by_on: string | null
  planned_on: string | null
  done_on: string | null
  created_by: string | null
  created_at: string
}

const toSeason = (r: SeasonRow): Season => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji ?? '',
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  createdBy: r.created_by,
  createdAt: r.created_at,
})
const toSeasonItem = (r: SeasonItemRow): SeasonItem => ({
  id: r.id,
  seasonId: r.season_id,
  parentId: r.parent_id,
  section: r.section,
  subsection: r.subsection ?? '',
  title: r.title,
  note: r.note ?? '',
  url: r.url ?? '',
  position: r.position,
  fixedOn: r.fixed_on,
  byOn: r.by_on,
  plannedOn: r.planned_on,
  doneOn: r.done_on,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

/** App item → the DB's editable columns (everything but id / space /
 *  created_*). */
const itemColumns = (i: Omit<SeasonItem, 'id' | 'createdBy' | 'createdAt'>) => ({
  season_id: i.seasonId,
  parent_id: i.parentId,
  section: i.section,
  subsection: i.subsection,
  title: i.title,
  note: i.note,
  url: i.url,
  position: i.position,
  fixed_on: i.fixedOn,
  by_on: i.byOn,
  planned_on: i.plannedOn,
  done_on: i.doneOn,
})

const SEASON_COLUMNS = 'id,name,emoji,starts_on,ends_on,created_by,created_at'
const ITEM_COLUMNS =
  'id,season_id,parent_id,section,subsection,title,note,url,position,fixed_on,by_on,planned_on,done_on,created_by,created_at'

// In-memory fallback only: stable client ids for seed-mode edits.
const nextId = idFactory('sx', 500)

/** Section for an item saved with a blank one. */
export const DEFAULT_SECTION = 'Unsorted'

export interface NewSeasonDraft extends SeasonDraft {
  /** Clone this season's items (dates cleared) into the new one. */
  copyFromSeasonId?: string | null
}

export interface SeasonStore {
  /** Every season, in creation order (sort with sortSeasons for the picker). */
  seasons: Season[]
  /** Every season's items; the page filters with itemsOfSeason. */
  items: SeasonItem[]
  /** Who "you" are: the auth user, or the seed self in keyless mode. */
  selfId: string | null
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Create a season (optionally cloning another's items, dates cleared).
   *  Resolves the created row so the caller can navigate to it. Throws when
   *  the season itself fails; a failed copy records the error but still
   *  resolves the (empty) season. */
  addSeason: (draft: NewSeasonDraft) => Promise<Season>
  /** Rename / re-emoji / re-date a season. Throws on failure. */
  updateSeason: (id: string, draft: SeasonDraft) => Promise<void>
  /** Delete a season — one DB delete, Postgres cascades its items (mirrored
   *  locally with pruneSeason). Throws on failure. */
  deleteSeason: (id: string) => Promise<void>

  /** Add an item to the end of a season. Resolves the created item, or null
   *  when it failed (error recorded) — so a quick-add can keep its text. */
  addItem: (seasonId: string, draft: SeasonItemDraft) => Promise<SeasonItem | null>
  /** Edit an item. Throws on failure (the modal stays open). */
  updateItem: (id: string, draft: SeasonItemDraft) => Promise<void>
  /** Delete an item and (DB cascade, mirrored) its sub-options. Throws. */
  deleteItem: (id: string) => Promise<void>
  /** Copy an item — no planned / done date — right after the original.
   *  Resolves the copy, or null on failure (error recorded). */
  duplicateItem: (id: string) => Promise<SeasonItem | null>

  /** Put an item on a day (null = unplan). A fixed-date item can't be
   *  re-planned — a no-op. Inline: optimistic, resync on failure. */
  planItem: (id: string, date: string | null) => Promise<void>
  /** Check off (done today) / reopen. Inline: optimistic, resync on failure. */
  toggleDone: (id: string) => Promise<void>
}

/** Normalize a season draft: trimmed name, one emoji (🍂 when blank). */
function cleanSeasonDraft(draft: SeasonDraft) {
  const clean = {
    name: draft.name.trim(),
    emoji: firstGrapheme(draft.emoji) || '🍂',
    startsOn: draft.startsOn,
    endsOn: draft.endsOn,
  }
  if (!clean.name) throw new Error('A season needs a name.')
  if (!clean.startsOn || !clean.endsOn) throw new Error('A season needs a start and an end date.')
  if (clean.endsOn < clean.startsOn) throw new Error('A season can’t end before it starts.')
  return clean
}

export function useSeasonStore(spaceId: string | null, userId: string | null = null): SeasonStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [seasons, setSeasons] = useState<Season[]>(initial?.seasons ?? [])
  const [items, setItems] = useState<SeasonItem[]>(initial?.items ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  const selfId = supabase ? userId : SEED_SELF_ID

  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [ss, its] = await Promise.all([
      supabase.from('seasons').select(SEASON_COLUMNS).eq('space_id', spaceId).order('created_at'),
      supabase.from('season_items').select(ITEM_COLUMNS).eq('space_id', spaceId).order('position'),
    ])
    if (ss.error) throw ss.error
    if (its.error) throw its.error
    return {
      seasons: (ss.data as SeasonRow[]).map(toSeason),
      items: (its.data as SeasonItemRow[]).map(toSeasonItem),
    }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setSeasons(snap.seasons)
    setItems(snap.items)
  }, [])

  // Resync after a failed inline write: pull the truth back down.
  const resync = useCallback(() => {
    fetchAll()
      .then((snap) => {
        if (snap) applySnapshot(snap)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [fetchAll, applySnapshot])

  // Cascades (a season's items, an item's sub-options) arrive as their own
  // DELETE events — no special-casing.
  const wire = useCallback((channel: RealtimeChannel, spaceFilter: string) => {
    channel = syncTable(channel, spaceFilter, 'seasons', toSeason, setSeasons)
    channel = syncTable(channel, spaceFilter, 'season_items', toSeasonItem, setItems)
    return channel
  }, [])

  useSpaceSync({
    spaceId,
    channelPrefix: 'seasons',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  /** Normalize an item draft against the current items: trimmed text, blank
   *  section → Unsorted, a sub-option inherits its parent's section and
   *  subsection, and a fixed-date item carries no separate planned date.
   *  Throws on an invalid parent (nesting is one level deep). */
  const cleanItemDraft = useCallback(
    (draft: SeasonItemDraft, seasonId: string, itemId: string | null) => {
      const title = draft.title.trim()
      if (!title) throw new Error('An item needs a title.')
      let section = draft.section.trim() || DEFAULT_SECTION
      let subsection = draft.subsection.trim()
      const parentId = draft.parentId || null
      if (parentId) {
        if (!canNestUnder(items, itemId, parentId, seasonId)) {
          throw new Error('Sub-options go one level deep, under a top-level item of the same season.')
        }
        const parent = items.find((i) => i.id === parentId)!
        section = parent.section
        subsection = parent.subsection
      }
      const fixedOn = draft.fixedOn || null
      return {
        seasonId,
        parentId,
        section,
        subsection,
        title,
        note: draft.note.trim(),
        url: draft.url.trim(),
        fixedOn,
        byOn: draft.byOn || null,
        plannedOn: fixedOn ? null : draft.plannedOn || null,
      }
    },
    [items],
  )

  // --- Season actions (modal flows: record + throw) ---

  const addSeason = useCallback(
    async (draft: NewSeasonDraft): Promise<Season> => {
      setError(null)
      let clean
      try {
        clean = cleanSeasonDraft(draft)
      } catch (err) {
        setError(errorMessage(err))
        throw err
      }
      const source = draft.copyFromSeasonId ? itemsOfSeason(items, draft.copyFromSeasonId) : []
      const stamp = new Date().toISOString()
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('seasons')
          .insert({ space_id: spaceId, name: clean.name, emoji: clean.emoji, starts_on: clean.startsOn, ends_on: clean.endsOn })
          .select(SEASON_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const created = toSeason(data as SeasonRow)
        upsertById(setSeasons, created)
        if (source.length) {
          // Client-minted uuids let the clones reference each other's new ids
          // in one multi-row insert (FKs are checked at statement end).
          const clones = cloneSeasonItems(source, created.id, () => crypto.randomUUID(), selfId, stamp)
          const { data: rows, error: copyErr } = await supabase
            .from('season_items')
            .insert(clones.map((c) => ({ id: c.id, space_id: spaceId, ...itemColumns(c) })))
            .select(ITEM_COLUMNS)
          if (copyErr) setError(`Season created, but copying its items failed: ${copyErr.message}`)
          else for (const row of rows as SeasonItemRow[]) upsertById(setItems, toSeasonItem(row))
        }
        return created
      }
      const created: Season = { id: nextId(), ...clean, createdBy: selfId, createdAt: stamp }
      setSeasons((prev) => [...prev, created])
      if (source.length) {
        const clones = cloneSeasonItems(source, created.id, nextId, selfId, stamp)
        setItems((prev) => [...prev, ...clones])
      }
      return created
    },
    [spaceId, selfId, items],
  )

  const updateSeason = useCallback(
    async (id: string, draft: SeasonDraft) => {
      setError(null)
      let clean
      try {
        clean = cleanSeasonDraft(draft)
      } catch (err) {
        setError(errorMessage(err))
        throw err
      }
      if (supabase && spaceId) {
        const { error: err } = await supabase
          .from('seasons')
          .update({ name: clean.name, emoji: clean.emoji, starts_on: clean.startsOn, ends_on: clean.endsOn })
          .eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setSeasons((prev) => prev.map((s) => (s.id === id ? { ...s, ...clean } : s)))
    },
    [spaceId],
  )

  const deleteSeason = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('seasons').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setSeasons((prev) => prev.filter((s) => s.id !== id))
      setItems((prev) => pruneSeason(prev, id))
    },
    [spaceId],
  )

  // --- Item actions ---

  const addItem = useCallback(
    async (seasonId: string, draft: SeasonItemDraft): Promise<SeasonItem | null> => {
      setError(null)
      let clean
      try {
        clean = cleanItemDraft(draft, seasonId, null)
      } catch (err) {
        setError(errorMessage(err))
        return null
      }
      const fields = { ...clean, position: nextPosition(items, seasonId), doneOn: null }
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('season_items')
          .insert({ space_id: spaceId, ...itemColumns(fields) })
          .select(ITEM_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          return null
        }
        const created = toSeasonItem(data as SeasonItemRow)
        upsertById(setItems, created)
        return created
      }
      const created: SeasonItem = { id: nextId(), ...fields, createdBy: selfId, createdAt: new Date().toISOString() }
      setItems((prev) => [...prev, created])
      return created
    },
    [spaceId, selfId, items, cleanItemDraft],
  )

  const updateItem = useCallback(
    async (id: string, draft: SeasonItemDraft) => {
      setError(null)
      const existing = items.find((i) => i.id === id)
      if (!existing) return
      let clean
      try {
        clean = cleanItemDraft(draft, existing.seasonId, id)
      } catch (err) {
        setError(errorMessage(err))
        throw err
      }
      // A parent's section/subsection change carries its sub-options along,
      // so they never render under a heading their parent left.
      const moveChildren = clean.section !== existing.section || clean.subsection !== existing.subsection
      if (supabase && spaceId) {
        const { error: err } = await supabase
          .from('season_items')
          .update({
            parent_id: clean.parentId,
            section: clean.section,
            subsection: clean.subsection,
            title: clean.title,
            note: clean.note,
            url: clean.url,
            fixed_on: clean.fixedOn,
            by_on: clean.byOn,
            planned_on: clean.plannedOn,
          })
          .eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
        if (moveChildren) {
          const { error: childErr } = await supabase
            .from('season_items')
            .update({ section: clean.section, subsection: clean.subsection })
            .eq('parent_id', id)
          if (childErr) setError(childErr.message)
        }
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, ...clean }
            : moveChildren && i.parentId === id
              ? { ...i, section: clean.section, subsection: clean.subsection }
              : i,
        ),
      )
    },
    [spaceId, items, cleanItemDraft],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('season_items').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      // The DB cascades the sub-options; mirror it now.
      setItems((prev) => pruneItem(prev, id))
    },
    [spaceId],
  )

  const duplicateItem = useCallback(
    async (id: string): Promise<SeasonItem | null> => {
      setError(null)
      const original = items.find((i) => i.id === id)
      if (!original) return null
      const fields = {
        seasonId: original.seasonId,
        parentId: original.parentId,
        section: original.section,
        subsection: original.subsection,
        title: original.title,
        note: original.note,
        url: original.url,
        position: positionAfter(items, id),
        fixedOn: original.fixedOn,
        byOn: original.byOn,
        plannedOn: null,
        doneOn: null,
      }
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('season_items')
          .insert({ space_id: spaceId, ...itemColumns(fields) })
          .select(ITEM_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          return null
        }
        const created = toSeasonItem(data as SeasonItemRow)
        upsertById(setItems, created)
        return created
      }
      const created: SeasonItem = { id: nextId(), ...fields, createdBy: selfId, createdAt: new Date().toISOString() }
      setItems((prev) => [...prev, created])
      return created
    },
    [spaceId, selfId, items],
  )

  // --- Inline flows: optimistic first, resync on failure ---

  const planItem = useCallback(
    async (id: string, date: string | null) => {
      const item = items.find((i) => i.id === id)
      if (!item || isFixed(item)) return
      setError(null)
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, plannedOn: date } : i)))
      if (!supabase || !spaceId) return
      const { error: err } = await supabase.from('season_items').update({ planned_on: date }).eq('id', id)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, items, resync],
  )

  const toggleDone = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id)
      if (!item) return
      setError(null)
      const doneOn = item.doneOn ? null : today()
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, doneOn } : i)))
      if (!supabase || !spaceId) return
      const { error: err } = await supabase.from('season_items').update({ done_on: doneOn }).eq('id', id)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, items, resync],
  )

  return {
    seasons,
    items,
    selfId,
    loading,
    error,
    clearError,
    addSeason,
    updateSeason,
    deleteSeason,
    addItem,
    updateItem,
    deleteItem,
    duplicateItem,
    planItem,
    toggleDone,
  }
}
