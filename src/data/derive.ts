import type { Activity, Category, Entry, Profile, SortKey } from '../types'
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
  date: string
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
): DisplayRow[] {
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const profilesById = new Map(profiles.map((p) => [p.id, p]))

  return entries.map((entry) => {
    const activity = activityById.get(entry.activityId)
    const category = activity ? categoryById.get(activity.categoryId) : undefined
    return {
      id: entry.id,
      title: entry.title || (activity ? activity.name : '(deleted)'),
      categoryName: category ? category.name : '—',
      categoryId: category ? category.id : null,
      categoryColor: category ? swatchFor(category.colorIndex).color : FALLBACK_COLOR,
      activityName: activity ? activity.name : '(deleted)',
      date: entry.date,
      description: entry.description,
      rating: entry.rating,
      createdBy: creatorLabel(entry.createdBy, profilesById, currentUserId),
    }
  })
}

export function filterAndSort(
  rows: DisplayRow[],
  filterCategoryId: string,
  sort: SortKey,
): DisplayRow[] {
  let result = rows
  if (filterCategoryId !== 'all') {
    result = result.filter((row) => row.categoryId === filterCategoryId)
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

export function computeStats(entries: Entry[]): Stats {
  const prefix = currentMonthPrefix()
  const thisMonth = entries.filter((entry) => entry.date.startsWith(prefix)).length
  return { total: entries.length, thisMonth }
}
