import { removeBucketPhoto, uploadBucketPhoto } from '../../lib/photos'

// Spoon photos live in the public `spoons` storage bucket — see
// src/lib/photos.ts for the shared upload/cleanup mechanics.

const BUCKET = 'spoons'

/** Downscale + upload a spoon photo, returning its public URL (throws on failure). */
export const uploadSpoonPhoto = (spaceId: string | null, file: File): Promise<string> =>
  uploadBucketPhoto(BUCKET, spaceId, file)

/** Best-effort removal of an uploaded spoon photo (fire-and-forget). */
export const removeSpoonPhoto = (url: string): void => removeBucketPhoto(BUCKET, url)
