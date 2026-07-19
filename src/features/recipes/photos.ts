import { removeBucketPhoto, uploadBucketPhoto } from '../../lib/photos'

// Recipe photos live in the public `recipes` storage bucket — see
// src/lib/photos.ts for the shared upload/cleanup mechanics.

const BUCKET = 'recipes'

/** Downscale + upload a recipe photo, returning its public URL (throws on failure). */
export const uploadRecipePhoto = (spaceId: string | null, file: File): Promise<string> =>
  uploadBucketPhoto(BUCKET, spaceId, file)

/** Best-effort removal of an uploaded recipe photo (fire-and-forget). */
export const removeRecipePhoto = (url: string): void => removeBucketPhoto(BUCKET, url)
