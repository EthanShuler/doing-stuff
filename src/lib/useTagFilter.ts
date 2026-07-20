import { useState } from 'react'

export type TagFilterState = Record<string, 'include' | 'exclude'>

/** The tri-state tag filter shared by the tier boards and the recipe index:
 *  a click cycles off → include → exclude → off. Pair with TagFilterPills for
 *  the pill row and tagMatcher (src/lib/tags.ts) for the filtering itself. */
export function useTagFilter() {
  const [tagFilter, setTagFilter] = useState<TagFilterState>({})
  const includedTags = Object.keys(tagFilter).filter((t) => tagFilter[t] === 'include')
  const excludedTags = Object.keys(tagFilter).filter((t) => tagFilter[t] === 'exclude')
  const filterActive = includedTags.length > 0 || excludedTags.length > 0
  const toggleTag = (tag: string) =>
    setTagFilter((prev) => {
      const next = { ...prev }
      if (prev[tag] === 'include') next[tag] = 'exclude'
      else if (prev[tag] === 'exclude') delete next[tag]
      else next[tag] = 'include'
      return next
    })
  const clearTagFilter = () => setTagFilter({})
  return { tagFilter, includedTags, excludedTags, filterActive, toggleTag, clearTagFilter }
}
