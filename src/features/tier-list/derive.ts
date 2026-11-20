import type { ListKey, Profile, Tier, TierItem, TierList, TierPlacement, TierCompletion, TierUserTags } from '../../types'
import type { PaletteSwatch } from '../../theme'
import { swatchFor } from '../../theme'
import { distinctTagList, tagKey, tagMatcher } from '../../lib/tags'
import { displayNameFor } from '../../lib/profile'
import { originOf } from '../../lib/lineage'
import { titleKey } from '../../lib/text'

/** The fixed ladder, best first — drives row order and drop-target ids. */
export const TIERS: readonly Tier[] = ['S', 'A', 'B', 'C', 'D', 'F']

/** A droppable container on the board: a tier row, the unranked shelf, or the
 *  unwatched (books: unread, games: unplayed) shelf — which a custom list's board doesn't
 *  have at all (see hasUndatedShelf). */
export type ContainerId = Tier | 'unranked' | 'unwatched'

/** Just the two shelves — the collapsible containers under the tier rows. */
export type ShelfId = Exclude<ContainerId, Tier>

// --- List keys ---------------------------------------------------------------
// A board is identified app-side by a ListKey: one of the built-in kinds,
// or `list:<tier_lists.id>`. The DB stores that as two columns — `kind`
// ('custom' for a space-defined list) and a nullable `list_id` — so these four
// converters are the only place the two shapes meet.

/** The key for a space-defined list's board. */
export const listKeyFor = (listId: string): ListKey => `list:${listId}`

/** The `tier_lists.id` behind a key, or null for a built-in kind. */
export const listIdOf = (key: ListKey): string | null =>
  key.startsWith('list:') ? key.slice('list:'.length) : null

/** What goes in the row's `kind` column: the built-in kind, or 'custom'. */
export const kindColumn = (key: ListKey): string => (listIdOf(key) ? 'custom' : key)

/** Rebuild a key from a row's two columns (the mapper's side of kindColumn /
 *  listIdOf). A 'custom' row without a list_id can't happen — the DB CHECK
 *  ties them together — but if one ever did it would key to a board nobody
 *  can route to, which is the safe direction. */
export const keyOf = (kind: string, listId: string | null): ListKey =>
  listId ? listKeyFor(listId) : (kind as ListKey)

/**
 * Whether a kind's "done with it" date belongs to one person rather than the
 * shared item. Movies and TV are watched together, so `TierItem.doneOn` (the
 * shared date) is the truth; books and games are read / played separately, so
 * each member's date is their own TierCompletion row and the shared one is
 * ignored. A custom
 * list ("Ice Cream") has no date of either sort — see hasUndatedShelf below.
 */
export const datesArePersonal = (key: ListKey): boolean => key === 'book' || key === 'game'

/**
 * Whether a board has the second, undated shelf beneath the tiers (Unwatched,
 * Unread for books, Unplayed for games) — the built-in kinds do. A custom list ("Ice
 * Cream") tracks no "done with it" date in the UI, so an item there is either
 * ranked or Unranked and its shared `doneOn` is ignored entirely.
 * `copy.dates === null` is the wording side of this same switch.
 */
export const hasUndatedShelf = (key: ListKey): boolean => listIdOf(key) === null

/**
 * Whether a board's items carry a release year — the built-in kinds (movies,
 * TV, books, games) do, and their title searches fill it. A custom list's
 * items ("Mint chocolate chip") have none, so its modal shows no field.
 */
export const tracksReleaseYear = (key: ListKey): boolean => listIdOf(key) === null

/** A card's faint second line: the year FIRST (the card is narrow and clamps
 *  to one line, so the short part must survive), then who made it. */
export const cardByline = (item: Pick<TierItem, 'creator' | 'releaseYear'>): string =>
  [item.releaseYear ? String(item.releaseYear) : '', item.creator].filter(Boolean).join(' · ')

