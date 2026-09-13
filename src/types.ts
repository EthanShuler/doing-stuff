// Core domain types. These mirror the Supabase table columns so the same
// shapes flow from the database through the data store and into the UI.

export interface Category {
  id: string
  name: string
  /** Index into the theme palette (see src/theme.ts). */
  colorIndex: number
}

export interface Activity {
  id: string
  categoryId: string
  name: string
  /** Single emoji used as this activity's map-pin icon. '' = none (pin falls back to 📍). */
  emoji: string
}

/** A space member's readable identity (mirrors the `profiles` table). */
export interface Profile {
  id: string
  email: string | null
  displayName: string | null
}

/** A logged outing — one row in the `entries` table. */
export interface Entry {
  id: string
  activityId: string
  title: string
  /** ISO date string, e.g. "2026-06-12". */
  date: string
  description: string
  /** 1–5 stars. */
  rating: number
  /** auth.users id of the member who logged this entry (null for legacy rows). */
  createdBy: string | null
  /** Free-text place this outing happened. '' = none. */
  address: string
  /** Geocoded from `address` on save (Nominatim). null when absent or unlocatable. */
  lat: number | null
  lng: number | null
  /** When true, this entry is omitted from the map even if it has coords. */
  hideFromMap: boolean
}

/**
 * A repeat — an additional time you returned to an entry. The entry's own
 * `date` is the first entry; each Repeat adds one more. One row in `entry_repeats`.
 */
export interface Repeat {
  id: string
  entryId: string
  /** ISO date string of this repeat, e.g. "2026-06-20". */
  date: string
  /** auth.users id of the member who logged this repeat (null for legacy rows). */
  createdBy: string | null
}

/** The space's shared map center, geocoded from a typed address. */
export interface Home {
  address: string
  lat: number | null
  lng: number | null
}

/** A free-text "thing we want to try" — one row in `wishlist_items`. */
export interface WishlistItem {
  id: string
  text: string
  /** The entry this item produced when checked off; null while still open. */
  entryId: string | null
  /** auth.users id of the member who added the wish (not shown in the UI). */
  createdBy: string | null
  /** ISO timestamp; used to order the list. */
  createdAt: string
  /** Optional place we want to go. '' = none; clearing it removes the map pin. */
  address: string
  /** Geocoded from `address` on save (Nominatim). null when absent or unlocatable. */
  lat: number | null
  lng: number | null
}

// --- Tier lists (movies + TV + books + ice cream + custom lists) --------------

/** The four BUILT-IN boards, each with its own route and its own wording in
 *  the tier-list copy.ts. Stays a closed union — a space-defined list is a
 *  `TierList` row, not a new kind here. */
export type TierKind = 'movie' | 'tv' | 'book' | 'ice-cream'

/**
 * Which board a pool item belongs to: one of the four built-ins, or
 * `list:<tier_lists.id>` for a space-defined one. This is the app-side key
 * only — in the DB it's a `kind` column ('custom' for a custom list) plus a
 * nullable `list_id`; the tier-list derive.ts converts
 * (`keyOf` / `kindColumn` / `listIdOf`).
 */
export type ListKey = TierKind | `list:${string}`

/**
 * A space-defined tier list ("Bugs", "Fruits") — one row in `tier_lists`.
 * Shared space data like the item pool: either member can create, rename, or
 * delete one, and deleting cascades its items (and everyone's rankings of
 * them). Behavior is fixed to the ice-cream template — shared pool, S–F
 * tiers, a "Not <past>" shelf, no dates in the UI — so the row only carries
 * WORDS (see customCopy in the tier-list copy.ts).
 */
export interface TierList {
  id: string
  /** Display name, as typed: "Fruits". */
  name: string
  /** Single emoji for the picker pill and the card fallback. '' = 🏷️. */
  emoji: string
  /** Lowercase singular noun used inline: "Add a fruit". */
  noun: string
  /** Past participle, lowercase: the "Not tried" shelf. */
  past: string
  /** True = ONE board the whole space ranks together (placements carry a
   *  null userId and either member may write them); false = the usual board
   *  per person. */
  shared: boolean
  /** auth.users id of the member who created it (null for legacy rows). */
  createdBy: string | null
  /** ISO timestamp; orders the picker pills. */
  createdAt: string
}

/** The fixed tier ladder — not user-editable. */
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

/** A movie, show, book, ice cream, or custom-list item in the space's SHARED
 *  pool — one row in `tier_items`. */
