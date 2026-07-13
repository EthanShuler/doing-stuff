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

// --- Tier lists (movies + TV + books + ice cream) -----------------------------

export type TierKind = 'movie' | 'tv' | 'book' | 'ice-cream'

/** The fixed tier ladder — not user-editable. */
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

/** A movie, show, book, or ice cream in the space's SHARED pool — one row in
 *  `tier_items`. */
export interface TierItem {
  id: string
  kind: TierKind
  title: string
  /** Poster/cover image URL, pasted by hand. '' = none (card shows a fallback). */
  imageUrl: string
  /** ISO date ("YYYY-MM-DD") we finished watching it; null when unknown (legacy
   *  rows). Movies/TV only — books are read separately, so their dates live
   *  per person in TierRead and this stays null. Ice cream shows no dates in
   *  the UI, but reuses this as its shared "tried it" marker (null = not
   *  tried; any date = tried). */
  watchedOn: string | null
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
 * One person's "I've read this" record for a BOOK pool item — one row in
 * `tier_item_reads`. The pool is shared but reading isn't: each member marks
 * their own copy read, so a book can sit ranked on one board and on the Unread
 * shelf of the other. Absence of a row = that member hasn't read it.
 */
export interface TierRead {
  id: string
  itemId: string
  userId: string
  /** ISO date this member finished it. */
  readOn: string
}

/**
 * One person's ranking of one item — one row in `tier_placements`. Each member
 * places the same shared items independently; an item with no placement for a
 * viewer is "unranked" for them (absence of a row, never a tier value).
 */
export interface TierPlacement {
  id: string
  itemId: string
  userId: string
  tier: Tier
  /** Fractional ordering within the tier (midpoint insertion on drop). */
  position: number
}

/**
 * A "want to watch" (or, for books, "want to read") item in the space's SHARED
 * watchlist — one row in `watchlist_items`. Checking it off creates a
 * `tier_items` row in the pool and links to it via `tierItemId` (null = still
 * open). The whole list is shared, so any member can add / edit / check off.
 */
export interface WatchlistItem {
  id: string
  kind: TierKind
  title: string
  /** Optional poster/cover URL; carried onto the tier card when checked off. '' = none. */
  imageUrl: string
  /** Who made it — author/director/etc. (per-kind label in copy.ts). Carried
   *  onto the tier item when checked off, like the image. '' = unknown. */
  creator: string
  /** Queue order within the kind's list — top (lowest) = watch next.
   *  Fractional midpoint insertion on drag reorder; new items append at the
   *  end (max + 1). */
  position: number
  /** The tier item this produced when checked off; null while still "want to watch". */
  tierItemId: string | null
  /** auth.users id of the member who added it (null for legacy rows). */
  createdBy: string | null
  /** ISO timestamp; tiebreak ordering for same-position rows. */
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