// --- Shared boards -------------------------------------------------------------
// A custom list can be `shared`: ONE board the space ranks together instead of
// a board per person. Its placements carry a null userId (the DB's unique
// (item_id, user_id) treats nulls as equal, so it's still one row per item),
// and RLS lets either member write them. Built-in boards are never shared.

/** Whether a key's board is the space's single shared one. False for the
 *  built-ins and for a list row that's gone. */
export function isSharedBoard(key: ListKey, lists: TierList[]): boolean {
  const listId = listIdOf(key)
  if (!listId) return false
  return lists.find((l) => l.id === listId)?.shared ?? false
}

/** Whose placement rows a board reads and writes: the viewer's own, or —
 *  on a shared board — the space's null-owner rows. */
export const placementOwner = (shared: boolean, viewerId: string | null): string | null =>
  shared ? null : viewerId

// --- Whose board ---------------------------------------------------------------
// Every member has their own board on a per-person list; the page picks one
// to show. `profiles` holds everyone RLS lets you see — co-members of ANY of
// your spaces — so the candidates come from THIS space's membership instead.

/** One pickable board: whose it is and what the picker calls it. */
export interface BoardViewer {
  id: string
  label: string
}

/** The boards to pick from: "You" first, then the space's other members in
 *  join order, each named by their profile ("Member" when it has no name).
 *  Empty with no signed-in self. */
export function boardViewers(memberIds: string[], profiles: Profile[], selfId: string | null): BoardViewer[] {
  if (!selfId) return []
  const others = [...new Set(memberIds)]
    .filter((id) => id !== selfId)
    .map((id) => ({ id, label: displayNameFor(profiles.find((p) => p.id === id)) || 'Member' }))
  return [{ id: selfId, label: 'You' }, ...others]
}

/** Palette index per tier — a classic hot→cool ramp through the theme swatches. */
const TIER_COLOR_INDEX: Record<Tier, number> = { S: 5, A: 1, B: 3, C: 0, D: 4, F: 2 }

export function tierSwatch(tier: Tier): PaletteSwatch {
  return swatchFor(TIER_COLOR_INDEX[tier])
}

// --- Tags -------------------------------------------------------------------
// Tags are free text shared on the pool item ("disney", "fantasy"). All tag
// comparisons here are case-insensitive so "Disney" and "disney" behave as one
// tag even if both spellings were saved (shared helpers in src/lib/tags.ts).

/** Clean a tag list for saving: trim, drop blanks, dedupe case-insensitively
 *  (first spelling wins). */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const trimmed = tag.trim()
    const key = tagKey(trimmed)
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/** Every tag in use on one kind's items, deduped case-insensitively (first
 *  spelling seen wins) and sorted alphabetically. Drives the filter pills and
 *  the item modal's suggestions. */
export function distinctTags(items: TierItem[], key: ListKey): string[] {
  return distinctTagList(items.filter((item) => item.kind === key).map((item) => item.tags))
}

/** Keep the items matching the include/exclude tag selections (shared
 *  semantics — see tagMatcher in src/lib/tags.ts). */
export function filterByTags(items: TierItem[], included: string[], excluded: string[]): TierItem[] {
  if (included.length === 0 && excluded.length === 0) return items
  const matches = tagMatcher(included, excluded)
  return items.filter((item) => matches(item.tags))
}

// --- Personal tags ------------------------------------------------------------
// Each member's own labels for an item ("comfort", "rewatch") live in
// TierUserTags rows, one per (item, member). Only the VIEWER's own ever show —
// even on the partner's board, "Mine" filters by your tags.

/** One member's tags per item id (items they haven't tagged are absent). */
export function userTagMap(rows: TierUserTags[], userId: string | null): Map<string, string[]> {
  return new Map(rows.filter((r) => r.userId === userId).map((r) => [r.itemId, r.tags]))
}

/** One member's tags on one kind's items, deduped and sorted like
 *  distinctTags. Drives the "Mine" pill row and the modal's suggestions. */
