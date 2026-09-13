import type { ListItem, ListRef } from '../../types'

// Pure data shaping for the Lists feature: which list a row is on, whether a
// row is done, and the order the rows render in. No React, no Supabase.

// --- List refs ---------------------------------------------------------------
// A list is identified app-side by a ListRef: one of the three built-ins, or
// `custom:<lists.id>`. The DB stores that as two columns — `kind` ('custom'
// for a free-form list) and a nullable `list_id` — so these four converters
// are the only place the two shapes meet. (Same trick as the tier feature's
// `list:` keys, deliberately a DIFFERENT prefix: those point at `tier_lists`.)

/** The ref for a free-form list. */
export const refFor = (listId: string): ListRef => `custom:${listId}`

/** The `lists.id` behind a ref, or null for a built-in. */
export const listIdOf = (ref: ListRef): string | null =>
  ref.startsWith('custom:') ? ref.slice('custom:'.length) : null

/** What goes in the row's `kind` column: the built-in kind, or 'custom'. */
export const kindColumn = (ref: ListRef): string => (listIdOf(ref) ? 'custom' : ref)

/** Rebuild a ref from a row's two columns (the mapper's side of kindColumn /
 *  listIdOf). A 'custom' row without a list_id can't happen — the DB CHECK
 *  ties them together — but if one ever did it would key to a list nobody can
 *  route to, which is the safe direction. */
export const refOf = (kind: string, listId: string | null): ListRef =>
  listId ? refFor(listId) : (kind as ListRef)

/**
 * Whether a list belongs to ONE person rather than the space. Movies, TV and
 * free-form lists are shared — either member adds and checks off. Books are
 * read separately, so each member keeps their own reading list: the UI shows
 * only rows the viewer created, and RLS lets only the owner write one.
 */
export const listIsPersonal = (ref: ListRef): boolean => ref === 'book'

/**
 * Whether a row has been done. The two halves are per kind and never both
 * set: a movie/TV/book row is done once it has promoted itself onto the tier
 * board (`tierItemId`); a free-form row has no board to land on, so it just
 * carries its own date stamp.
 */
export const isDone = (item: ListItem): boolean => item.tierItemId !== null || item.doneOn !== null

/**
 * Display order: the open queue on top — position order, lowest first, so the
 * top is what you'll do next — then the done rows, keeping their old queue
 * slots (so unchecking one puts it back where it was). Ties (legacy rows all
 * at position 0) break by createdAt, oldest first. Never mutates the input.
 */
export function sortListItems(items: ListItem[]): ListItem[] {
  const rank = (item: ListItem) => (isDone(item) ? 1 : 0)
  return [...items].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (a.position !== b.position) return a.position - b.position
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

/** Position that appends a new row at the bottom of one list's queue. */
export function nextPosition(items: ListItem[], ref: ListRef): number {
  let max = 0
  for (const item of items) {
    if (item.key === ref && item.position > max) max = item.position
  }
  return max + 1
}

// --- Deleting a list ---------------------------------------------------------

/** Drop a deleted free-form list's rows from a store snapshot — the local
 *  mirror of the DB cascade (`lists` → `list_items`). Rows on other lists are
 *  untouched; the list row itself is removed by the caller. */
export function pruneListDef(items: ListItem[], listId: string): ListItem[] {
  const ref = refFor(listId)
  return items.filter((item) => item.key !== ref)
}
