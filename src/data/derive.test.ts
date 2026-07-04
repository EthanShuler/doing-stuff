import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Activity, Category, Entry, Profile, Repeat, WishlistItem } from '../types'
import { ACCENT, FALLBACK_COLOR, swatchFor } from '../theme'
import {
  calendarDays,
  computeStats,
  filterAndSort,
  fuzzyMatch,
  joinRows,
  mapMarkers,
  sortWishlist,
  wishMarkers,
} from './derive'

// calendarDays' "today" highlight and computeStats' "this month" read the real
// clock; pin it so the assertions don't rot. June 2026: the 1st is a Monday.
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 5, 15))
})
afterAll(() => {
  vi.useRealTimers()
})

// --- Tiny builders so each test states only what it cares about. ---

const cat = (id: string, name: string, colorIndex = 0): Category => ({ id, name, colorIndex })

const act = (id: string, categoryId: string, name: string, emoji = ''): Activity => ({
  id,
  categoryId,
  name,
  emoji,
})

const entry = (over: Partial<Entry> & { id: string; activityId: string }): Entry => ({
  title: '',
  date: '2026-06-10',
  description: '',
  rating: 3,
  createdBy: null,
  address: '',
  lat: null,
  lng: null,
  hideFromMap: false,
  ...over,
})

const wish = (over: Partial<WishlistItem> & { id: string }): WishlistItem => ({
  text: 'A wish',
  entryId: null,
  createdBy: null,
  createdAt: '2026-06-01T09:00:00Z',
  address: '',
  lat: null,
  lng: null,
  ...over,
})

const repeat = (id: string, entryId: string, date: string): Repeat => ({
  id,
  entryId,
  date,
  createdBy: null,
})

const CATS = [cat('c1', 'Outdoor', 0), cat('c2', 'City', 1)]
const ACTS = [act('a1', 'c1', 'Park', '🌳'), act('a2', 'c2', 'Movie')]