export function distinctUserTags(items: TierItem[], rows: TierUserTags[], userId: string | null, key: ListKey): string[] {
  const mine = userTagMap(rows, userId)
  return distinctTagList(items.filter((item) => item.kind === key).map((item) => mine.get(item.id) ?? []))
}

/** filterByTags over one member's personal tags instead of the shared ones. */
export function filterByUserTags(
  items: TierItem[],
  rows: TierUserTags[],
  userId: string | null,
  included: string[],
  excluded: string[],
): TierItem[] {
  if (included.length === 0 && excluded.length === 0) return items
  const mine = userTagMap(rows, userId)
  const matches = tagMatcher(included, excluded)
  return items.filter((item) => matches(mine.get(item.id) ?? []))
}

/** One viewer's board: items per tier (in ranked order) + the two shelves. */
export interface Board {
  tiers: Record<Tier, TierItem[]>
  unranked: TierItem[]
  unwatched: TierItem[]
}

/**
 * Build one person's board for one kind. Items the viewer hasn't placed land
 * on a shelf — the unwatched/unread shelf when they have no date, otherwise
 * the unranked shelf (both oldest first, so new additions appear at the end).
 * A board with no undated shelf (a custom list) skips that split: everything
 * the viewer hasn't placed is unranked.
 * "Have a date" is per kind: movies/TV read the item's shared `doneOn`; books
 * look for the VIEWER's own completion row, so the same book can be ranked on
 * one board and unread on the other. A placement always wins: a ranked item
 * stays in its tier even if its date is cleared. Placements and completions
 * referencing missing items — or belonging to other viewers — are ignored.
 *
 * `shared` builds the space's one shared board instead: the null-owner
 * placements count and every member's personal ones are ignored. Without it
 * a null viewer (no session) matches no placements at all.
 */
export function deriveBoard(
  items: TierItem[],
  placements: TierPlacement[],
  completions: TierCompletion[],
  viewerId: string | null,
  key: ListKey,
  shared = false,
): Board {
  const owner = placementOwner(shared, viewerId)
  const placementByItem = new Map<string, TierPlacement>()
  if (shared || owner !== null) {
    for (const p of placements) {
      if (p.userId === owner) placementByItem.set(p.itemId, p)
    }
  }
  const personal = datesArePersonal(key)
  const undatedShelf = hasUndatedShelf(key)
  const completedItems = new Set<string>()
  if (personal) {
    for (const r of completions) {
      if (r.userId === viewerId) completedItems.add(r.itemId)
    }
  }

  const tiers: Record<Tier, { item: TierItem; placement: TierPlacement }[]> = {
    S: [], A: [], B: [], C: [], D: [], F: [],
  }
  const unranked: TierItem[] = []
  const unwatched: TierItem[] = []

  for (const item of items) {
    if (item.kind !== key) continue
    const placement = placementByItem.get(item.id)
    const dated = personal ? completedItems.has(item.id) : item.doneOn !== null
    if (placement) tiers[placement.tier].push({ item, placement })
    else if (undatedShelf && !dated) unwatched.push(item)
    else unranked.push(item)
  }

  const byPosition = (
    a: { item: TierItem; placement: TierPlacement },
    b: { item: TierItem; placement: TierPlacement },
  ) => {
    if (a.placement.position !== b.placement.position) return a.placement.position - b.placement.position
    if (a.item.createdAt !== b.item.createdAt) return a.item.createdAt < b.item.createdAt ? -1 : 1
    return a.item.id < b.item.id ? -1 : 1
  }
  const board: Board = { tiers: { S: [], A: [], B: [], C: [], D: [], F: [] }, unranked, unwatched }
  for (const tier of TIERS) {
    board.tiers[tier] = tiers[tier].sort(byPosition).map((x) => x.item)
  }
  const byCreation = (a: TierItem, b: TierItem) =>
    a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? -1 : 1) : a.id < b.id ? -1 : 1
  unranked.sort(byCreation)
  unwatched.sort(byCreation)
  return board
}

