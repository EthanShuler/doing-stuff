const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-06-12" -> "Jun 12" */
export function formatDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`
}

/** Today as an ISO date string ("YYYY-MM-DD"). */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
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
