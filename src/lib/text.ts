// Small text helpers shared across features.

/**
 * Keep just the first grapheme of a string, so an emoji field holds exactly
 * one icon. Grapheme-aware on purpose: it must not split a ZWJ sequence
 * (👨‍👩‍👧) or a surrogate pair down the middle, which `value[0]` would.
 * Falls back to the first code point where Intl.Segmenter is missing.
 *
 * Used by the activity emoji (map pins) and a custom tier list's emoji.
 */
export function firstGrapheme(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const first = new Intl.Segmenter().segment(trimmed)[Symbol.iterator]().next().value
    return first ? first.segment : trimmed
  }
  return [...trimmed][0] ?? trimmed
}

/**
 * The key two titles are "the same title" by: trimmed, lowercased, inner
 * whitespace runs collapsed to one space. Used wherever a write reuses a row
 * by name instead of duplicating it — the Lists check-off finding its tier
 * item, and a cross-space pull matching rows that carry no lineage.
 */
export function titleKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}