/** List the items in one container of a board. */
export function containerItems(board: Board, container: ContainerId): TierItem[] {
  if (container === 'unranked') return board.unranked
  if (container === 'unwatched') return board.unwatched
  return board.tiers[container]
}

/**
 * Resolve a drag id (a card's item id or a container's own id) to the
 * container it lives in. Undefined when the id matches nothing on the board.
 */
export function findContainer(board: Board, id: string): ContainerId | undefined {
  if (id === 'unranked' || id === 'unwatched' || (TIERS as readonly string[]).includes(id)) {
    return id as ContainerId
  }
  for (const tier of TIERS) {
    if (board.tiers[tier].some((item) => item.id === id)) return tier
  }
  if (board.unranked.some((item) => item.id === id)) return 'unranked'
  if (board.unwatched.some((item) => item.id === id)) return 'unwatched'
  return undefined
}

/**
 * Move an item to `index` within `to`, returning a new board (inputs are never
 * mutated). Used for the optimistic board surgery during a drag. An out-of-range
 * index clamps; the item must exist somewhere on the board.
 */
export function moveItem(
  board: Board,
  itemId: string,
  from: ContainerId,
  to: ContainerId,
  index: number,
): Board {
  const source = containerItems(board, from)
  const item = source.find((i) => i.id === itemId)
  if (!item) return board

  const without = (list: TierItem[]) => list.filter((i) => i.id !== itemId)
  const next: Board = { tiers: { ...board.tiers }, unranked: board.unranked, unwatched: board.unwatched }
  for (const tier of TIERS) next.tiers[tier] = without(next.tiers[tier])
  next.unranked = without(next.unranked)
  next.unwatched = without(next.unwatched)

  const target = containerItems(next, to).slice()
  const clamped = Math.max(0, Math.min(index, target.length))
  target.splice(clamped, 0, item)
  if (to === 'unranked') next.unranked = target
  else if (to === 'unwatched') next.unwatched = target
  else next.tiers[to] = target
  return next
}

// --- Deleting a list ---------------------------------------------------------

/** The ids of every pool item on one custom list. */
export function itemIdsOnList(items: TierItem[], listId: string): Set<string> {
  const key = listKeyFor(listId)
  return new Set(items.filter((item) => item.kind === key).map((item) => item.id))
}

/** Drop the rows (placements or completions) that belong to any of `itemIds`. */
export function dropItemRows<R extends { itemId: string }>(rows: R[], itemIds: Set<string>): R[] {
  return rows.filter((row) => !itemIds.has(row.itemId))
}

/**
 * Drop everything belonging to one custom list from a store snapshot — the
 * local mirror of the DB cascade (`tier_lists` → `tier_items` → placements /
 * completions). Rows on other boards are untouched; the list row itself is
 * removed by the caller. The store applies the same two helpers slice by
 * slice through functional updaters, so a write that lands mid-delete isn't
 * clobbered.
 */
export function pruneList<
  S extends {
    items: TierItem[]
    placements: TierPlacement[]
    completions: TierCompletion[]
  },
>(state: S, listId: string): S {
  const gone = itemIdsOnList(state.items, listId)
  return {
    ...state,
    items: state.items.filter((item) => !gone.has(item.id)),
    placements: dropItemRows(state.placements, gone),
    completions: dropItemRows(state.completions, gone),
  }
}

// --- Pulling boards from another space ------------------------------------------
// A pull copies one person's boards from another space they belong to into
// this one (see "Why copy-with-origin" in the plan): the source's pool items
// are DUPLICATED here with `copiedFrom` = their root origin (lib/lineage.ts),
// never linked. Pulling again is an idempotent merge — lineage (then title)
// finds what's already here, and only what's new is written. Pull never edits
// an existing item here (its title, shared tags, or date); it only adds items
// and the puller's OWN rankings, read dates and personal tags.

/** What the pull reads from the other space — the shape of the store's
 *  fetchPullSource: its lists and pool, plus only the PULLER's own personal
 *  rows (placements, completions, tags) and the null-owner placements of its
 *  shared lists. Never anyone else's opinions. */
