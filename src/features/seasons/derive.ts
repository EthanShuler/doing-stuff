import type { Season, SeasonItem } from '../../types'
import { formatDate, isoDate } from '../../lib/format'
import { positionBetween } from '../../lib/order'
import { triMatcher } from '../../lib/triFilter'
import type { TriFilterState } from '../../lib/triFilter'

// Pure data shaping for the Seasons feature (the seasonal bucket list): which
// season is current, the season's remaining weekends, what's on each day,
// what still needs a day, how close a deadline is, and the section grouping
// the bucket list renders. No React, no Supabase.

// --- Drafts ------------------------------------------------------------------

/** What the season modal edits. */
export interface SeasonDraft {
  name: string
  emoji: string
  startsOn: string
  endsOn: string
}

/** What the item modal / quick-adds edit. Everything but the ids, position,
 *  and done date — those are the store's business. */
export interface SeasonItemDraft {
  section: string
  subsection: string
  title: string
  note: string
  url: string
  /** null = top-level. Must be a top-level item of the same season. */
  parentId: string | null
  fixedOn: string | null
  byOn: string | null
  plannedOn: string | null
}

// --- Local-date arithmetic -----------------------------------------------------
// ISO dates are local calendar days. Arithmetic runs on a UTC day count (UTC
// has no DST, so adding a day is always exactly one day) and is formatted
// back from its UTC parts — never through toISOString on a local Date.

const DAY_MS = 86_400_000

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

const fromDayNumber = (n: number): string => {
  const date = new Date(n * DAY_MS)
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** The ISO date `n` days after `iso` (negative = before). */
export const addDays = (iso: string, n: number): string => fromDayNumber(dayNumber(iso) + n)

/** Day of week of an ISO date: 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (iso: string): number => new Date(dayNumber(iso) * DAY_MS).getUTCDay()

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "2026-10-03" → "Sat 10/3" — the planning chip / tag label. */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${WEEKDAYS[weekdayOf(iso)]} ${m}/${d}`
}

/** "2026-10-31" → "10/31" — the short deadline form ("by 10/31"). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}/${d}`
}

// --- Items: day, status ---------------------------------------------------------

/** The day an item sits on: its fixed event date, else its planned date. */
export const dayOf = (item: SeasonItem): string | null => item.fixedOn ?? item.plannedOn

export const isDone = (item: SeasonItem): boolean => item.doneOn !== null

/** A fixed-date item sits on its event day and can't be re-planned. */
export const isFixed = (item: SeasonItem): boolean => item.fixedOn !== null

export type ItemStatus = 'unplanned' | 'planned' | 'done'

/** The status-pill bucket: done wins, then "has a day", else unplanned. */
export function itemStatus(item: SeasonItem): ItemStatus {
  if (isDone(item)) return 'done'
  return dayOf(item) ? 'planned' : 'unplanned'
}

/** Status pill row, in display order. */
export const STATUS_KEYS: ItemStatus[] = ['unplanned', 'planned', 'done']
export const STATUS_LABELS: Record<ItemStatus, string> = {
  unplanned: 'Unplanned',
  planned: 'Planned',
  done: 'Done',
}

