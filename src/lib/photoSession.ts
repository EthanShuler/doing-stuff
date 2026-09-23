import { useState } from 'react'

// Bookkeeping for one add/edit modal's photo uploads (spoons, recipes, little
// guys). Picking a file uploads it straight to the bucket, so every abandoned
// pick — a cancelled modal, a second pick, a failed save then Cancel — would
// otherwise leave an object nothing references. The session remembers the
// photo the record was OPENED with plus whatever it uploaded, and deletes:
//   • on a new pick → the session's earlier upload (never the opened-with one);
//   • on save       → every session upload except the saved one, plus the
//                     opened-with photo if the save moved the row off it;
//   • on discard    → every session upload; the opened-with photo stays.
// Comparing against the opened-with URL (not the store's live row) is what
// keeps a concurrent edit safe: if the partner replaced X→Y meanwhile and we
// save a text-only edit, we never delete Y. (We do write X back onto the row —
// a lost update we accept; X is already gone from the bucket by then, so the
// card falls back to its emoji until someone re-uploads.)

export interface PhotoTracker {
  /** A modal opened on a record whose photo is `original` ('' for none). */
  begin: (original: string) => void
  /** Track an upload started now. Resolves to its URL, or to null when the
   *  session ended while it was in flight (the object is deleted on arrival). */
  track: (upload: Promise<string>) => Promise<string | null>
  /** The row was written pointing at `saved`: delete what's now unreachable. */
  commit: (saved: string) => void
  /** Closed without saving (a no-op right after a commit). */
  discard: () => void
}

/** Plain-JS tracker (no React) so vitest can drive it; `remove` is the
 *  feature's best-effort bucket delete. */
export function createPhotoTracker(remove: (url: string) => void): PhotoTracker {
  let original = ''
  // Session uploads the draft may still point at — only ever the latest pick.
  let uploads: string[] = []
  // Bumped whenever a session starts or ends, to spot late uploads.
  let generation = 0

  const end = (unreachable: string[]) => {
    generation += 1
    original = ''
    uploads = []
    unreachable.forEach(remove)
  }

  return {
    begin: (opened) => {
      generation += 1
      original = opened
      uploads = []
    },
    track: async (upload) => {
      const started = generation
      const url = await upload
      if (started !== generation) {
        remove(url)
        return null
      }
      // The new pick replaces the draft's photo, so an earlier session upload
      // is abandoned now; the opened-with photo waits for the save.
      const abandoned = uploads.filter((u) => u !== url)
      uploads = [url]
      abandoned.forEach(remove)
      return url
    },
    commit: (saved) => {
      const unreachable = uploads.filter((u) => u !== saved)
      if (original && original !== saved) unreachable.push(original)
      end(unreachable)
    },
    discard: () => end(uploads),
  }
}

/** The page-side handle: `begin` on open, `upload` as the modal's onUpload,
 *  `commit` after a successful save, `discard` on close. */
export function usePhotoSession(upload: (file: File) => Promise<string>, remove: (url: string) => void) {
  const [tracker] = useState(() => createPhotoTracker(remove))
  return {
    begin: tracker.begin,
    upload: (file: File) => tracker.track(upload(file)),
    commit: tracker.commit,
    discard: tracker.discard,
  }
}