export interface TierPullData {
  lists: TierList[]
  items: TierItem[]
  placements: TierPlacement[]
  completions: TierCompletion[]
  userTags: TierUserTags[]
}

/** One source board, ready to plan: its items, and the puller's rows on it —
 *  placements chosen by the SOURCE list's mode (the puller's own, or the
 *  null-owner rows when that list is shared). */
export interface TierPullSource {
  key: ListKey
  /** The source's list row for a custom board; null for a built-in. */
  list: TierList | null
  items: TierItem[]
  placements: TierPlacement[]
  completions: TierCompletion[]
  userTags: TierUserTags[]
}

/** The space being pulled INTO — the store's slices. */
export type TierPullTarget = TierPullData

export interface TierPullOptions {
  /** Also bring items the puller hasn't ranked there (as items only).
   *  Default: ranked items only. */
  includeUnranked?: boolean
}

export interface TierPullSummary {
  /** Custom lists created here (no match by lineage or name). */
  listsAdded: number
  /** Pool items copied in. */
  itemsAdded: number
  /** Source items that were already here (by lineage, else title). */
  itemsMatched: number
  /** Rankings written. */
  rankingsAdded: number
  /** Rankings skipped because the item is already ranked here (for that
   *  owner) — a pull never moves a card you've placed. */
  rankingsKept: number
  /** Items whose personal tags gained something. */
  tagsMerged: number
  /** Book read dates (the puller's own completions) added. */
  datesAdded: number
}

export interface TierPullPlan {
  /** The board here the source maps onto; null only when a custom list would
   *  have to be created but nothing would land on it. */
  targetKey: ListKey | null
  newList: TierList | null
  newItems: TierItem[]
  newPlacements: TierPlacement[]
  newCompletions: TierCompletion[]
  /** Personal tag rows to write: an existing row's id with the union, or a
   *  new id. Upserted on (itemId, userId). */
  userTagUpserts: TierUserTags[]
  summary: TierPullSummary
}

export const EMPTY_PULL_SUMMARY: TierPullSummary = {
  listsAdded: 0,
  itemsAdded: 0,
  itemsMatched: 0,
  rankingsAdded: 0,
  rankingsKept: 0,
  tagsMerged: 0,
  datesAdded: 0,
}

const byCreated = <R extends { id: string; createdAt: string }>(a: R, b: R) =>
  a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/** Slice one board out of a fetched source. Placements are picked by the
 *  source list's mode: on a shared list the null-owner rows, else the
 *  puller's own (the fetch already left everyone else's out; this re-checks). */
export function tierPullSource(data: TierPullData, key: ListKey, selfId: string): TierPullSource {
  const listId = listIdOf(key)
  const list = listId ? (data.lists.find((l) => l.id === listId) ?? null) : null
  const items = data.items.filter((item) => item.kind === key)
  const ids = new Set(items.map((item) => item.id))
  const owner = placementOwner(list?.shared ?? false, selfId)
  return {
    key,
    list,
    items,
    placements: data.placements.filter((p) => ids.has(p.itemId) && p.userId === owner),
    completions: data.completions.filter((r) => ids.has(r.itemId) && r.userId === selfId),
    userTags: data.userTags.filter((r) => ids.has(r.itemId) && r.userId === selfId),
  }
}

/** One board in the pull checklist: how many items it has there, and how
 *  many of them the puller has ranked (what a default pull brings). */
export interface TierPullChoice {
  key: ListKey
  list: TierList | null
  total: number
  ranked: number
}

/** The source's boards for the checklist: the four built-ins, then its own
 *  lists in creation order. */
export function tierPullChoices(data: TierPullData, selfId: string): TierPullChoice[] {
  const keys: ListKey[] = ['movie', 'tv', 'book', 'game', ...[...data.lists].sort(byCreated).map((l) => listKeyFor(l.id))]
  return keys.map((key) => {
    const source = tierPullSource(data, key, selfId)
    return { key, list: source.list, total: source.items.length, ranked: source.placements.length }
  })
}

