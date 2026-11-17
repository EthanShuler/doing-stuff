import { supabase } from './supabase'
import { downscaleImage } from './image'

// Shared Supabase Storage plumbing for photo-carrying features (spoons,
// recipes, little guys). Photos live in a PUBLIC bucket under a
// `<space_id>/<uuid>.jpg` path (storage RLS lets only that space's members
// write there — see schema.sql). Rows store the resulting public URL, so the UI renders plain
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

/** The object path of a public `bucket` URL, or null for a URL that isn't one
 *  (a seed object URL, a pasted link). */
function bucketPath(bucket: string, url: string): string | null {
  const marker = `/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]) || null
}

/**
 * Best-effort removal of an uploaded photo (its row deleted, the photo
 * replaced, or an upload abandoned — see photoSession.ts). Fire-and-forget: a
 * leaked object costs a few hundred KB and nothing user-visible, so failures
 * are deliberately swallowed. Seed object URLs are revoked instead; other
 * URLs outside the bucket are ignored.
 */
export function removeBucketPhoto(bucket: string, url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
    return
  }
  if (!supabase) return
  const path = bucketPath(bucket, url)
  if (path) void supabase.storage.from(bucket).remove([path])
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not copy the photo (HTTP ${res.status}).`)
  return res.blob()
}

/**
 * Copy a photo into another space for a cross-space pull, returning the URL
 * the pulled row should store. The object is DUPLICATED rather than shared:
 * deleting either row runs removeBucketPhoto on its URL, so a shared object
 * would vanish from under the other space's row.
 *
 * The bytes go up as-is — deliberately not through uploadBucketPhoto, whose
 * downscale re-encodes the JPEG (losing quality) on every hop.
 *
 *   • '' → '' (no photo).
 *   • A `blob:` URL (keyless seed mode) → a fresh object URL of the same bytes,
 *     so revoking either row's URL leaves the other's intact.
 *   • Keyless, or a URL that isn't a public object of `bucket` (nothing
 *     here owns it, and removeBucketPhoto ignores it) → returned unchanged.
 *   • Otherwise: fetch (public bucket URLs answer with
 *     `access-control-allow-origin: *`) → upload to `<toSpaceId>/<uuid>.jpg`
 *     → its public URL.
 *
 * Throws when the fetch or the upload fails; the caller decides whether the
 * row goes ahead without its photo.
 */
export async function copyBucketPhoto(bucket: string, sourceUrl: string, toSpaceId: string | null): Promise<string> {
  if (!sourceUrl) return ''
  if (sourceUrl.startsWith('blob:')) return URL.createObjectURL(await fetchBlob(sourceUrl))
  if (!supabase || !toSpaceId || !bucketPath(bucket, sourceUrl)) return sourceUrl
  const blob = await fetchBlob(sourceUrl)
  const path = `${toSpaceId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
