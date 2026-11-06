/** The top-level features — one entry per feature, not one per route. The
 *  header nav and the home hub (`/`) both render from this list, so a new
 *  feature shows up in both by adding it here.
 *
 *  `path` is where the feature lands; `matches` are the route prefixes that
 *  light up its nav item (a match also claims its sub-paths, so /recipes/:id
 *  lights up Recipes and every /lists/* route lights up Lists). Doing Stuff
 *  spans four routes, Tier Lists four boards, and Lists three built-ins plus
 *  the space's own (an in-page picker chooses between them, see PickerRow).
 *  The unbuilt placeholder routes (/french-toast, /board-games, /cats) still
 *  exist in App.tsx but are off the nav. */
export interface Feature {
  label: string
  path: string
  matches: string[]
  /** The hub row's one-line description. */
  blurb: string
}

export const FEATURES: Feature[] = [
  {
    label: 'Doing Stuff',
    path: '/log',
    matches: ['/log', '/wishlist', '/map', '/calendar'],
    blurb: 'Outings, wishlist, map',
  },
  { label: 'Tier Lists', path: '/movies', matches: ['/movies', '/tv', '/books', '/tiers'], blurb: 'Rank movies, TV, books' },
  { label: 'Lists', path: '/lists/movies', matches: ['/lists'], blurb: 'Watchlists, groceries' },
  { label: 'Recipes', path: '/recipes', matches: ['/recipes'], blurb: 'Cookbook, meal plan' },
  { label: 'Parks', path: '/parks', matches: ['/parks'], blurb: 'The 63 national parks' },
  { label: 'Spoons', path: '/spoons', matches: ['/spoons'], blurb: 'Souvenir spoons' },
  { label: 'Little Guys', path: '/little-guys', matches: ['/little-guys'], blurb: 'The little guy shelf' },
  { label: 'Alignment', path: '/alignment', matches: ['/alignment'], blurb: 'Alignment charts' },
  { label: 'Music Practice', path: '/music-practice', matches: ['/music-practice'], blurb: 'Bassoon, piano' },
  { label: 'Seasons', path: '/seasons', matches: ['/seasons'], blurb: 'Bucket list, weekends' },
]

export const isActive = (matches: string[], pathname: string) =>
  matches.some((m) => m === pathname || pathname.startsWith(`${m}/`))