/** The source board matching the board on screen here, to pre-tick: the same
 *  built-in, or the source list this custom list matches (lineage, else
 *  name). Empty when the source has no counterpart. */
export function defaultPullKeys(data: TierPullData, currentKey: ListKey, targetLists: TierList[]): ListKey[] {
  const listId = listIdOf(currentKey)
  if (!listId) return [currentKey]
  const here = targetLists.find((l) => l.id === listId)
  if (!here) return []
  const lists = [...data.lists].sort(byCreated)
  const match =
    lists.find((l) => originOf(l) === originOf(here)) ?? lists.find((l) => titleKey(l.name) === titleKey(here.name))
  return match ? [listKeyFor(match.id)] : []
}

/**
 * Plan pulling ONE source board into this space. Pure: `newId` mints row ids
 * and `now` (ISO) stamps new rows. The rules:
 *
 * - **Which items:** the ones the puller ranked there; with `includeUnranked`
 *   every item on the board (unranked ones come over as items only).
 * - **List:** a custom board maps onto the list here with the same origin,
 *   else the same name (any case, oldest first), else a new list (name,
 *   emoji, noun, `shared`, `copiedFrom`). Copied items carry the TARGET
 *   list's id — never the source's, or deleting the source list would
 *   cascade into this space.
 * - **Item mapping is injective:** lineage first (equal origins), then title
 *   (titleKey) on the same board, each target item claimed at most once,
 *   source items taken in `createdAt` order. Leftovers become new copies —
 *   title, image, creator, shared tags, `copiedFrom` = root origin, and NO
 *   `doneOn` (the source's shared date means "that group finished it"). Their
 *   `createdAt` steps by 1 ms in source order so the Unranked shelf keeps it.
 * - **Rankings:** owner = placementOwner(target list's mode, selfId). An item
 *   already ranked here for that owner keeps its spot (rankingsKept); the rest
 *   append after that tier's last card for that owner on this board, in
 *   source order within each tier.
 * - **Books:** the puller's own read date, only where they have none here.
 *   Never an item's shared `doneOn`.
 * - **Personal tags:** the union with the puller's tags here.
 * - Existing items here are never edited.
 */
