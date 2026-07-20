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

/** The tri-state filter predicate. Includes are OR (any selected tag matches —
 *  the pills widen, not narrow); anything carrying an excluded tag is dropped
 *  even if it also matches an include. Untagged rows survive an exclude-only
 *  filter ("everything besides disney" keeps the untagged ones) but not an
 *  include filter. Empty selections match everything. */
export function tagMatcher(included: string[], excluded: string[]): (tags: string[]) => boolean {
  const wanted = new Set(included.map(tagKey))
  const banned = new Set(excluded.map(tagKey))
  return (tags) => {
    if (tags.some((tag) => banned.has(tagKey(tag)))) return false
    return wanted.size === 0 || tags.some((tag) => wanted.has(tagKey(tag)))
  }
}
