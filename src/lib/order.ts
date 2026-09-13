// Fractional ordering shared by every hand-ordered list in the app (tier
// placements, the watch/reading list queue). A row stores a float `position`;
// inserting between two neighbors takes their midpoint, so one drop is one
// row write. Floats eventually run out of room between two neighbors, which
// is what the renormalize path is for.

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
