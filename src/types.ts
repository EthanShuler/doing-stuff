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
}

export type SortKey = 'recent' | 'rating' | 'category'
export type ViewMode = 'cards' | 'table'
export type Screen = 'log' | 'wishlist' | 'map'

/** The draft backing the new/edit entry modal. */
export interface EntryDraft {
  categoryId: string
  activityId: string
  title: string
  date: string
  description: string
  rating: number
  address: string
}
