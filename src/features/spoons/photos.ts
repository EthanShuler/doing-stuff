import { supabase } from '../../lib/supabase'
import { downscaleImage } from '../../lib/image'

// Spoon photos live in the public `spoons` storage bucket under a
// `<space_id>/<uuid>.jpg` path (storage RLS lets only that space's members
// write there — see schema.sql). The row stores the resulting public URL, so
// grid cards and map pins are plain <img> tags with no signed-URL plumbing.

const BUCKET = 'spoons'
const PUBLIC_PATH_MARKER = `/object/public/${BUCKET}/`

/**
 * Downscale and upload a photo, returning its public URL. Throws when the
 * file can't be processed or the upload fails (the modal surfaces it).
 * Keyless seed mode returns a local object URL instead — the preview works,
 * and it vanishes on reload like every other seed-mode edit.
 */
export async function uploadSpoonPhoto(spaceId: string | null, file: File): Promise<string> {
  const blob = await downscaleImage(file)
  if (!supabase || !spaceId) return URL.createObjectURL(blob)
  const path = `${spaceId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Best-effort removal of an uploaded photo (spoon deleted, or its photo
 * replaced). Fire-and-forget: a leaked object costs a few hundred KB and
 * nothing user-visible, so failures are deliberately swallowed. URLs outside
 * our bucket (seed object URLs) are ignored.
 */
export function removeSpoonPhoto(url: string): void {
  if (!supabase) return
  const idx = url.indexOf(PUBLIC_PATH_MARKER)
  if (idx === -1) return
  const path = decodeURIComponent(url.slice(idx + PUBLIC_PATH_MARKER.length).split('?')[0])
  if (path) void supabase.storage.from(BUCKET).remove([path])
}
