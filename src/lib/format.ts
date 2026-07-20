const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-06-12" -> "Jun 12" */
export function formatDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`
}

/** "2026-06-12" -> "Jun 12, 2026" — for collections that span years (spoons). */
export function formatDateWithYear(iso: string): string {
  const [year] = iso.split('-')
  return `${formatDate(iso)}, ${year}`
}

/** A year/month pair (month is 1-based, e.g. 6 = June) identifying a calendar page. */
export interface YearMonth {
  year: number
  month: number
}

/** The YearMonth containing today. */
export function currentYearMonth(): YearMonth {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/** "June 2026" — the calendar header label. */
export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTHS_LONG[month - 1]} ${year}`
}

/** Step a YearMonth forward (+1) or backward (-1) by one month, rolling the year. */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const zeroBased = month - 1 + delta
  return { year: year + Math.floor(zeroBased / 12), month: ((zeroBased % 12) + 12) % 12 + 1 }
}

/** ISO date ("YYYY-MM-DD") for a given year, 1-based month, and day-of-month. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Today as an ISO date string ("YYYY-MM-DD"), in the user's local timezone
 *  (not UTC — `toISOString()` would report tomorrow during the evening for
 *  anyone west of UTC, skewing default dates, stats, and the calendar). */
export function today(): string {
  const now = new Date()
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** Comparator half for "dated rows newest first, undated after (newest
 *  created first)" — the shared timeline order of the spoon grid and park
 *  visit history. Pass each row's optional date and its createdAt. */
export function compareDatedDesc(
  aDate: string | null,
  aCreated: string,
  bDate: string | null,
  bCreated: string,
): number {
  if (aDate && bDate && aDate !== bDate) return aDate < bDate ? 1 : -1
  if (Boolean(aDate) !== Boolean(bDate)) return aDate ? -1 : 1
  return aCreated < bCreated ? 1 : aCreated > bCreated ? -1 : 0
}

/** The local calendar date ("YYYY-MM-DD") of a full timestamp string. Never
 *  slice a UTC timestamptz for display — an evening save west of UTC would
 *  read as tomorrow. */
export function localDateOf(timestamp: string): string {
  const d = new Date(timestamp)
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** "YYYY-MM" prefix for the current month, used for the "this month" stat. */
export function currentMonthPrefix(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function stars(rating: number): { filled: string; empty: string } {
  const clamped = Math.max(0, Math.min(5, rating))
  return { filled: '★'.repeat(clamped), empty: '★'.repeat(5 - clamped) }
}
