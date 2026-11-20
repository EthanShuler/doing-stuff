// Release years for movies, TV, books and games — stored as a plain year
// (`release_year`, null = unknown). The providers return more (TMDB and IGDB
// know the day) but only the year is kept, so a hand-typed "2019" and a
// search pick look the same.

/** The earliest / latest year the DB's CHECK accepts. */
export const MIN_RELEASE_YEAR = 1000
export const MAX_RELEASE_YEAR = 9999

/**
 * Parse a typed year. Blank → null (clears it); a four-digit year → the
 * number; anything else → undefined (invalid, so the caller can say so
 * instead of saving junk).
 */
export function parseReleaseYear(input: string): number | null | undefined {
  const s = input.trim()
  if (!s) return null
  if (!/^\d{4}$/.test(s)) return undefined
  const year = Number(s)
  return year >= MIN_RELEASE_YEAR && year <= MAX_RELEASE_YEAR ? year : undefined
}

/** The year off a provider's ISO date ('2019-05-30' → 2019); null when blank. */
export function yearFromIsoDate(date: string | null | undefined): number | null {
  const m = /^(\d{4})/.exec(date ?? '')
  return m ? Number(m[1]) : null
}

/** The UTC year of a Unix-seconds timestamp (IGDB's `first_release_date`). */
export function yearFromUnix(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined) return null
  return new Date(seconds * 1000).getUTCFullYear()
}
