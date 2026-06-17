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
}

export type SortKey = 'recent' | 'rating' | 'category'
export type ViewMode = 'cards' | 'table'

/** The draft backing the new/edit entry modal. */
export interface EntryDraft {
  categoryId: string
  activityId: string
  title: string
  date: string
  description: string
  rating: number
}
