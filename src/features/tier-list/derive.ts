import type { Tier, TierItem, TierKind, TierPlacement, TierRead, WatchlistItem } from '../../types'
import type { PaletteSwatch } from '../../theme'
import { swatchFor } from '../../theme'
import { distinctTagList, tagKey, tagMatcher } from '../../lib/tags'

/** The fixed ladder, best first — drives row order and drop-target ids. */
export const TIERS: readonly Tier[] = ['S', 'A', 'B', 'C', 'D', 'F']

/** A droppable container on the board: a tier row, the unranked shelf, or the
 *  unwatched (for books: unread) shelf. */
export type ContainerId = Tier | 'unranked' | 'unwatched'

/**
 * Whether a kind's watched/read dates belong to one person rather than the
 * shared item. Movies and TV are watched together, so `watchedOn` lives on the
 * pool item; books are read separately, so each member's date is their own
 * TierRead row and the shared date is ignored. Ice cream is tried together —
 * shared like movies/TV — but shows no dates in the UI: `watchedOn` is just
 * its tried/not-tried marker (see `usesDates` in copy.ts).
 */
export const datesArePersonal = (kind: TierKind): boolean => kind === 'book'

/**
 * Whether a kind's "want to" list belongs to one person rather than the space.
 * Movies, TV, and ice cream are watched/tried together, so their watchlists
 * are shared; books are read separately, so each member keeps their own
 * reading list — the UI shows only rows whose `createdBy` is the viewer, and
 * RLS lets only the owner write a book's row.
 */
export const listIsPersonal = (kind: TierKind): boolean => kind === 'book'

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
export function distinctTags(items: TierItem[], kind: TierKind): string[] {
  return distinctTagList(items.filter((item) => item.kind === kind).map((item) => item.tags))
}

/** Keep the items matching the include/exclude tag selections (shared
 *  semantics — see tagMatcher in src/lib/tags.ts). */
export function filterByTags(items: TierItem[], included: string[], excluded: string[]): TierItem[] {
  if (included.length === 0 && excluded.length === 0) return items
  const matches = tagMatcher(included, excluded)
  return items.filter((item) => matches(item.tags))
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
 * "Have a date" is per kind: movies/TV read the shared `watchedOn`; books look
 * for the VIEWER's own read row, so the same book can be ranked on one board
 * and unread on the other. A placement always wins: a ranked item stays in its
 * tier even if its date is cleared. Placements and reads referencing missing
 * items — or belonging to other viewers — are ignored.
 */
export function deriveBoard(
  items: TierItem[],
  placements: TierPlacement[],
  reads: TierRead[],
  viewerId: string | null,
  kind: TierKind,
): Board {
  const placementByItem = new Map<string, TierPlacement>()
  for (const p of placements) {
    if (p.userId === viewerId) placementByItem.set(p.itemId, p)
  }
  const personal = datesArePersonal(kind)
  const readItems = new Set<string>()
  if (personal) {
    for (const r of reads) {
      if (r.userId === viewerId) readItems.add(r.itemId)
    }
  }

  const tiers: Record<Tier, { item: TierItem; placement: TierPlacement }[]> = {
    S: [], A: [], B: [], C: [], D: [], F: [],
  }
  const unranked: TierItem[] = []
  const unwatched: TierItem[] = []

  for (const item of items) {
    if (item.kind !== kind) continue
    const placement = placementByItem.get(item.id)
    const dated = personal ? readItems.has(item.id) : item.watchedOn !== null
    if (placement) tiers[placement.tier].push({ item, placement })
    else if (!dated) unwatched.push(item)
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

/**
 * Midpoint position for inserting between two neighbors (null = no neighbor
 * on that side). Returns null when float precision is exhausted — the caller
 * should then renormalize the whole tier instead.
 */
export function positionBetween(before: number | null, after: number | null): number | null {
  if (before === null && after === null) return 1
  if (before === null) return (after as number) - 1
  if (after === null) return before + 1
  const mid = (before + after) / 2
  if (mid <= before || mid >= after) return null
  return mid
}

/** Rewrite a tier's ordering at clean integer positions (renormalize path). */
export function renormalizedPositions(itemIds: string[]): { itemId: string; position: number }[] {
  return itemIds.map((itemId, i) => ({ itemId, position: i + 1 }))
}

// --- Watchlist ordering -------------------------------------------------------
// The list is a priority queue: open items sort by `position` (top = watch/
// read/try next; drag to reorder via the same midpoint-insertion scheme as
// tier placements). Checked-off items sink below the open ones, keeping their
// queue order so unchecking restores an item's old slot.

/** Order one kind's watchlist for display: open first, then by position, with
 *  createdAt (then id) breaking ties — e.g. legacy rows all at position 0. */
export function sortWatchlist(items: WatchlistItem[]): WatchlistItem[] {
  const rank = (w: WatchlistItem) => (w.tierItemId === null ? 0 : 1)
  return [...items].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (a.position !== b.position) return a.position - b.position
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

/** Position that appends a new wish at the bottom of one kind's queue. */
export function nextWatchlistPosition(items: WatchlistItem[], kind: TierKind): number {
  let max = 0
  for (const w of items) {
    if (w.kind === kind && w.position > max) max = w.position
  }
  return max + 1
}
