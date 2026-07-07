// Title → poster lookup via TMDB (themoviedb.org), keyed by VITE_TMDB_API_KEY —
// a public browser key, same posture as the Supabase anon key. Search is
// debounced by the caller and only runs while typing in the add/edit item
// modal; picking a result just fills the title + poster URL fields, so the
// stored data stays plain text/URLs with no TMDB coupling.
//
// TMDB attribution requirement: "This product uses the TMDB API but is not
// endorsed or certified by TMDB" — surfaced in the modal hint.

export interface TmdbResult {
  id: number
  title: string
  /** Release year, e.g. '2019' — '' when TMDB doesn't know. */
  year: string
  /** Full-size poster URL (w342, what we store) — '' when the result has none. */
  posterUrl: string
  /** Small poster URL (w92) for the suggestion dropdown. */
  thumbUrl: string
}

const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined
const SEARCH_ENDPOINT = 'https://api.themoviedb.org/3/search'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'

export const isTmdbConfigured = Boolean(API_KEY)

/**
 * Search TMDB for movies or TV shows matching a title. Returns [] when the key
 * is missing, the query is blank, or the request fails — lookup is a
 * convenience, never a blocker (typing a title by hand always still works).
 */
export async function searchTmdb(kind: 'movie' | 'tv', query: string): Promise<TmdbResult[]> {
  const q = query.trim()
  if (!API_KEY || !q) return []

  try {
    const url = `${SEARCH_ENDPOINT}/${kind}?api_key=${API_KEY}&query=${encodeURIComponent(q)}&include_adult=false`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = (await res.json()) as {
      results?: Array<{
        id: number
        title?: string // movies
        name?: string // tv
        release_date?: string // movies
        first_air_date?: string // tv
        poster_path?: string | null
      }>
    }
    return (data.results ?? [])
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        title: r.title ?? r.name ?? '',
        year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
        posterUrl: r.poster_path ? `${IMAGE_BASE}/w342${r.poster_path}` : '',
        thumbUrl: r.poster_path ? `${IMAGE_BASE}/w92${r.poster_path}` : '',
      }))
      .filter((r) => r.title)
  } catch {
    return []
  }
}