export function planTierPull(
  source: TierPullSource,
  target: TierPullTarget,
  selfId: string,
  newId: () => string,
  now: string,
  opts: TierPullOptions = {},
): TierPullPlan {
  const summary: TierPullSummary = { ...EMPTY_PULL_SUMMARY }
  const empty = (targetKey: ListKey | null): TierPullPlan => ({
    targetKey,
    newList: null,
    newItems: [],
    newPlacements: [],
    newCompletions: [],
    userTagUpserts: [],
    summary,
  })

  const sourcePlacement = new Map(source.placements.map((p) => [p.itemId, p]))
  const considered = source.items
    .filter((item) => item.kind === source.key && (opts.includeUnranked || sourcePlacement.has(item.id)))
    .sort(byCreated)

  // --- The board here ---
  let targetList: TierList | null = null
  let newList: TierList | null = null
  if (listIdOf(source.key)) {
    if (!source.list) throw new Error('planTierPull: a custom board needs its list row')
    const from = source.list
    const lists = [...target.lists].sort(byCreated)
    targetList =
      lists.find((l) => originOf(l) === originOf(from)) ??
      lists.find((l) => titleKey(l.name) === titleKey(from.name)) ??
      null
    if (!targetList) {
      // Nothing would land on it — don't create an empty list.
      if (considered.length === 0) return empty(null)
      newList = {
        id: newId(),
        name: from.name,
        emoji: from.emoji,
        noun: from.noun,
        shared: from.shared,
        copiedFrom: originOf(from),
        createdBy: selfId,
        createdAt: now,
      }
      targetList = newList
      summary.listsAdded = 1
    }
  }
  const targetKey: ListKey = targetList ? listKeyFor(targetList.id) : source.key
  if (considered.length === 0) return empty(targetKey)

  // --- Item mapping: lineage, then title; each target item claimed once ---
  const candidates = target.items.filter((item) => item.kind === targetKey).sort(byCreated)
  const claimed = new Set<string>()
  const mapped = new Map<string, TierItem>()
  const claim = (matches: (candidate: TierItem, sourceItem: TierItem) => boolean) => {
    for (const s of considered) {
      if (mapped.has(s.id)) continue
      const hit = candidates.find((c) => !claimed.has(c.id) && matches(c, s))
      if (!hit) continue
      claimed.add(hit.id)
      mapped.set(s.id, hit)
    }
  }
  claim((c, s) => originOf(c) === originOf(s))
  claim((c, s) => titleKey(c.title) === titleKey(s.title))
  summary.itemsMatched = mapped.size

  const base = Date.parse(now)
  const newItems: TierItem[] = []
  for (const s of considered) {
    if (mapped.has(s.id)) continue
    const copy: TierItem = {
      id: newId(),
      kind: targetKey,
      title: s.title,
      imageUrl: s.imageUrl,
      doneOn: null,
      tags: normalizeTags(s.tags),
      creator: s.creator,
      releaseYear: s.releaseYear,
      copiedFrom: originOf(s),
      createdBy: selfId,
      createdAt: new Date(base + newItems.length).toISOString(),
    }
    newItems.push(copy)
    mapped.set(s.id, copy)
  }
  summary.itemsAdded = newItems.length

  // --- Rankings ---
  const owner = placementOwner(targetList?.shared ?? false, selfId)
  const onBoard = new Set(candidates.map((c) => c.id))
  const placedHere = new Set<string>()
  const lastPosition: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const p of target.placements) {
    if (p.userId !== owner || !onBoard.has(p.itemId)) continue
    placedHere.add(p.itemId)
    lastPosition[p.tier] = Math.max(lastPosition[p.tier], p.position)
  }
  const ranked = considered
    .filter((s) => sourcePlacement.has(s.id))
    .map((s) => ({ s, p: sourcePlacement.get(s.id)! }))
    .sort((a, b) => {
      const tierOrder = TIERS.indexOf(a.p.tier) - TIERS.indexOf(b.p.tier)
      if (tierOrder !== 0) return tierOrder
      if (a.p.position !== b.p.position) return a.p.position - b.p.position
      return byCreated(a.s, b.s)
    })
  const newPlacements: TierPlacement[] = []
  for (const { s, p } of ranked) {
    const here = mapped.get(s.id)!
    if (placedHere.has(here.id)) {
      summary.rankingsKept += 1
      continue
    }
    lastPosition[p.tier] += 1
    newPlacements.push({ id: newId(), itemId: here.id, userId: owner, tier: p.tier, position: lastPosition[p.tier] })
  }
  summary.rankingsAdded = newPlacements.length

  // --- Books: the puller's own read date, insert-if-absent ---
  const newCompletions: TierCompletion[] = []
  if (datesArePersonal(targetKey)) {
    for (const s of considered) {
      const mine = source.completions.find((r) => r.itemId === s.id && r.userId === selfId)
      if (!mine) continue
      const here = mapped.get(s.id)!
      if (target.completions.some((r) => r.itemId === here.id && r.userId === selfId)) continue
      newCompletions.push({ id: newId(), itemId: here.id, userId: selfId, doneOn: mine.doneOn })
    }
  }
  summary.datesAdded = newCompletions.length

  // --- Personal tags: union ---
  const userTagUpserts: TierUserTags[] = []
  for (const s of considered) {
    const mine = source.userTags.find((r) => r.itemId === s.id && r.userId === selfId)
    if (!mine || mine.tags.length === 0) continue
    const here = mapped.get(s.id)!
    const existing = target.userTags.find((r) => r.itemId === here.id && r.userId === selfId)
    const before = normalizeTags(existing?.tags ?? [])
    const merged = normalizeTags([...before, ...mine.tags])
    if (merged.length === before.length) continue
    userTagUpserts.push({ id: existing?.id ?? newId(), itemId: here.id, userId: selfId, tags: merged })
  }
  summary.tagsMerged = userTagUpserts.length

  return { targetKey, newList, newItems, newPlacements, newCompletions, userTagUpserts, summary }
}

