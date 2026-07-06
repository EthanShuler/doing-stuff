import type { Tier, TierItem, TierKind, TierPlacement } from '../../types'
import type { PaletteSwatch } from '../../theme'
import { swatchFor } from '../../theme'

/** The fixed ladder, best first — drives row order and drop-target ids. */
export const TIERS: readonly Tier[] = ['S', 'A', 'B', 'C', 'D', 'F']

/** A droppable container on the board: a tier row or the unranked shelf. */
export type ContainerId = Tier | 'unranked'

/** Palette index per tier — a classic hot→cool ramp through the theme swatches. */
const TIER_COLOR_INDEX: Record<Tier, number> = { S: 5, A: 1, B: 3, C: 0, D: 4, F: 2 }

export function tierSwatch(tier: Tier): PaletteSwatch {
  return swatchFor(TIER_COLOR_INDEX[tier])
}

/** One viewer's board: items per tier (in ranked order) + the unranked shelf. */
export interface Board {
  tiers: Record<Tier, TierItem[]>
  unranked: TierItem[]
}

/**
 * Build one person's board for one kind. Items the viewer hasn't placed land
 * on the unranked shelf (oldest first, so new additions appear at the end).
 * Placements referencing missing items — or belonging to other viewers — are
 * ignored.
 */
export function deriveBoard(
  items: TierItem[],
  placements: TierPlacement[],
  viewerId: string | null,
  kind: TierKind,
): Board {
  const placementByItem = new Map<string, TierPlacement>()
  for (const p of placements) {
    if (p.userId === viewerId) placementByItem.set(p.itemId, p)
  }

  const tiers: Record<Tier, { item: TierItem; placement: TierPlacement }[]> = {
    S: [], A: [], B: [], C: [], D: [], F: [],
  }
  const unranked: TierItem[] = []

  for (const item of items) {
    if (item.kind !== kind) continue
    const placement = placementByItem.get(item.id)
    if (placement) tiers[placement.tier].push({ item, placement })
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
  const board: Board = { tiers: { S: [], A: [], B: [], C: [], D: [], F: [] }, unranked }
  for (const tier of TIERS) {
    board.tiers[tier] = tiers[tier].sort(byPosition).map((x) => x.item)
  }
  unranked.sort((a, b) => (a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? -1 : 1) : a.id < b.id ? -1 : 1))
  return board
}

/** List the items in one container of a board. */
export function containerItems(board: Board, container: ContainerId): TierItem[] {
  return container === 'unranked' ? board.unranked : board.tiers[container]
}

/**
 * Resolve a drag id (a card's item id or a container's own id) to the
 * container it lives in. Undefined when the id matches nothing on the board.
 */
export function findContainer(board: Board, id: string): ContainerId | undefined {
  if (id === 'unranked' || (TIERS as readonly string[]).includes(id)) return id as ContainerId
  for (const tier of TIERS) {
    if (board.tiers[tier].some((item) => item.id === id)) return tier
  }
  if (board.unranked.some((item) => item.id === id)) return 'unranked'
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
  const next: Board = { tiers: { ...board.tiers }, unranked: board.unranked }
  for (const tier of TIERS) next.tiers[tier] = without(next.tiers[tier])
  next.unranked = without(next.unranked)

  const target = containerItems(next, to).slice()
  const clamped = Math.max(0, Math.min(index, target.length))
  target.splice(clamped, 0, item)
  if (to === 'unranked') next.unranked = target
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
