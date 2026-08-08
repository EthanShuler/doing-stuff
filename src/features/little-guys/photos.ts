import { removeBucketPhoto, uploadBucketPhoto } from '../../lib/photos'

// Little guy photos live in the public `little-guys` storage bucket — see
// src/lib/photos.ts for the shared upload/cleanup mechanics.

const BUCKET = 'little-guys'

/** Downscale + upload a little guy photo, returning its public URL (throws on failure). */
export const uploadLittleGuyPhoto = (spaceId: string | null, file: File): Promise<string> =>
  uploadBucketPhoto(BUCKET, spaceId, file)

/** Best-effort removal of an uploaded little guy photo (fire-and-forget). */
export const removeLittleGuyPhoto = (url: string): void => removeBucketPhoto(BUCKET, url)
