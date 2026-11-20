// Video game title → cover lookup via IGDB (igdb.com, run by Twitch). Same
// posture as tmdb.ts / openLibrary.ts — search is debounced by the caller and
// only runs while typing in the add/edit item modal; picking a result just
// fills the title, cover URL and developer fields, so stored rows stay plain
// text/URLs with no IGDB coupling.
//
// Unlike TMDB, IGDB can't be called from the browser (it needs a Twitch
// client secret), so the search goes through the `igdb` Edge Function
// (supabase/functions/igdb/). Keyless seed mode has no backend, so no
// suggestions there — hand entry still works.
import { isSupabaseConfigured, supabase } from './supabase'

export interface IgdbResult {
  id: number
  title: string
  /** First release year, e.g. '2017' — '' when IGDB doesn't know. */
  year: string
  /** The first credited developer — '' when unknown. */
  developer: string
  /** Portrait cover URL (cover_big, what we store) — '' when there's none. */
  coverUrl: string
  /** Small cover URL for the suggestion dropdown. */
  thumbUrl: string
}

const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload'

/** Search needs the backend's Edge Function — on whenever Supabase is. */
export const isIgdbConfigured = isSupabaseConfigured

/** The cover URL for an IGDB image id at one of its named sizes. */
export const igdbCoverUrl = (imageId: string, size: 'cover_small' | 'cover_big'): string =>
  imageId ? `${IMAGE_BASE}/t_${size}/${imageId}.jpg` : ''

/**
 * Search IGDB for games matching a title. Returns [] when there's no backend,
 * the query is blank, or the call fails (including the function not being
 * deployed yet) — lookup is a convenience, never a blocker.
 */
export async function searchIgdb(query: string): Promise<IgdbResult[]> {
  const q = query.trim()
  if (!supabase || q.length < 2) return []

  try {
    const { data, error } = await supabase.functions.invoke('igdb', { body: { query: q } })
    if (error || !data) return []
    const rows = (data as {
      results?: Array<{ id: number; title?: string; year?: string; developer?: string; cover_image_id?: string }>
    }).results
    return (rows ?? [])
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        title: r.title ?? '',
        year: r.year ?? '',
        developer: r.developer ?? '',
        coverUrl: igdbCoverUrl(r.cover_image_id ?? '', 'cover_big'),
        thumbUrl: igdbCoverUrl(r.cover_image_id ?? '', 'cover_small'),
      }))
      .filter((r) => r.title)
  } catch {
    return []
  }
}
