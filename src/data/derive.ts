import type { Activity, Category, Entry, Profile, Repeat, SortKey, WishlistItem } from '../types'
import { FALLBACK_COLOR, swatchFor } from '../theme'
import { currentMonthPrefix } from '../lib/format'

/** An entry joined with its activity + category, ready for display. */
export interface DisplayRow {
  id: string
  title: string
  categoryName: string
  categoryId: string | null
  categoryColor: string
  activityName: string
  /** Most recent date (max of the first entry and any repeats). Drives the
   *  displayed date and the "recent" sort, so a repeat resurfaces the entry. */
  date: string
  /** The original (first) entry date. Shown as "since …" when there are repeats. */
  firstDate: string
  /** Total times logged: 1 (the entry) + its repeats. */
  totalCount: number
  description: string
  rating: number
  /** Display label for who logged the entry: "You", a name, or "" if unknown. */
  createdBy: string
}

/** Resolve a creator id to a short display label, marking the current user. */
function creatorLabel(
  createdBy: string | null,
  profilesById: Map<string, Profile>,
  currentUserId: string | null,
): string {
  if (!createdBy) return ''
  if (currentUserId && createdBy === currentUserId) return 'You'
  const profile = profilesById.get(createdBy)
  if (!profile) return ''
  return profile.displayName || (profile.email ? profile.email.split('@')[0] : '')
}

export interface Stats {
  total: number
  thisMonth: number
}

export function joinRows(
  entries: Entry[],
  activities: Activity[],
  categories: Category[],
  profiles: Profile[] = [],
  currentUserId: string | null = null,
  repeats: Repeat[] = [],
): DisplayRow[] {
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const profilesById = new Map(profiles.map((p) => [p.id, p]))

  // Group repeat dates by entry so we can derive count + latest date per entry.
  const repeatDatesByEntry = new Map<string, string[]>()
  for (const repeat of repeats) {
    const dates = repeatDatesByEntry.get(repeat.entryId)
    if (dates) dates.push(repeat.date)
    else repeatDatesByEntry.set(repeat.entryId, [repeat.date])
  }

  return entries.map((entry) => {
    const activity = activityById.get(entry.activityId)
    const category = activity ? categoryById.get(activity.categoryId) : undefined
    const repeatDates = repeatDatesByEntry.get(entry.id) ?? []
    const latestDate = repeatDates.reduce((max, date) => (date > max ? date : max), entry.date)
    return {
      id: entry.id,
      title: entry.title || (activity ? activity.name : '(deleted)'),
      categoryName: category ? category.name : '—',
      categoryId: category ? category.id : null,
      categoryColor: category ? swatchFor(category.colorIndex).color : FALLBACK_COLOR,
      activityName: activity ? activity.name : '(deleted)',
      date: latestDate,
      firstDate: entry.date,
      totalCount: 1 + repeatDates.length,
      description: entry.description,
      rating: entry.rating,
      createdBy: creatorLabel(entry.createdBy, profilesById, currentUserId),
    }
  })
}

/** An entry that has coordinates, ready to draw as a map pin. */
export interface MapMarker {
  id: string
  lat: number
  lng: number
  /** Parent activity's emoji, or 📍 when none is set. */
  emoji: string
  title: string
  activityName: string
  categoryColor: string
  date: string
  rating: number
}

const DEFAULT_PIN = '📍'

/**
 * Entries that have been geocoded, joined to their activity's emoji + category
 * color. Pure; ignores the category filter — the map always shows everything.
 */
export function mapMarkers(entries: Entry[], activities: Activity[], categories: Category[]): MapMarker[] {
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const markers: MapMarker[] = []
  for (const entry of entries) {
    if (entry.lat === null || entry.lng === null) continue
    const activity = activityById.get(entry.activityId)
    const category = activity ? categoryById.get(activity.categoryId) : undefined
    markers.push({
      id: entry.id,
      lat: entry.lat,
      lng: entry.lng,
      emoji: activity && activity.emoji ? activity.emoji : DEFAULT_PIN,
      title: entry.title || (activity ? activity.name : '(deleted)'),
      activityName: activity ? activity.name : '(deleted)',
      categoryColor: category ? swatchFor(category.colorIndex).color : FALLBACK_COLOR,
      date: entry.date,
      rating: entry.rating,
    })
  }
  return markers
}

/**
 * Fuzzy subsequence match: every character of `query` appears in `text` in
 * order (case-insensitive, whitespace in the query ignored). Empty query
 * matches everything. So "prk" matches "Park" and "botgar" matches
 * "Botanical Garden".
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const needle = query.toLowerCase().replace(/\s+/g, '')
  if (!needle) return true
  const haystack = text.toLowerCase()
  let i = 0
  for (const char of haystack) {
    if (char === needle[i]) {
      i += 1
      if (i === needle.length) return true
    }
  }
  return false
}

export function filterAndSort(
  rows: DisplayRow[],
  filterCategoryId: string,
  sort: SortKey,
  search = '',
): DisplayRow[] {
  let result = rows
  if (filterCategoryId !== 'all') {
    result = result.filter((row) => row.categoryId === filterCategoryId)
  }
  if (search.trim()) {
    result = result.filter((row) => fuzzyMatch(row.title, search))
  }

  const byDateDesc = (a: DisplayRow, b: DisplayRow) => b.date.localeCompare(a.date)
  const sorted = [...result]
  if (sort === 'recent') {
    sorted.sort(byDateDesc)
  } else if (sort === 'rating') {
    sorted.sort((a, b) => b.rating - a.rating || byDateDesc(a, b))
  } else if (sort === 'category') {
    sorted.sort((a, b) => a.categoryName.localeCompare(b.categoryName) || byDateDesc(a, b))
  }
  return sorted
}

/**
 * Order the wishlist for display: open items first, done items sink to the
 * bottom; within each group, oldest first (so newly added wishes appear at the
 * end of the open list, next to the add input). Pure — does not mutate input.
 */
export function sortWishlist(items: WishlistItem[]): WishlistItem[] {
  const byCreatedAsc = (a: WishlistItem, b: WishlistItem) => a.createdAt.localeCompare(b.createdAt)
  return [...items].sort((a, b) => {
    const aDone = a.entryId !== null
    const bDone = b.entryId !== null
    if (aDone !== bDone) return aDone ? 1 : -1
    return byCreatedAsc(a, b)
  })
}

export function computeStats(entries: Entry[], repeats: Repeat[] = []): Stats {
  const prefix = currentMonthPrefix()
  // "This month" counts everything logged in the month — first entries and
  // repeats alike — so returning to a place this month bumps the count.
  const thisMonth =
    entries.filter((entry) => entry.date.startsWith(prefix)).length +
    repeats.filter((repeat) => repeat.date.startsWith(prefix)).length
  return { total: entries.length, thisMonth }
}
