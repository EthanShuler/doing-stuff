// Keyless seed mode's answer to "what's in the other space?" for a
// cross-space pull.
//
// In seed mode the stores get a null space id (useSpace's `dataSpaceId`), so
// both seed spaces (seedSpaces.ts) show the SAME per-feature seed — there is
// no second space's data to read. A pull's source fetch therefore can't be
// "the store's seed, filtered by space". The convention instead:
//
//   1. Each pulling feature defines ONE fixed, small source dataset next to
//      its store (e.g. `seedTierPullSource()` in useTierListStore.ts,
//      `seedRecipePullSource()` in useRecipeStore.ts), in the same shape its
//      live source fetch returns. A builder function, not a constant, so each
//      call hands back fresh objects a pull can't mutate for the next one.
//   2. The store's source fetch branches like every other action:
//        live → read the source space by `space_id` (RLS lets a member read
//               any space they belong to);
//        seed → `seedPullFetch(seedXPullSource)` — the SAME dataset whichever
//               seed space is picked as the source.
//      It is independent of the store's own seed: never derive one from the
//      other, or editing the store seed silently changes what a pull brings.
//   3. Every row id in a seed source starts with SEED_PULL_ID_PREFIX, so it
//      can't collide with the store seed's ids (u1, m1, r1, …) or idFactory's
//      — and lineage (`copiedFrom = originOf(sourceRow)`) is stable across
//      pulls, which is what makes "pull again → nothing new" testable.
//   4. People are the seed profiles (spaceSync's SEED_PROFILES): the puller
//      is SEED_SELF_ID, so "the puller's own rankings" resolve in seed mode.
//   5. Overlap on purpose: include at least one row whose title matches the
//      store seed under titleKey (lib/text.ts), so the title-match path ("Same
//      title here" / "already here") shows on the very first pull.
//   6. Photos: '' or a plain https URL — copyBucketPhoto returns a non-bucket
//      URL unchanged in seed mode, so nothing is fetched.

/** Prefix for every row id in a feature's seed pull source. */
export const SEED_PULL_ID_PREFIX = 'src-'

/** Resolve a feature's seed pull source like a live fetch would: async, and
 *  a fresh copy on every call. */
export async function seedPullFetch<T>(build: () => T): Promise<T> {
  return build()
}