export interface TierItem {
  id: string
  /** Which board it's on (a built-in kind, or `list:<id>` — see ListKey). */
  kind: ListKey
  title: string
  /** Poster/cover image URL, pasted by hand. '' = none (card shows a fallback). */
  imageUrl: string
  /** The SHARED "we finished this" date, ISO ("YYYY-MM-DD"); null when unknown
   *  (legacy rows). Movies/TV only — books are read separately, so their dates
   *  live per person in TierCompletion and this stays null. Ice cream shows no
   *  dates in the UI, but reuses this as its shared "tried it" marker (null =
   *  not tried; any date = tried). */
  doneOn: string | null
  /** Free-text filter labels ("disney", "fantasy"). Shared, like the item. */
  tags: string[]
  /** Who made it — author for books, director for movies, etc. (per-kind label
   *  in copy.ts). Free text, shared like the title. '' = unknown/not entered. */
  creator: string
  /** auth.users id of the member who added it (null for legacy rows). */
  createdBy: string | null
  /** ISO timestamp; orders the unranked shelf. */
  createdAt: string
}

/**
 * ONE PERSON'S "I'm done with this" record for a pool item — one row in
 * `tier_item_completions`. Today only books use it: the pool is shared but
 * reading isn't, so each member marks their own copy read and a book can sit
 * ranked on one board and on the Unread shelf of the other. Absence of a row =
 * that member hasn't finished it. (The shared counterpart is `TierItem.doneOn`
 * — same meaning, one date for the space; `datesArePersonal()` picks.)
 */
export interface TierCompletion {
  id: string
  itemId: string
  userId: string
  /** ISO date this member finished it. */
  doneOn: string
}

/**
 * One person's ranking of one item — one row in `tier_placements`. Each member
 * places the same shared items independently; an item with no placement for a
 * viewer is "unranked" for them (absence of a row, never a tier value).
 */
export interface TierPlacement {
  id: string
  itemId: string
  /** Whose ranking this is. Null = the shared board of a `shared` custom
   *  list — one ranking for the whole space (see isSharedBoard in derive). */
  userId: string | null
  tier: Tier
  /** Fractional ordering within the tier (midpoint insertion on drop). */
  position: number
}

// --- Lists (the want-to lists: watchlist, reading list, free-form) -----------

/**
 * Which list a row is on: one of the three BUILT-IN lists, or
 * `custom:<lists.id>` for a free-form list the space defined.
 *
 * Deliberately NOT `ListKey` — that names a tier BOARD (and its `list:` prefix
 * points at a `tier_lists` row). A `custom:` ref points at a `lists` row, a
 * different table entirely; the two must never be swapped by accident, so
 * they're separate types with different prefixes.
 *
 * In the DB it's a `kind` column ('custom' for a free-form list) plus a
 * nullable `list_id` — the lists feature's derive.ts converts (`refOf` /
 * `kindColumn` / `listIdOf`).
 */
export type ListRef = 'movie' | 'tv' | 'book' | `custom:${string}`

/**
 * A free-form list the space defined ("Groceries") — one row in `lists`.
 * Shared space data with the uniform member policy: either member can create,
 * rename, or delete one, and deleting cascades its rows. It carries only a
 * name and an emoji; all its other wording is templated (customListCopy in
 * the lists copy.ts).
 */
export interface ListDef {
  id: string
  /** Display name, as typed: "Groceries". */
  name: string
  /** Single emoji for the picker pill. '' = 🏷️. */
  emoji: string
  /** auth.users id of the member who created it (null for legacy rows). */
  createdBy: string | null
  /** ISO timestamp; orders the picker pills. */
  createdAt: string
}

/** One thing on a list — a row in `list_items`. */
export interface ListItem {
  id: string
  /** Which list it's on (a built-in kind, or `custom:<id>` — see ListRef). */
  key: ListRef
  title: string
  /** Poster/cover URL, pasted or filled from a title search. '' = none.
   *  Free-form rows never show one. */
  imageUrl: string
  /** Who made it — author/director (per-kind label in the lists copy.ts).
   *  On a free-form row this doubles as the optional NOTE line. '' = none. */
  creator: string
  /** Fractional queue position; lowest = next up (midpoint insertion on drag). */
  position: number
  /** The tier item this produced when checked off; null while still open.
   *  Movie/TV/book only — deleting that tier item reopens the row (the DB's
   *  `on delete set null`). */
  tierItemId: string | null
  /** Free-form rows only: the day it was done. null = still open. */
  doneOn: string | null
  /** auth.users id of the member who added it — the OWNER of a book row
   *  (the reading list is per person). */
  createdBy: string | null
  /** ISO timestamp; the tiebreak when positions collide. */
  createdAt: string
}

// --- Spoons (the souvenir spoon collection) ----------------------------------

/** One physical souvenir spoon — one row in `spoons`. Shared space data. */
export interface Spoon {
  id: string
  name: string
  /** Public URL of the uploaded photo (spoons storage bucket). '' = none —
   *  cards and map pins show a 🥄 fallback. */
  imageUrl: string
  /** Free-text place the spoon came from ("Paris", "Yellowstone gift shop").
   *  '' = unknown. */
  place: string
  /** Geocoded from `place` on save (Nominatim). null when absent or
   *  unlocatable — the spoon stays in the list but off the map. */
  lat: number | null
  lng: number | null
  /** ISO date Squabby got it; null = unknown (sorts after dated spoons). */
  acquiredOn: string | null
  /** The story behind the spoon. */
  notes: string
  /** auth.users id of the member who logged it (null for legacy rows). */
  createdBy: string | null
  /** ISO timestamp; tiebreak ordering for undated spoons. */
  createdAt: string
}

