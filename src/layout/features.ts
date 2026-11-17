/** The top-level features — one entry per feature, not one per route. The
 *  header nav and the home hub (`/`) both render from this list (filtered to
 *  what the current space has turned on — see `enabledFeatures`), so a new
 *  feature shows up in both by adding it here.
 *
 *  `path` is where the feature lands; `matches` are the route prefixes that
 *  light up its nav item (a match also claims its sub-paths, so /recipes/:id
 *  lights up Recipes and every /lists/* route lights up Lists). Doing Stuff
 *  spans four routes, Tier Lists four boards, and Lists three built-ins plus
 *  the space's own (an in-page picker chooses between them, see PickerRow).
 *  The unbuilt placeholder routes (/french-toast, /board-games, /cats) still
 *  exist in App.tsx but are off the nav and aren't features. */
export interface Feature {
  /** Stable id. A space's `enabled_features` stores these, so NEVER rename a
   *  key — every space that turned it on would silently lose it. */
  key: string
  label: string
  path: string
  matches: string[]
  /** The hub row's one-line description. */
  blurb: string
}

export const FEATURES: Feature[] = [
  {
    key: 'doing-stuff',
    label: 'Doing Stuff',
    path: '/log',
    matches: ['/log', '/wishlist', '/map', '/calendar'],
    blurb: 'Outings, wishlist, map',
  },
  {
    key: 'tier-lists',
    label: 'Tier Lists',
    path: '/movies',
    matches: ['/movies', '/tv', '/books', '/tiers'],
    blurb: 'Rank movies, TV, books',
  },
  { key: 'lists', label: 'Lists', path: '/lists/movies', matches: ['/lists'], blurb: 'Watchlists, groceries' },
  { key: 'recipes', label: 'Recipes', path: '/recipes', matches: ['/recipes'], blurb: 'Cookbook, meal plan' },
  { key: 'parks', label: 'Parks', path: '/parks', matches: ['/parks'], blurb: 'The 63 national parks' },
  { key: 'spoons', label: 'Spoons', path: '/spoons', matches: ['/spoons'], blurb: 'Souvenir spoons' },
  {
    key: 'little-guys',
    label: 'Little Guys',
    path: '/little-guys',
    matches: ['/little-guys'],
    blurb: 'The little guy shelf',
  },
  { key: 'alignment', label: 'Alignment', path: '/alignment', matches: ['/alignment'], blurb: 'Alignment charts' },
  {
    key: 'music-practice',
    label: 'Music Practice',
    path: '/music-practice',
    matches: ['/music-practice'],
    blurb: 'Bassoon, piano',
  },
  { key: 'seasons', label: 'Seasons', path: '/seasons', matches: ['/seasons'], blurb: 'Bucket list, weekends' },
]

export const isActive = (matches: string[], pathname: string) =>
  matches.some((m) => m === pathname || pathname.startsWith(`${m}/`))

/** The feature a pathname belongs to, or null (`/`, `/admin`, the
 *  placeholders, unknown paths). */
export const featureForPath = (pathname: string): Feature | null =>
  FEATURES.find((f) => isActive(f.matches, pathname)) ?? null

/** The features a space shows, in nav order. `allow` is the space's
 *  `enabled_features`: null means everything — including features added
 *  later — and an array is an allow-list. Unknown keys (a feature since
 *  removed) are ignored, and an empty array really is empty: the hub shows an
 *  empty state rather than quietly turning everything back on. */
export function enabledFeatures(allow: readonly string[] | null): Feature[] {
  if (allow === null) return [...FEATURES]
  return FEATURES.filter((f) => allow.includes(f.key))
}

/** Where to land after switching spaces: the same feature's root if the new
 *  space has it (never an id-bearing sub-path — that id belongs to the old
 *  space), else the hub. */
export function landingPath(pathname: string, enabled: readonly Feature[]): string {
  const current = featureForPath(pathname)
  return current && enabled.some((f) => f.key === current.key) ? current.path : '/'
}
