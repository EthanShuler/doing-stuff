import type { SpaceInfo } from './useSpace'

// Keyless seed mode's spaces: two in-memory spaces so the switcher, feature
// gating and the admin page are demoable (and testable) with no backend.
//
// The feature stores still see a null space id in seed mode (useSpace's
// `dataSpaceId`), so both spaces show the same per-feature seed data — only
// the nav, the hub and the route gates differ.
//
// The FIRST space must keep `enabledFeatures: null` (every feature on): the
// existing e2e specs hard-load every feature route and expect it to render.
//
// useSpace re-reads this array on `reload()`, so an in-memory admin seed can
// edit it in place (push a space, change a space's features) and then call
// the space context's `reload()` to see the nav follow.
export const SEED_SPACES: SpaceInfo[] = [
  { id: 'seed-home', name: 'Our city, together', enabledFeatures: null },
  { id: 'seed-friends', name: 'Friends', enabledFeatures: ['tier-lists', 'lists', 'recipes', 'seasons'] },
]

/** The keyless viewer is an admin, so the Admin menu item and page are
 *  reachable in seed mode. */
export const SEED_IS_ADMIN = true

/** Who belongs to each seed space (user ids, join order) — the admin page's
 *  in-memory membership, edited in place like SEED_SPACES. Only the admin
 *  page reads it: the seed viewer is shown every seed space regardless, and
 *  the feature seeds keep their own two members (spaceSync's SEED_PROFILES). */
export const SEED_MEMBERS: Record<string, string[]> = {
  'seed-home': ['u1', 'u2'],
  'seed-friends': ['u1', 'u2'],
}
