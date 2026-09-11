/**
 * Render-time image sizing for the two poster/cover CDNs we link to.
 *
 * Both TMDB and Open Library encode the size in the URL path, so the right
 * size for a given box is a pure string rewrite — no API call, no new stored
 * data. We do it **at render time only**: the URL saved on the row stays
 * exactly what the provider (or a hand-paste) gave us. That matters because
 * other code parses stored URLs — `removeBucketPhoto` in `src/lib/photos.ts`
 * pulls the storage path back out of one — and because the card size is a UI
 * decision that can change without a migration.
 *
 * Anything we don't recognise (Supabase Storage objects, hand-pasted links,
 * `blob:` previews, '') passes through untouched.
 */

/** The poster widths TMDB actually serves, ascending. */
const TMDB_WIDTHS = [92, 154, 185, 342, 500, 780]

const TMDB_RE = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)(w\d+|original)(\/.+)$/
const OPEN_LIBRARY_RE = /^(https?:\/\/covers\.openlibrary\.org\/b\/(?:id|isbn|olid)\/[^/-]+)-(?:S|M|L)(\.jpg)$/

/** Cap the DPR multiplier: past 2× the extra bytes buy nothing visible. */
const MAX_DPR = 2

function effectiveDpr(dpr?: number): number {
  const raw = dpr ?? (typeof window === 'undefined' ? 1 : window.devicePixelRatio) ?? 1
  return Math.min(raw > 0 ? raw : 1, MAX_DPR)
}

/**
 * Rewrite `url` to the smallest provider size that still covers a
 * `targetWidth` CSS-pixel box on this display.
 *
 * @param targetWidth the rendered width in CSS pixels (76 for a board card,
 *   38 for a watchlist thumb).
 * @param dpr device pixel ratio override — pass it explicitly in tests;
 *   defaults to `window.devicePixelRatio`, capped at 2.
 */
export function posterSrc(url: string, targetWidth: number, dpr?: number): string {
  if (!url) return url
  const devicePx = targetWidth * effectiveDpr(dpr)

  const tmdb = TMDB_RE.exec(url)
  if (tmdb) {
    const [, prefix, , path] = tmdb
    const width = TMDB_WIDTHS.find((w) => w >= devicePx)
    return `${prefix}${width ? `w${width}` : 'original'}${path}`
  }

  const openLibrary = OPEN_LIBRARY_RE.exec(url)
  if (openLibrary) {
    const [, prefix, suffix] = openLibrary
    // Open Library's three sizes are roughly 45 / 180 / 500 px wide.
    const size = devicePx <= 45 ? 'S' : devicePx <= 180 ? 'M' : 'L'
    return `${prefix}-${size}${suffix}`
  }

  return url
}