/** Stable order: position, then createdAt, then id. Never mutates. */
export function byPosition(items: SeasonItem[]): SeasonItem[] {
  return [...items].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** One season's items. */
export const itemsOfSeason = (items: SeasonItem[], seasonId: string): SeasonItem[] =>
  items.filter((item) => item.seasonId === seasonId)

// --- Current season ---------------------------------------------------------------

/**
 * The season `/seasons` should open on: the one whose range contains today
 * (the latest-starting, if several overlap), else the most recent one that
 * has started, else the earliest upcoming one. null when there are none.
 */
export function currentSeason(seasons: Season[], today: string): Season | null {
  const latestStart = (list: Season[]) =>
    list.reduce<Season | null>((best, s) => (!best || s.startsOn > best.startsOn ? s : best), null)
  const containing = seasons.filter((s) => s.startsOn <= today && today <= s.endsOn)
  if (containing.length) return latestStart(containing)
  const started = seasons.filter((s) => s.startsOn <= today)
  if (started.length) return latestStart(started)
  return seasons.reduce<Season | null>((best, s) => (!best || s.startsOn < best.startsOn ? s : best), null)
}

/** Picker order: oldest season first. */
export function sortSeasons(seasons: Season[]): Season[] {
  return [...seasons].sort((a, b) =>
    a.startsOn !== b.startsOn ? (a.startsOn < b.startsOn ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1,
  )
}

// --- Weekends --------------------------------------------------------------------

/** One Fri · Sat · Sun weekend, as ISO dates. */
export interface Weekend {
  fri: string
  sat: string
  sun: string
}

/**
 * The Friday of the weekend a date belongs to. Fri/Sat/Sun belong to their
 * own weekend; Mon–Thu belong to the weekend that ends their (Mon–Sun) week —
 * which is how a weekday-dated item finds the weekend card it hangs off.
 */
export function weekendFriday(iso: string): string {
  const dow = weekdayOf(iso)
  if (dow === 0) return addDays(iso, -2)
  return addDays(iso, 5 - dow)
}

const weekendFrom = (fri: string): Weekend => ({ fri, sat: addDays(fri, 1), sun: addDays(fri, 2) })

/** "Oct 2 – 4", or "Oct 30 – Nov 1" across a month line. */
export function weekendLabel(w: Weekend): string {
  const [, fm] = w.fri.split('-')
  const [, sm, sd] = w.sun.split('-')
  return fm === sm ? `${formatDate(w.fri)} – ${Number(sd)}` : `${formatDate(w.fri)} – ${formatDate(w.sun)}`
}

/**
 * The season's remaining weekends: from the weekend containing (or next
 * after) max(today, season start) through the last one whose Friday is on or
 * before the season's end. A weekend counts while its Sunday ≥ today, so on a
 * Sunday this weekend is still listed. Whole Fri–Sun triples, even where the
 * season starts or ends mid-weekend — `weekendDays` trims to the plannable
 * days. Empty once the season is over.
 */
export function weekends(season: Pick<Season, 'startsOn' | 'endsOn'>, today: string): Weekend[] {
  const from = today > season.startsOn ? today : season.startsOn
  const out: Weekend[] = []
  for (let fri = weekendFriday(from); fri <= season.endsOn; fri = addDays(fri, 7)) {
    const w = weekendFrom(fri)
    if (w.sun >= today) out.push(w)
  }
  return out
}

/** The plannable weekend days, flattened in order — the "Plan for…" chips:
 *  inside the season's range and not already past. */
export function weekendDays(season: Pick<Season, 'startsOn' | 'endsOn'>, today: string): string[] {
  return weekends(season, today)
    .flatMap((w) => [w.fri, w.sat, w.sun])
    .filter((d) => d >= today && d >= season.startsOn && d <= season.endsOn)
}

// --- Days -------------------------------------------------------------------------

/** Items keyed by the day they sit on (dayOf), each day in position order.
 *  Items with no day are left out. Done items stay (they render checked). */
export function itemsByDay(items: SeasonItem[]): Map<string, SeasonItem[]> {
  const out = new Map<string, SeasonItem[]>()
  for (const item of byPosition(items)) {
    const day = dayOf(item)
    if (!day) continue
    const list = out.get(day)
    if (list) list.push(item)
    else out.set(day, [item])
  }
  return out
}

/** One weekend card: its three day columns plus the weekday-dated items of
 *  its week (a fixed Wednesday event), as an "Other days" line. */
export interface WeekendPlan {
  weekend: Weekend
  fri: SeasonItem[]
  sat: SeasonItem[]
  sun: SeasonItem[]
  /** Mon–Thu items of this weekend's week, by day then position. */
  otherDays: SeasonItem[]
}

/** Lay items out onto weekend cards (see WeekendPlan). Items on days outside
 *  every listed weekend are left out. */
export function weekendPlans(items: SeasonItem[], list: Weekend[]): WeekendPlan[] {
  const byDay = itemsByDay(items)
  return list.map((weekend) => {
    const otherDays: SeasonItem[] = []
    // Mon–Thu before this Friday: Friday − 4 … Friday − 1.
    for (let back = 4; back >= 1; back--) otherDays.push(...(byDay.get(addDays(weekend.fri, -back)) ?? []))
    return {
      weekend,
      fri: byDay.get(weekend.fri) ?? [],
      sat: byDay.get(weekend.sat) ?? [],
      sun: byDay.get(weekend.sun) ?? [],
      otherDays,
    }
  })
}

/** Open items that still need a day, soonest deadline first (no deadline
 *  last), then position. Top-level items and sub-options alike. */
export function unplanned(items: SeasonItem[]): SeasonItem[] {
  return byPosition(items.filter((item) => !isDone(item) && !dayOf(item))).sort((a, b) => {
    if (a.byOn === b.byOn) return 0
    if (a.byOn === null) return 1
    if (b.byOn === null) return -1
    return a.byOn < b.byOn ? -1 : 1
  })
}

/** Planned days that slipped by undone, oldest first — so they can be
 *  re-planned. Fixed-date items are left out: the event is simply past. */
export function missed(items: SeasonItem[], today: string): SeasonItem[] {
  return byPosition(items.filter((item) => !isDone(item) && !isFixed(item) && item.plannedOn !== null && item.plannedOn < today)).sort(
    (a, b) => (a.plannedOn! < b.plannedOn! ? -1 : a.plannedOn! > b.plannedOn! ? 1 : 0),
  )
}

// --- Deadlines ---------------------------------------------------------------------

export type UrgencyLevel = 'ok' | 'urgent' | 'overdue'

export interface Urgency {
  level: UrgencyLevel
  /** Weekends with at least one day in [today, byOn]. */
  weekendsLeft: number
  /** Weekend days in [today, byOn]. */
  weekendDaysLeft: number
}

/** A deadline this many weekends out (or fewer) is urgent. */
export const URGENT_WEEKENDS = 2

/**
 * How pressing an open, unplanned item's deadline is, counted in the
 * season's remaining weekends (the `weekends` list). The deadline day itself
 * still counts ("by 10/31" includes the 31st). null when there's nothing to
 * warn about: done, already has a day, or no deadline.
 */
export function urgency(item: SeasonItem, today: string, list: Weekend[]): Urgency | null {
  if (isDone(item) || dayOf(item) || !item.byOn) return null
  const by = item.byOn
  let weekendsLeft = 0
  let weekendDaysLeft = 0
  for (const w of list) {
    const days = [w.fri, w.sat, w.sun].filter((d) => d >= today && d <= by).length
    weekendDaysLeft += days
    if (days) weekendsLeft += 1
  }
  const level: UrgencyLevel = by < today ? 'overdue' : weekendsLeft <= URGENT_WEEKENDS ? 'urgent' : 'ok'
  return { level, weekendsLeft, weekendDaysLeft }
}

// --- Sections ----------------------------------------------------------------------

/** A top-level item with its sub-options (position order). */
export interface ItemNode {
  item: SeasonItem
  children: SeasonItem[]
}
export interface SubsectionGroup {
  /** '' = the section's un-headed items. */
  subsection: string
  nodes: ItemNode[]
}
export interface SectionGroup {
  section: string
  subsections: SubsectionGroup[]
}

/**
 * The bucket list's shape: sections → subsections → top-level items with
 * their children. Section and subsection order is the lowest position among
 * their items, so they keep the order they were written in. A child always
 * renders under its parent (whatever its own section says); a child whose
 * parent isn't in `items` (filtered out) stands in as a top-level node.
 */
export function groupSections(items: SeasonItem[]): SectionGroup[] {
  const sorted = byPosition(items)
  const present = new Set(sorted.map((i) => i.id))
  const childrenOf = new Map<string, SeasonItem[]>()
  const roots: SeasonItem[] = []
  for (const item of sorted) {
    if (item.parentId && present.has(item.parentId)) {
      const list = childrenOf.get(item.parentId)
      if (list) list.push(item)
      else childrenOf.set(item.parentId, [item])
    } else {
      roots.push(item)
    }
  }
  // Group order = min position of every item in it, children included.
  const minPos = (node: ItemNode) => Math.min(node.item.position, ...node.children.map((c) => c.position))
  const sections = new Map<string, Map<string, ItemNode[]>>()
  for (const root of roots) {
    const node = { item: root, children: childrenOf.get(root.id) ?? [] }
    let subs = sections.get(root.section)
    if (!subs) sections.set(root.section, (subs = new Map()))
    const nodes = subs.get(root.subsection)
    if (nodes) nodes.push(node)
    else subs.set(root.subsection, [node])
  }
  const groupMin = (nodes: ItemNode[]) => Math.min(...nodes.map(minPos))
  return [...sections.entries()]
    .map(([section, subs]) => ({
      section,
      subsections: [...subs.entries()]
        .map(([subsection, nodes]) => ({ subsection, nodes }))
        .sort((a, b) => groupMin(a.nodes) - groupMin(b.nodes)),
    }))
    .sort((a, b) => groupMin(a.subsections.flatMap((s) => s.nodes)) - groupMin(b.subsections.flatMap((s) => s.nodes)))
}

/** Distinct sections in bucket-list order — the section pill row. */
export const sectionKeys = (items: SeasonItem[]): string[] => groupSections(items).map((g) => g.section)

/** Distinct subsections used under one section (the item modal's
 *  autocomplete), in order; '' left out. */
export function subsectionsOf(items: SeasonItem[], section: string): string[] {
  const group = groupSections(items).find((g) => g.section === section)
  return group ? group.subsections.map((s) => s.subsection).filter(Boolean) : []
}

/** Section pills AND status pills (both tri-state). Filtered per item; a
 *  child whose parent drops out shows top-level (see groupSections). */
export function filterItems(items: SeasonItem[], sections: TriFilterState, statuses: TriFilterState): SeasonItem[] {
  const sectionOk = triMatcher(sections)
  const statusOk = triMatcher(statuses)
  return items.filter((item) => sectionOk([item.section]) && statusOk([itemStatus(item)]))
}

// --- Nesting ---------------------------------------------------------------------------

/**
 * Whether `itemId` (null = a new item) may sit under `parentId`. One level
 * only: the parent must be a top-level item of the same season, not the item
 * itself, and an item that already has sub-options can't become one.
 */
export function canNestUnder(items: SeasonItem[], itemId: string | null, parentId: string, seasonId: string): boolean {
  if (parentId === itemId) return false
  const parent = items.find((i) => i.id === parentId)
  if (!parent || parent.parentId !== null || parent.seasonId !== seasonId) return false
  if (itemId && items.some((i) => i.parentId === itemId)) return false
  return true
}

/** Top-level items of one season's subsection — the item modal's parent
 *  choices (minus the item itself). */
export function parentChoices(items: SeasonItem[], seasonId: string, section: string, subsection: string, itemId: string | null): SeasonItem[] {
  return byPosition(
    items.filter((i) => i.seasonId === seasonId && i.parentId === null && i.section === section && i.subsection === subsection && i.id !== itemId),
  )
}

// --- Positions -------------------------------------------------------------------------

/** Position that appends to the end of a season. */
export function nextPosition(items: SeasonItem[], seasonId: string): number {
  let max = 0
  for (const item of items) if (item.seasonId === seasonId && item.position > max) max = item.position
  return max + 1
}

/** Position right after `id` (before its next neighbor in the season) — where
 *  a duplicate goes. Falls back to the season's end if float precision has
 *  run out between the two. */
export function positionAfter(items: SeasonItem[], id: string): number {
  const original = items.find((i) => i.id === id)
  if (!original) return 1
  const season = byPosition(itemsOfSeason(items, original.seasonId))
  const next = season.find((i) => i.position > original.position)
  return positionBetween(original.position, next ? next.position : null) ?? nextPosition(items, original.seasonId)
}

// --- Cascades & copies -------------------------------------------------------------------

/** Drop a deleted season's items — the local mirror of the DB cascade. */
export const pruneSeason = (items: SeasonItem[], seasonId: string): SeasonItem[] =>
  items.filter((item) => item.seasonId !== seasonId)

/** Drop an item and its sub-options — the local mirror of the parent_id
 *  cascade (one level deep, so one pass is enough). */
export const pruneItem = (items: SeasonItem[], id: string): SeasonItem[] =>
  items.filter((item) => item.id !== id && item.parentId !== id)

/**
 * Clone one season's items into another (the "Copy items from" option on a
 * new season). Keeps section / subsection / title / note / url / position and
 * the parent structure — every parent id is remapped to its clone's new id —
 * but clears all four dates: last year's plans and check-offs don't carry
 * over. Parents come before their children, so a row-by-row insert never
 * references an id that doesn't exist yet. A child whose parent isn't in the
 * source (can't happen with the FK) comes over top-level.
 */
export function cloneSeasonItems(
  source: SeasonItem[],
  toSeasonId: string,
  newId: () => string,
  createdBy: string | null,
  createdAt: string,
): SeasonItem[] {
  const ordered = byPosition(source)
  const idMap = new Map(ordered.map((item) => [item.id, newId()]))
  const clones = ordered.map((item) => ({
    id: idMap.get(item.id)!,
    seasonId: toSeasonId,
    parentId: item.parentId ? (idMap.get(item.parentId) ?? null) : null,
    section: item.section,
    subsection: item.subsection,
    title: item.title,
    note: item.note,
    url: item.url,
    position: item.position,
    fixedOn: null,
    byOn: null,
    plannedOn: null,
    doneOn: null,
    createdBy,
    createdAt,
  }))
  return [...clones.filter((c) => c.parentId === null), ...clones.filter((c) => c.parentId !== null)]
}
