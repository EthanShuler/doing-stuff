import { useState } from 'react'

// The tri-state filter behind every filter pill row (Log / Calendar / Map
// categories, tier-board and recipe tags, parks, little-guy owners). Each pill
// is off, include, or exclude: includes are OR (the pills widen, not narrow),
// and anything carrying an excluded key is dropped even if it also matches an
// include. A click cycles off → include → exclude → off; a right-click runs
// the same cycle backwards (off → exclude → include → off), so excluding is
// one click.

export type TriState = 'include' | 'exclude'
/** Pill key → its state. A key that's absent is off. */
export type TriFilterState = Record<string, TriState>

export type CycleDirection = 'forward' | 'back'

const FORWARD: Record<string, TriState | undefined> = { off: 'include', include: 'exclude', exclude: undefined }
const BACK: Record<string, TriState | undefined> = { off: 'exclude', exclude: 'include', include: undefined }

/** Step one pill through its cycle. Pure — returns a new state object. */
export function cycleTri(state: TriFilterState, key: string, direction: CycleDirection): TriFilterState {
  const next = { ...state }
  const to = (direction === 'forward' ? FORWARD : BACK)[state[key] ?? 'off']
  if (to) next[key] = to
  else delete next[key]
  return next
}

/** The keys currently in one state, e.g. every included tag. */
export function keysIn(state: TriFilterState, which: TriState): string[] {
  return Object.keys(state).filter((key) => state[key] === which)
}

/** Drop pills whose key no longer exists (a deleted category, a member who
 *  left) so a stale include can't strand an empty view with its pill gone. */
export function pickKeys(state: TriFilterState, keys: Iterable<string>): TriFilterState {
  const next: TriFilterState = {}
  for (const key of keys) if (state[key]) next[key] = state[key]
  return next
}

/** The filter predicate over a row's keys (its tags, its owner, …). Rows with
 *  no keys survive an exclude-only filter but not an include filter; an empty
 *  state matches everything. */
export function keysMatcher(included: Iterable<string>, excluded: Iterable<string>): (keys: string[]) => boolean {
  const wanted = new Set(included)
  const banned = new Set(excluded)
  return (keys) => {
    if (keys.some((key) => banned.has(key))) return false
    return wanted.size === 0 || keys.some((key) => wanted.has(key))
  }
}

/** keysMatcher for a whole state object. */
export function triMatcher(state: TriFilterState): (keys: string[]) => boolean {
  return keysMatcher(keysIn(state, 'include'), keysIn(state, 'exclude'))
}

/** Pill-row state for one tri-state filter. Pair with TriPill for the pills. */
export function useTriFilter() {
  const [state, setState] = useState<TriFilterState>({})
  return {
    state,
    setState,
    active: Object.keys(state).length > 0,
    cycle: (key: string) => setState((prev) => cycleTri(prev, key, 'forward')),
    cycleBack: (key: string) => setState((prev) => cycleTri(prev, key, 'back')),
    clear: () => setState({}),
  }
}
