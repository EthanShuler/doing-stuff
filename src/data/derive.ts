import type { Activity, Category, Entry, Profile, Repeat, SortKey, WishlistItem } from '../types'
import type { YearMonth } from '../lib/format'
import { FALLBACK_COLOR, swatchFor } from '../theme'
import { currentMonthPrefix, isoDate, today } from '../lib/format'

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

/** One logged outing (a first visit or a repeat) landing on a calendar day. */
export interface CalendarMark {
  /** Unique within its day cell — drives the React key and the edit click. */
  key: string
  /** The entry to open when this chip is clicked. */
  entryId: string
  title: string
  /** Parent activity's emoji, or '' when none is set (chip shows no icon). */
  emoji: string
  /** Solid category color (chip border / accent). */
  categoryColor: string
  /** Pale category tint — the chip background, so categories read at a glance. */
  categoryTint: string
  /** Darker category ink — readable chip text on the tint. */
  categoryInk: string
  categoryId: string | null
}

/** One cell in the month grid. */
export interface CalendarDay {
  /** ISO date this cell represents ("YYYY-MM-DD"). */
  date: string
  /** Day-of-month number shown in the corner (1–31). */
  dayOfMonth: number
  /** False for the leading/trailing days that belong to the adjacent months. */
  inMonth: boolean
  /** True for the cell representing today. */
  isToday: boolean
  /** Outings on this day, in the order entries appear in the store. */
  marks: CalendarMark[]
}

/**
 * Build the month grid for `ym` (year + 1-based month), week starting Sunday.
 * Flattens both first-entry dates and repeat dates into per-day marks, so a
 * return visit shows on its own day. Honors the category filter ('all' = no
 * filter). Pure aside from reading "today" for the highlight. Leading/trailing
 * cells from the neighboring months are included with `inMonth: false`.
 */
export function calendarDays(
  ym: YearMonth,
  entries: Entry[],
  repeats: Repeat[],
  activities: Activity[],
  categories: Category[],
  filterCategoryId: string,
): CalendarDay[] {
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  // Resolve an entry to its display chip, or null if filtered out.
  const markFor = (entry: Entry, key: string): CalendarMark | null => {
    const activity = activityById.get(entry.activityId)
    const category = activity ? categoryById.get(activity.categoryId) : undefined
    const categoryId = category ? category.id : null
    if (filterCategoryId !== 'all' && categoryId !== filterCategoryId) return null
    const swatch = category ? swatchFor(category.colorIndex) : null
    return {
      key,
      entryId: entry.id,
      title: entry.title || (activity ? activity.name : '(deleted)'),
      emoji: activity ? activity.emoji : '',
      categoryColor: swatch ? swatch.color : FALLBACK_COLOR,
      // Deleted-category fallback: neutral chip tint + muted ink.
      categoryTint: swatch ? swatch.tint : '#f3f0ea',
      categoryInk: swatch ? swatch.ink : '#5c574e',
      categoryId,
    }
  }

  // Bucket every outing (first visit + each repeat) by its ISO date.
  const marksByDate = new Map<string, CalendarMark[]>()
  const push = (date: string, mark: CalendarMark | null) => {
    if (!mark) return
    const existing = marksByDate.get(date)
    if (existing) existing.push(mark)
    else marksByDate.set(date, [mark])
  }
  const entryById = new Map(entries.map((e) => [e.id, e]))
  for (const entry of entries) push(entry.date, markFor(entry, `e:${entry.id}`))
  for (const repeat of repeats) {
    const entry = entryById.get(repeat.entryId)
    if (entry) push(repeat.date, markFor(entry, `r:${repeat.id}`))
  }

  const todayIso = today()
  const daysInMonth = new Date(ym.year, ym.month, 0).getDate()
  const leading = new Date(ym.year, ym.month - 1, 1).getDay() // 0 = Sunday
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7

  const cells: CalendarDay[] = []
  for (let i = 0; i < totalCells; i += 1) {
    // Day-of-month relative to the 1st; can be ≤0 (prev month) or >daysInMonth (next).
    const offset = i - leading + 1
    const d = new Date(ym.year, ym.month - 1, offset)
    const date = isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
    cells.push({
      date,
      dayOfMonth: d.getDate(),
      inMonth: offset >= 1 && offset <= daysInMonth,
      isToday: date === todayIso,
      marks: marksByDate.get(date) ?? [],
    })
  }
  return cells
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
