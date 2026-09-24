import { keysMatcher } from './triFilter'

// Shared free-text tag semantics (tier boards + recipes): tags are stored as
// the user typed them, but compared case-insensitively so "Disney" and
// "disney" behave as one tag even if both spellings were saved.

/** Case-insensitive tag identity. */
export const tagKey = (tag: string) => tag.trim().toLowerCase()

/** Every tag in use across the given tag lists, deduped case-insensitively
 *  (first spelling seen wins) and sorted alphabetically. Drives filter pills
 *  and modal tag suggestions. */
export function distinctTagList(tagLists: Iterable<string[]>): string[] {
  const byKey = new Map<string, string>()
  for (const tags of tagLists) {
    for (const tag of tags) {
      const key = tagKey(tag)
      if (key && !byKey.has(key)) byKey.set(key, tag.trim())
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** The tri-state tag predicate (see keysMatcher in src/lib/triFilter.ts),
 *  compared case-insensitively. */
export function tagMatcher(included: string[], excluded: string[]): (tags: string[]) => boolean {
  const matches = keysMatcher(included.map(tagKey), excluded.map(tagKey))
  return (tags) => matches(tags.map(tagKey))
}
