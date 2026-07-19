import { supabase } from './supabase'
import { downscaleImage } from './image'

// Shared Supabase Storage plumbing for photo-carrying features (spoons,
// recipes). Photos live in a PUBLIC bucket under a `<space_id>/<uuid>.jpg`
// path (storage RLS lets only that space's members write there — see
// schema.sql). Rows store the resulting public URL, so the UI renders plain
// <img> tags with no signed-URL plumbing.

/**
 * Downscale and upload a photo to `bucket`, returning its public URL. Throws
 * when the file can't be processed or the upload fails (the modal surfaces
 * it). Keyless seed mode returns a local object URL instead — the preview
 * works, and it vanishes on reload like every other seed-mode edit.
 */
export async function uploadBucketPhoto(bucket: string, spaceId: string | null, file: File): Promise<string> {
  const blob = await downscaleImage(file)
  if (!supabase || !spaceId) return URL.createObjectURL(blob)
  const path = `${spaceId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/**
 * Best-effort removal of an uploaded photo (its row deleted, or the photo
 * replaced). Fire-and-forget: a leaked object costs a few hundred KB and
 * nothing user-visible, so failures are deliberately swallowed. URLs outside
 * the bucket (seed object URLs) are ignored.
 */
export function removeBucketPhoto(bucket: string, url: string): void {
  if (!supabase) return
  const marker = `/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
  if (path) void supabase.storage.from(bucket).remove([path])
}
