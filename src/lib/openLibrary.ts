// Book title → cover lookup via Open Library (openlibrary.org, run by the
// Internet Archive). Same posture as tmdb.ts — search is debounced by the
// caller and only runs while typing in the add/edit item modal; picking a
// result just fills the title + cover URL fields, so the stored rows stay
// plain text/URLs with no Open Library coupling. Unlike TMDB there is no API
// key at all; covers.openlibrary.org serves plain image URLs.
//
// Rate policy is "be polite" (like Nominatim): never search per render or
// without a debounce, and keep result counts small.

export interface OpenLibraryResult {
  /** Open Library work key, e.g. "/works/OL20126932W" — a stable dropdown key. */
  id: string
  title: string
  /** First listed author — '' when Open Library doesn't know. */
  author: string
  /** First publish year, e.g. '2020' — '' when unknown. */
  year: string
  /** Medium cover URL (what we store) — '' when the work has no cover. */
  coverUrl: string
  /** Small cover URL for the suggestion dropdown. */
  thumbUrl: string
}

const SEARCH_ENDPOINT = 'https://openlibrary.org/search.json'
const COVER_BASE = 'https://covers.openlibrary.org/b/id'

/**
 * Search Open Library for books matching a title. Returns [] when the query is
 * blank or the request fails — lookup is a convenience, never a blocker
 * (typing a title by hand always still works).
 */
export async function searchOpenLibrary(query: string): Promise<OpenLibraryResult[]> {
  const q = query.trim()
  if (!q) return []

  try {
    const fields = 'key,title,author_name,first_publish_year,cover_i'
    const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}&fields=${fields}&limit=6`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = (await res.json()) as {
      docs?: Array<{
        key?: string
        title?: string
        author_name?: string[]
        first_publish_year?: number
        cover_i?: number
      }>
    }
    return (data.docs ?? [])
      .map((doc, i) => ({
        id: doc.key ?? `result-${i}`,
        title: doc.title ?? '',
        author: doc.author_name?.[0] ?? '',
        year: doc.first_publish_year ? String(doc.first_publish_year) : '',
        coverUrl: doc.cover_i ? `${COVER_BASE}/${doc.cover_i}-M.jpg` : '',
        thumbUrl: doc.cover_i ? `${COVER_BASE}/${doc.cover_i}-S.jpg` : '',
      }))
      .filter((r) => r.title)
  } catch {
    return []
  }
}
