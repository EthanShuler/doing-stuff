/**
 * Fuzzy subsequence match: every character of `query` appears in `text` in
 * order (case-insensitive, whitespace in the query ignored). Empty query
 * matches everything. So "prk" matches "Park" and "botgar" matches
 * "Botanical Garden". Shared by the Log dashboard's and the recipe index's
 * title search.
 */
export function fuzzyMatch(text: string, query: string): boolean {
  // Iterate by code point on both sides (spread, not [i] indexing) so an
  // astral query char — an emoji, some CJK — is one needle entry, not two
  // half-surrogates that can never match a single code-point haystack char.
  const needle = [...query.toLowerCase().replace(/\s+/g, '')]
  if (needle.length === 0) return true
  let i = 0
  for (const char of text.toLowerCase()) {
    if (char === needle[i]) {
      i += 1
      if (i === needle.length) return true
    }
  }
  return false
}
