// Client-side photo downscaling for storage uploads. Phone photos arrive at
// 3–5MB; resizing to a bounded edge before upload keeps the bucket small and
// the map/grid fast, with no server in the loop (matches the app's
// Supabase-only posture).

const MAX_EDGE = 1200
const JPEG_QUALITY = 0.85

/**
 * Downscale an image file so its longest edge is at most 1200px and re-encode
 * as JPEG. Files that are already small still get re-encoded — it normalizes
 * formats (e.g. HEIC decoded by the browser) and strips EXIF. Throws when the
 * file can't be decoded as an image.
 */
export async function downscaleImage(file: File): Promise<Blob> {
  // createImageBitmap respects EXIF orientation in all current browsers, so
  // portrait phone photos come out upright.
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available.')
    // JPEG has no alpha — flatten transparent PNGs onto white, not black.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob) throw new Error("Couldn't process that image.")
    return blob
  } finally {
    bitmap.close()
  }
}