/** True when a plan writes nothing (matches alone don't count). */
export const isEmptyTierPullPlan = (plan: TierPullPlan): boolean =>
  plan.newList === null &&
  plan.newItems.length === 0 &&
  plan.newPlacements.length === 0 &&
  plan.newCompletions.length === 0 &&
  plan.userTagUpserts.length === 0

/** Fold a plan into the target, the way the writes land: lists and items
 *  appended, placements and completions insert-if-absent on (itemId, userId),
 *  personal tags replaced on (itemId, userId). Seed mode applies plans with
 *  this, and the multi-board planner chains through it. */
export function applyTierPullPlan<T extends TierPullTarget>(target: T, plan: TierPullPlan): T {
  const has = (rows: { itemId: string; userId: string | null }[], r: { itemId: string; userId: string | null }) =>
    rows.some((x) => x.itemId === r.itemId && x.userId === r.userId)
  return {
    ...target,
    lists: plan.newList ? [...target.lists, plan.newList] : target.lists,
    items: [...target.items, ...plan.newItems],
    placements: [...target.placements, ...plan.newPlacements.filter((p) => !has(target.placements, p))],
    completions: [...target.completions, ...plan.newCompletions.filter((r) => !has(target.completions, r))],
    userTags: [
      ...target.userTags.filter((r) => !has(plan.userTagUpserts, r)),
      ...plan.userTagUpserts,
    ],
  }
}

/** Plan several source boards in order, each against the target as the
 *  earlier plans leave it — so two source lists folding into one list here
 *  (or a re-ticked board) can't double up. New items' timestamps keep
 *  stepping across boards. */
export function planTierPulls(
  data: TierPullData,
  keys: ListKey[],
  target: TierPullTarget,
  selfId: string,
  newId: () => string,
  now: string,
  opts: TierPullOptions = {},
): TierPullPlan[] {
  const plans: TierPullPlan[] = []
  let state = target
  let added = 0
  const base = Date.parse(now)
  for (const key of keys) {
    const plan = planTierPull(tierPullSource(data, key, selfId), state, selfId, newId, new Date(base + added).toISOString(), opts)
    added += plan.newItems.length
    state = applyTierPullPlan(state, plan)
    plans.push(plan)
  }
  return plans
}

/** Add up several boards' summaries. */
export function sumTierPullSummaries(plans: TierPullPlan[]): TierPullSummary {
  const total = { ...EMPTY_PULL_SUMMARY }
  for (const { summary } of plans) {
    for (const k of Object.keys(total) as (keyof TierPullSummary)[]) total[k] += summary[k]
  }
  return total
}

const counted = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "42 rankings · 30 new items · 12 already here · 5 you've ranked here left
 *  alone" — the non-zero parts only; '' when nothing would be written. */
export function tierPullSummaryLine(s: TierPullSummary): string {
  if (s.listsAdded + s.itemsAdded + s.rankingsAdded + s.datesAdded + s.tagsMerged === 0) return ''
  const parts: string[] = []
  if (s.listsAdded) parts.push(counted(s.listsAdded, 'new list'))
  if (s.rankingsAdded) parts.push(counted(s.rankingsAdded, 'ranking'))
  if (s.itemsAdded) parts.push(counted(s.itemsAdded, 'new item'))
  if (s.itemsMatched) parts.push(`${s.itemsMatched} already here`)
  if (s.rankingsKept) parts.push(`${s.rankingsKept} you've ranked here left alone`)
  if (s.datesAdded) parts.push(counted(s.datesAdded, 'read date'))
  if (s.tagsMerged) parts.push(`your tags on ${counted(s.tagsMerged, 'item')}`)
  return parts.join(' · ')
}