// --- Recipes (the shared cookbook) --------------------------------------------

/** One recipe we've actually made — one row in `recipes`. Shared space data
 *  (uniform space-member RLS; either member edits any). The text fields carry
 *  light structure parsed client-side: `ingredients` is one per line,
 *  `steps` splits into numbered steps on blank lines (see the recipes
 *  feature's derive.ts). */
export interface Recipe {
  id: string
  title: string
  /** Public URL of the uploaded photo (recipes storage bucket). '' = none —
   *  cards and the detail page show a 🍲 fallback. */
  imageUrl: string
  /** One ingredient per line ("2 cups flour"). '' = not written out. */
  ingredients: string
  /** Instructions; blank lines split them into numbered steps. */
  steps: string
  /** Where it's from ("Adapted from Smitten Kitchen", "Grandma Ruth"). */
  source: string
  /** Optional link to the original recipe. '' = none. */
  sourceUrl: string
  /** Free-text filter labels ("dinner", "soup", "thai"). */
  tags: string[]
  /** Plain display text, no math ("4", "6 as a side"). '' = unstated. */
  servings: string
  /** Plain display text ("45 min", "3h including rise"). '' = unstated. */
  totalTime: string
  /** Our notes — tweaks and verdicts ("double the garlic next time"). */
  notes: string
  /** auth.users id of the member who added it (shown as a faint byline). */
  createdBy: string | null
  /** ISO timestamp; the byline's "added" date and the A–Z tiebreak. */
  createdAt: string
}

// --- Little guys (the Smiski-and-friends collection) --------------------------

/** One little guy — one row in `little_guys`. Shared space data (either member
 *  edits any), but each guy belongs to one of you: `ownerId` is whose he is,
 *  not who may edit him. */
export interface LittleGuy {
  id: string
  name: string
  /** Public URL of the uploaded photo (little-guys storage bucket). '' = none —
   *  cards show a 🗿 fallback. */
  imageUrl: string
  /** Who got him for you — free text ("Meg, for my birthday"). Not a member
   *  reference: gifts come from outside the space too. '' = unknown. */
  source: string
  /** auth.users id of the member whose little guy he is; null = nobody in
   *  particular (a shared desk guy). */
  ownerId: string | null
  /** Free text ("shy", "menace", "extremely tired"). '' = undecided. */
  personality: string
  /** Anything else worth saying about him. */
  description: string
  /** auth.users id of the member who logged him (null for legacy rows). */
  createdBy: string | null
  /** ISO timestamp; the A–Z tiebreak. */
  createdAt: string
}

// --- Music practice (the Bassoon circle-of-fifths tracker) --------------------

/** One calendar day's chosen key for one person — a row in
 *  `music_practice_days`. Personal state (each member's own; same split RLS as
 *  tier placements). One row per day; picking again overwrites it. */
export interface PracticeDay {
  id: string
  /** ISO date ("YYYY-MM-DD") of the practice day (DB `practice_date`, local). */
  date: string
  /** Clockwise slot on the circle of fifths, 0 = C (see CIRCLE in the
   *  music-practice derive.ts). 0–11. */
  position: number
  /** Tempo practiced that day, in BPM (DB `tempo`), or null if not recorded. */
  tempo: number | null
  /** auth.users id of the member whose day this is (null for legacy rows). */
  createdBy: string | null
  /** ISO timestamp of when the row was written. */
  createdAt: string
}

// --- Parks (the 63-national-parks tracker) ------------------------------------

/** One trip to a national park — one row in `park_visits`. The park itself is
 *  static in-repo data (src/features/parks/parks.ts), referenced by NPS code.
 *  A park can have many visits; shared space data (either member edits any). */
export interface ParkVisit {
  id: string
  /** NPS park code ('yose', 'zion', …) into the static PARKS list. */
  parkCode: string
  /** ISO date of the trip; null = sometime, long ago. */
  date: string | null
  notes: string
  /** auth.users ids of who was on this trip. Together = both on one row
   *  that isn't marked `separate`. */
  attendeeIds: string[]
  /** One-row shorthand for "we've both been, but on different trips": all
   *  attendees + separate = true counts toward each person's total, not
   *  Together. Meaningless on solo rows. */
  separate: boolean
  /** auth.users id of the member who logged it (null for legacy rows). */
  createdBy: string | null
  /** ISO timestamp; tiebreak ordering for undated visits. */
  createdAt: string
}

export type SortKey = 'recent' | 'rating' | 'category'
export type ViewMode = 'cards' | 'table'
export type Screen = 'log' | 'wishlist' | 'map' | 'calendar'

/** The draft backing the new/edit entry modal. */
export interface EntryDraft {
  categoryId: string
  activityId: string
  title: string
  date: string
  description: string
  rating: number
  address: string
  hideFromMap: boolean
}
