import { useEffect, useState } from 'react'
import { Box, Button, Group, TagsInput, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import type { TierItem, TierKind } from '../../types'
import { colors, DANGER, fonts } from '../../theme'
import { ModalShell } from '../../components/ModalShell'
import { isTmdbConfigured, searchTmdb } from '../../lib/tmdb'
import { searchOpenLibrary } from '../../lib/openLibrary'
import { KIND_COPY } from './copy'
import { CardVisual } from './TierCard'

/** The draft backing the add/edit item modal. */
export interface ItemDraft {
  title: string
  imageUrl: string
  /** ISO date it was finished; '' = not yet (the item sits on the unwatched/
   *  unread shelf until it's dated or dragged into a tier). For movies/TV this
   *  is the shared watched date; for books it's the EDITOR's own read date.
   *  Board items only — list items aren't started yet, so the field is hidden. */
  watchedOn: string
  /** Shared filter labels ("disney", "fantasy"). Board items only. */
  tags: string[]
}

/** One dropdown row, whichever provider it came from (TMDB or Open Library). */
interface Suggestion {
  key: string
  title: string
  /** Secondary line — release year for TMDB, "author · year" for books. */
  meta: string
  imageUrl: string
  thumbUrl: string
}

export function ItemModal({
  opened,
  kind,
  draft,
  isEditing,
  variant = 'board',
  tagSuggestions = [],
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  kind: TierKind
  draft: ItemDraft
  isEditing: boolean
  /** 'board' adds straight to the tier pool; 'watchlist' adds a "want to watch"
   *  item that only reaches the board once it's checked off. Just tweaks copy. */
  variant?: 'board' | 'watchlist'
  /** Tags already used on this kind's items, offered as autocomplete options
   *  so spellings converge instead of forking ("Disney" vs "disney"). */
  tagSuggestions?: string[]
  onChange: (patch: Partial<ItemDraft>) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const copy = KIND_COPY[kind]
  const noun = copy.noun
  const canSave = Boolean(draft.title.trim())
  const isWatchlist = variant === 'watchlist'

  // Title suggestions — TMDB for movies/TV (needs a key), Open Library for
  // books (keyless, so always on). Only shown after the user actually types
  // (so an edit modal opening with a full title doesn't pop the dropdown), and
  // hidden again on blur or pick. Lookup is a convenience — hand-typed titles
  // and pasted URLs work exactly as before.
  const searchEnabled = kind === 'book' || isTmdbConfigured
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (opened) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [opened])

  useEffect(() => {
    if (!opened || !showSuggestions || !searchEnabled) return
    const query = draft.title.trim()
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    // Debounce, and drop responses that land after the query changed again.
    let cancelled = false
    const timer = setTimeout(async () => {
      const results: Suggestion[] =
        kind === 'book'
          ? (await searchOpenLibrary(query)).map((b) => ({
              key: b.id,
              title: b.title,
              meta: [b.author, b.year].filter(Boolean).join(' · '),
              imageUrl: b.coverUrl,
              thumbUrl: b.thumbUrl,
            }))
          : (await searchTmdb(kind, query)).map((r) => ({
              key: String(r.id),
              title: r.title,
              meta: r.year,
              imageUrl: r.posterUrl,
              thumbUrl: r.thumbUrl,
            }))
      if (!cancelled) setSuggestions(results)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [draft.title, kind, opened, showSuggestions, searchEnabled])

  const pickSuggestion = (result: Suggestion) => {
    onChange({ title: result.title, imageUrl: result.imageUrl })
    setSuggestions([])
    setShowSuggestions(false)
  }

  const heading = isWatchlist
    ? isEditing
      ? `Edit ${copy.listLabel.toLowerCase()} item`
      : `Add a ${noun} to ${copy.verb}`
    : isEditing
      ? `Edit ${noun}`
      : `Add a ${noun}`
  const hint = isWatchlist ? copy.listHint : copy.boardHint
  const saveLabel = isEditing ? 'Save changes' : isWatchlist ? `Add to ${copy.listLabel.toLowerCase()}` : `Add ${noun}`
  const deleteLabel = isWatchlist ? `Remove from ${copy.listLabel.toLowerCase()}` : `Delete ${noun}`

  // Live preview of the card exactly as it will render on the board.
  const previewItem: TierItem = {
    id: 'preview',
    kind,
    title: draft.title.trim() || 'Title…',
    imageUrl: draft.imageUrl.trim(),
    watchedOn: null,
    tags: [],
    createdBy: null,
    createdAt: '',
  }

  return (
    <ModalShell opened={opened} onClose={onClose}>
      <Title order={3} fz={28} mb={22}>
        {heading}
      </Title>

      <Group gap={20} align="flex-start" wrap="nowrap">
        <Box flex={1}>
          <Box pos="relative" mb={18}>
            <TextInput
              label="Title"
              value={draft.title}
              onChange={(e) => {
                onChange({ title: e.currentTarget.value })
                setShowSuggestions(true)
              }}
              onBlur={() => setShowSuggestions(false)}
              placeholder={`e.g. ${copy.example}`}
              data-autofocus
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
                  background: '#fff',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 10,
                  boxShadow: '0 10px 28px rgba(40,30,20,0.18)',
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
                        {copy.emoji}
                      </Box>
                    )}
                    <Box>
                      <Text fz={13} fw={600} c={colors.ink} lh={1.3}>
                        {result.title}
                      </Text>
                      {result.meta && (
                        <Text fz={11.5} c={colors.faint}>
                          {result.meta}
                        </Text>
                      )}
                    </Box>
                  </UnstyledButton>
                ))}
              </Box>
            )}
          </Box>
          <TextInput
            label={copy.imageLabel}
            value={draft.imageUrl}
            onChange={(e) => onChange({ imageUrl: e.currentTarget.value })}
            placeholder="Paste an image link (optional)"
            mb={isWatchlist ? 6 : 18}
          />
          {!isWatchlist && (
            <>
              <TextInput
                label={copy.dateLabel}
                type="date"
                value={draft.watchedOn}
                onChange={(e) => onChange({ watchedOn: e.currentTarget.value })}
                mb={18}
              />
              <TagsInput
                label="Tags"
                value={draft.tags}
                onChange={(tags) => onChange({ tags })}
                data={tagSuggestions}
                placeholder={draft.tags.length === 0 ? 'e.g. fantasy, disney (optional)' : undefined}
                mb={6}
              />
            </>
          )}
          <Text fz={12} c={colors.faint} style={{ fontFamily: fonts.sans }}>
            {hint}
            {searchEnabled && ` ${copy.attribution}`}
          </Text>
        </Box>
        {/* Keyed on the URL so pasting a new link retries a broken image. */}
        <Box key={draft.imageUrl.trim()} mt={4}>
          <CardVisual item={previewItem} />
        </Box>
      </Group>

      <Group justify="space-between" align="center" gap={10} mt={26}>
        {isEditing && (
          <UnstyledButton
            onClick={onDelete}
            style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: DANGER, padding: '8px 0' }}
          >
            {deleteLabel}
          </UnstyledButton>
        )}
        <Group gap={10} ml="auto">
          <Button variant="secondary" onClick={onClose} radius={10}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave} radius={10}>
            {saveLabel}
          </Button>
        </Group>
      </Group>
    </ModalShell>
  )
}
