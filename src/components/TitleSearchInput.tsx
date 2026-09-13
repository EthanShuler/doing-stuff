import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Text, TextInput, UnstyledButton } from '@mantine/core'
import type { MantineSize } from '@mantine/core'
import { colors, fonts, radii, shadows, text } from '../theme'
import { isTmdbConfigured, searchTmdb } from '../lib/tmdb'
import { searchOpenLibrary } from '../lib/openLibrary'

/** Which provider backs the suggestions — null means "plain input, no lookup"
 *  (a space-defined tier list, a free-form list). */
export type SearchKind = 'movie' | 'tv' | 'book' | null

/** One dropdown row, whichever provider it came from (TMDB or Open Library). */
export interface TitleSuggestion {
  key: string
  title: string
  /** Secondary line — release year for TMDB, "author · year" for books. */
  meta: string
  imageUrl: string
  thumbUrl: string
  /** Creator to prefill on pick — the author for books; '' for TMDB results
   *  (its search response doesn't carry a director). */
  creator: string
}

/**
 * Whether a kind has a title-lookup provider at all. Books use Open Library,
 * which needs no key, so they're always searchable; movies and TV use TMDB,
 * which is only there when the public browser key is configured. Callers use
 * this to decide whether to credit the provider in a hint line.
 */
export function canSearch(kind: SearchKind): boolean {
  return kind === 'book' || ((kind === 'movie' || kind === 'tv') && isTmdbConfigured)
}

/**
 * A title field with debounced TMDB / Open Library suggestions under it.
 *
 * Lookup is a convenience: hand-typed titles work exactly as they would in a
 * plain `TextInput`, and with `searchKind={null}` that's all this is. The
 * dropdown only appears once the user actually types (so an edit field opening
 * with a full title doesn't pop it open) and hides again on blur or on a pick.
 *
 * Interaction contract: a suggestion is picked on **mousedown** (with
 * `preventDefault`), so the pick lands before the input's blur tears the
 * dropdown down. `onSubmit` fires on **Enter** and means "commit the text
 * that's typed" — it is never how a suggestion is chosen, so a caller that
 * adds a row on Enter can't accidentally get a highlighted suggestion instead.
 */
export function TitleSearchInput({
  searchKind,
  value,
  onChange,
  onPick,
  onSubmit,
  label,
  placeholder,
  autoFocus,
  size,
  emoji,
  rightSection,
}: {
  searchKind: SearchKind
  value: string
  onChange: (value: string) => void
  /** A suggestion was chosen — the caller decides which fields it fills. */
  onPick: (suggestion: TitleSuggestion) => void
  /** Enter was pressed: commit `value` as typed. Omitted = Enter does nothing. */
  onSubmit?: () => void
  label?: string
  placeholder: string
  /** Sets both `data-autofocus` (Mantine modals) and the native attribute. */
  autoFocus?: boolean
  size?: MantineSize
  /** Fallback thumb in the dropdown for a result with no cover. */
  emoji: string
  rightSection?: ReactNode
}) {
  const searchEnabled = canSearch(searchKind)
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (!showSuggestions || !searchEnabled || !searchKind) return
    const query = value.trim()
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    // Debounce, and drop responses that land after the query changed again.
    let cancelled = false
    const timer = setTimeout(async () => {
      const results: TitleSuggestion[] =
        searchKind === 'book'
          ? (await searchOpenLibrary(query)).map((b) => ({
              key: b.id,
              title: b.title,
              meta: [b.author, b.year].filter(Boolean).join(' · '),
              imageUrl: b.coverUrl,
              thumbUrl: b.thumbUrl,
              creator: b.author,
            }))
          : (await searchTmdb(searchKind, query)).map((r) => ({
              key: String(r.id),
              title: r.title,
              meta: r.year,
              imageUrl: r.posterUrl,
              thumbUrl: r.thumbUrl,
              creator: '',
            }))
      if (!cancelled) setSuggestions(results)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, searchKind, showSuggestions, searchEnabled])

  const pickSuggestion = (result: TitleSuggestion) => {
    onPick(result)
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <Box pos="relative">
      <TextInput
        label={label}
        value={value}
        onChange={(e) => {
          onChange(e.currentTarget.value)
          setShowSuggestions(true)
        }}
        onBlur={() => setShowSuggestions(false)}
        onKeyDown={
          onSubmit
            ? (e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                setSuggestions([])
                setShowSuggestions(false)
                onSubmit()
              }
            : undefined
        }
        placeholder={placeholder}
        size={size}
        rightSection={rightSection}
        data-autofocus={autoFocus || undefined}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <Box
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            background: colors.surface,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: radii.chip,
            boxShadow: shadows.popover,
            overflowY: 'auto',
            maxHeight: 264,
          }}
        >
          {suggestions.map((result) => (
            <UnstyledButton
              key={result.key}
              // onMouseDown (with preventDefault) so the pick lands
              // before the input's blur hides the dropdown.
              onMouseDown={(e) => {
                e.preventDefault()
                pickSuggestion(result)
              }}
              w="100%"
              px={10}
              py={7}
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: fonts.sans }}
            >
              {result.thumbUrl ? (
                <img
                  src={result.thumbUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ width: 30, height: 44, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                />
              ) : (
                <Box
                  w={30}
                  h={44}
                  bg={colors.chip}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    flexShrink: 0,
                    fontSize: 15,
                  }}
                >
                  {emoji}
                </Box>
              )}
              <Box>
                <Text fz={text.small} fw={600} c={colors.ink} lh={1.3}>
                  {result.title}
                </Text>
                {result.meta && (
                  <Text fz={text.caption} c={colors.faint}>
                    {result.meta}
                  </Text>
                )}
              </Box>
            </UnstyledButton>
          ))}
        </Box>
      )}
    </Box>
  )
}
