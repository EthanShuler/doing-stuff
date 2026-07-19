/**
 * Fuzzy subsequence match: every character of `query` appears in `text` in
 * order (case-insensitive, whitespace in the query ignored). Empty query
 * matches everything. So "prk" matches "Park" and "botgar" matches
 * "Botanical Garden". Shared by the Log dashboard's and the recipe index's
 * title search.
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const needle = query.toLowerCase().replace(/\s+/g, '')
  if (!needle) return true
  const haystack = text.toLowerCase()
  let i = 0
  for (const char of haystack) {
    if (char === needle[i]) {
      i += 1
      if (i === needle.length) return true
    }
  }
  return false
}