describe('joinRows', () => {
  it('joins each entry to its activity and category', () => {
    const [row] = joinRows([entry({ id: 'e1', activityId: 'a1', title: 'Picnic' })], ACTS, CATS)
    expect(row).toMatchObject({
      id: 'e1',
      title: 'Picnic',
      activityName: 'Park',
      categoryId: 'c1',
      categoryName: 'Outdoor',
      categoryColor: swatchFor(0).color,
    })
  })

  it('falls back to the activity name when the title is empty, and to "(deleted)" markers when the activity is gone', () => {
    const [untitled, orphaned] = joinRows(
      [entry({ id: 'e1', activityId: 'a1' }), entry({ id: 'e2', activityId: 'gone' })],
      ACTS,
      CATS,
    )
    expect(untitled.title).toBe('Park')
    expect(orphaned).toMatchObject({
      title: '(deleted)',
      activityName: '(deleted)',
      categoryId: null,
      categoryName: '—',
      categoryColor: FALLBACK_COLOR,
    })
  })

  it('surfaces the latest repeat as the display date and counts total visits', () => {
    const repeats = [repeat('r1', 'e1', '2026-06-18'), repeat('r2', 'e1', '2026-06-02')]
    const [row] = joinRows(
      [entry({ id: 'e1', activityId: 'a1', date: '2026-06-12' })],
      ACTS,
      CATS,
      [],
      null,
      repeats,
    )
    expect(row.date).toBe('2026-06-18')
    expect(row.firstDate).toBe('2026-06-12')
    expect(row.totalCount).toBe(3)
  })

  it('labels the creator: "You" for the current user, display name or email prefix for others, "" when unknown', () => {
    const profiles: Profile[] = [
      { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
      { id: 'u2', email: 'jordan@example.com', displayName: null },
    ]
    const rows = joinRows(
      [
        entry({ id: 'e1', activityId: 'a1', createdBy: 'u1' }),
        entry({ id: 'e2', activityId: 'a1', createdBy: 'u2' }),
        entry({ id: 'e3', activityId: 'a1', createdBy: 'u3' }),
      ],
      ACTS,
      CATS,
      profiles,
      'u2',
    )
    expect(rows.map((r) => r.createdBy)).toEqual(['Avery', 'You', ''])
  })
})

describe('fuzzyMatch', () => {
  it('matches subsequences case-insensitively', () => {
    expect(fuzzyMatch('Park', 'prk')).toBe(true)
    expect(fuzzyMatch('Botanical Garden', 'botgar')).toBe(true)
    expect(fuzzyMatch('Park', 'PARK')).toBe(true)
  })

  it('requires the characters in order', () => {
    expect(fuzzyMatch('Park', 'kp')).toBe(false)
    expect(fuzzyMatch('Park', 'parks')).toBe(false)
  })

  it('ignores whitespace in the query and matches everything on empty', () => {
    expect(fuzzyMatch('Botanical Garden', 'bot gar')).toBe(true)
    expect(fuzzyMatch('anything', '')).toBe(true)
    expect(fuzzyMatch('anything', '   ')).toBe(true)
  })
})

describe('filterAndSort', () => {
  const rows = joinRows(
    [
      entry({ id: 'e1', activityId: 'a1', title: 'Hike', date: '2026-06-01', rating: 5 }),
      entry({ id: 'e2', activityId: 'a2', title: 'Matinee', date: '2026-06-03', rating: 3 }),
      entry({ id: 'e3', activityId: 'a2', title: 'Late show', date: '2026-06-02', rating: 5 }),
    ],
    ACTS,
    CATS,
  )

  it('filters by category id, or passes everything for "all"', () => {
    expect(filterAndSort(rows, 'c2', 'recent').map((r) => r.id)).toEqual(['e2', 'e3'])
    expect(filterAndSort(rows, 'all', 'recent')).toHaveLength(3)
  })

  it('filters titles with the fuzzy search', () => {
    expect(filterAndSort(rows, 'all', 'recent', 'lts').map((r) => r.id)).toEqual(['e3'])
  })

  it('sorts by recency, by rating (date as tiebreak), and by category name', () => {
    expect(filterAndSort(rows, 'all', 'recent').map((r) => r.id)).toEqual(['e2', 'e3', 'e1'])
    expect(filterAndSort(rows, 'all', 'rating').map((r) => r.id)).toEqual(['e3', 'e1', 'e2'])
    expect(filterAndSort(rows, 'all', 'category').map((r) => r.id)).toEqual(['e2', 'e3', 'e1'])
  })

  it('does not mutate its input', () => {
    const before = rows.map((r) => r.id)
    filterAndSort(rows, 'all', 'rating')
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})

describe('sortWishlist', () => {
  it('keeps open items first (oldest first) and sinks done items to the bottom', () => {
    const items = [
      wish({ id: 'w1', createdAt: '2026-06-05T00:00:00Z', entryId: 'e1' }),
      wish({ id: 'w2', createdAt: '2026-06-03T00:00:00Z' }),
      wish({ id: 'w3', createdAt: '2026-06-01T00:00:00Z', entryId: 'e2' }),
      wish({ id: 'w4', createdAt: '2026-06-04T00:00:00Z' }),
    ]
    expect(sortWishlist(items).map((i) => i.id)).toEqual(['w2', 'w4', 'w3', 'w1'])
    expect(items.map((i) => i.id)).toEqual(['w1', 'w2', 'w3', 'w4'])
  })
})

describe('mapMarkers', () => {
  it('includes only geocoded, non-hidden entries', () => {
    const markers = mapMarkers(
      [
        entry({ id: 'e1', activityId: 'a1', lat: 45.5, lng: -122.6 }),
        entry({ id: 'e2', activityId: 'a1' }),
        entry({ id: 'e3', activityId: 'a1', lat: 45.5, lng: -122.6, hideFromMap: true }),
      ],
      ACTS,
      CATS,
    )
    expect(markers.map((m) => m.id)).toEqual(['e1'])
    expect(markers[0].kind).toBe('entry')
  })

  it("uses the activity's emoji, falling back to 📍", () => {
    const markers = mapMarkers(
      [
        entry({ id: 'e1', activityId: 'a1', lat: 1, lng: 1 }),
        entry({ id: 'e2', activityId: 'a2', lat: 1, lng: 1 }),
      ],
      ACTS,
      CATS,
    )
    expect(markers.map((m) => m.emoji)).toEqual(['🌳', '📍'])
  })

  it('marks entries of deleted activities with fallbacks', () => {
    const [m] = mapMarkers([entry({ id: 'e1', activityId: 'gone', lat: 1, lng: 1 })], ACTS, CATS)
    expect(m).toMatchObject({ activityName: '(deleted)', categoryId: null, categoryColor: FALLBACK_COLOR })
  })
})

describe('wishMarkers', () => {
  it('includes only open, geocoded wishes as ⭐ pins', () => {
    const markers = wishMarkers([
      wish({ id: 'w1', lat: 45.5, lng: -122.6, address: 'Somewhere' }),
      wish({ id: 'w2', lat: 45.5, lng: -122.6, entryId: 'e1' }),
      wish({ id: 'w3' }),
    ])
    expect(markers.map((m) => m.id)).toEqual(['w1'])
    expect(markers[0]).toMatchObject({ kind: 'wish', emoji: '⭐', categoryColor: ACCENT, address: 'Somewhere' })
  })
})

describe('calendarDays', () => {
  const JUNE = { year: 2026, month: 6 }

  it('builds full weeks including the neighboring months (June 2026 starts on a Monday)', () => {
    const days = calendarDays(JUNE, [], [], ACTS, CATS, 'all')
    expect(days).toHaveLength(35)
    expect(days[0]).toMatchObject({ date: '2026-05-31', inMonth: false })
    expect(days[1]).toMatchObject({ date: '2026-06-01', dayOfMonth: 1, inMonth: true })
    expect(days[34]).toMatchObject({ date: '2026-07-04', inMonth: false })
  })

  it('flags today (system time pinned to 2026-06-15)', () => {
    const days = calendarDays(JUNE, [], [], ACTS, CATS, 'all')
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-06-15'])
  })

  it('drops entry and repeat marks on their days, keyed separately', () => {
    const days = calendarDays(
      JUNE,
      [entry({ id: 'e1', activityId: 'a1', title: 'Picnic', date: '2026-06-12' })],
      [repeat('r1', 'e1', '2026-06-20')],
      ACTS,
      CATS,
      'all',
    )
    const byDate = new Map(days.map((d) => [d.date, d.marks]))
    expect(byDate.get('2026-06-12')).toMatchObject([{ key: 'e:e1', entryId: 'e1', title: 'Picnic' }])
    expect(byDate.get('2026-06-20')).toMatchObject([{ key: 'r:r1', entryId: 'e1' }])
  })

  it('honors the category filter', () => {
    const days = calendarDays(
      JUNE,
      [
        entry({ id: 'e1', activityId: 'a1', date: '2026-06-12' }),
        entry({ id: 'e2', activityId: 'a2', date: '2026-06-12' }),
      ],
      [],
      ACTS,
      CATS,
      'c2',
    )
    const marks = days.find((d) => d.date === '2026-06-12')!.marks
    expect(marks.map((m) => m.entryId)).toEqual(['e2'])
  })
})

describe('computeStats', () => {
  it('counts all entries, and this month counts entries plus repeats (June 2026)', () => {
    const stats = computeStats(
      [
        entry({ id: 'e1', activityId: 'a1', date: '2026-06-12' }),
        entry({ id: 'e2', activityId: 'a1', date: '2026-05-30' }),
      ],
      [repeat('r1', 'e2', '2026-06-20'), repeat('r2', 'e2', '2026-04-01')],
    )
    expect(stats.total).toBe(2)
    expect(stats.thisMonth).toBe(2) // e1 + r1
  })
})
