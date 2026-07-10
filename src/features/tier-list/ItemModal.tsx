import { useEffect, useState } from 'react'
import { Box, Button, Group, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import type { TierItem, TierKind } from '../../types'
import { colors, DANGER, fonts } from '../../theme'
import { ModalShell } from '../../components/ModalShell'
import { isTmdbConfigured, searchTmdb } from '../../lib/tmdb'
import type { TmdbResult } from '../../lib/tmdb'
import { CardVisual } from './TierCard'

/** The draft backing the add/edit item modal. */
export interface ItemDraft {
  title: string
  imageUrl: string
  /** ISO date we finished watching it; '' = not watched yet (the item sits on
   *  the unwatched shelf until it's dated or dragged into a tier). Board items
   *  only — watchlist items aren't watched yet, so the field is hidden there. */
  watchedOn: string
}

const KIND_NOUN: Record<TierKind, string> = { movie: 'movie', tv: 'show' }

export function ItemModal({
  opened,
  kind,
  draft,
  isEditing,
  variant = 'board',
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
  onChange: (patch: Partial<ItemDraft>) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const noun = KIND_NOUN[kind]
  const canSave = Boolean(draft.title.trim())
  const isWatchlist = variant === 'watchlist'

  // TMDB title suggestions. Only shown after the user actually types (so an
  // edit modal opening with a full title doesn't pop the dropdown), and hidden
  // again on blur or pick. Lookup is a convenience — hand-typed titles and
  // pasted URLs work exactly as before, and without a key none of this runs.
  const [suggestions, setSuggestions] = useState<TmdbResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (opened) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [opened])

  useEffect(() => {
    if (!opened || !showSuggestions || !isTmdbConfigured) return
    const query = draft.title.trim()
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    // Debounce, and drop responses that land after the query changed again.
    let cancelled = false
    const timer = setTimeout(async () => {
      const results = await searchTmdb(kind, query)
      if (!cancelled) setSuggestions(results)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [draft.title, kind, opened, showSuggestions])

  const pickSuggestion = (result: TmdbResult) => {
    onChange({ title: result.title, imageUrl: result.posterUrl })
    setSuggestions([])
    setShowSuggestions(false)
  }

  const heading = isWatchlist
    ? isEditing
      ? 'Edit watchlist item'
      : `Add a ${noun} to watch`
    : isEditing
      ? `Edit ${noun}`
      : `Add a ${noun}`
  const hint = isWatchlist
    ? `Check it off later and it joins both of your unranked shelves.`
    : `New ${noun}s land on both of your unranked shelves — or unwatched, with no watched date.`
  const saveLabel = isEditing ? 'Save changes' : isWatchlist ? 'Add to watchlist' : `Add ${noun}`
  const deleteLabel = isWatchlist ? 'Remove from watchlist' : `Delete ${noun}`

  // Live preview of the card exactly as it will render on the board.
  const previewItem: TierItem = {
    id: 'preview',
    kind,
    title: draft.title.trim() || 'Title…',
    imageUrl: draft.imageUrl.trim(),
    watchedOn: null,
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
              placeholder={kind === 'tv' ? 'e.g. Severance' : 'e.g. Paddington 2'}
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
                    key={result.id}
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
                        {kind === 'tv' ? '📺' : '🎬'}
                      </Box>
                    )}
                    <Box>
                      <Text fz={13} fw={600} c={colors.ink} lh={1.3}>
                        {result.title}
                      </Text>
                      {result.year && (
                        <Text fz={11.5} c={colors.faint}>
                          {result.year}
                        </Text>
                      )}
                    </Box>
                  </UnstyledButton>
                ))}
              </Box>
            )}
          </Box>
          <TextInput
            label="Poster image URL"
            value={draft.imageUrl}
            onChange={(e) => onChange({ imageUrl: e.currentTarget.value })}
            placeholder="Paste an image link (optional)"
            mb={isWatchlist ? 6 : 18}
          />
          {!isWatchlist && (
            <TextInput
              label="Watched on"
              type="date"
              value={draft.watchedOn}
              onChange={(e) => onChange({ watchedOn: e.currentTarget.value })}
              mb={6}
            />
          )}
          <Text fz={12} c={colors.faint} style={{ fontFamily: fonts.sans }}>
            {hint}
            {isTmdbConfigured && ' Title search by TMDB (not endorsed or certified by TMDB).'}
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
          <Button variant="default" onClick={onClose} radius={10} styles={secondaryButtonStyles}>
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

const secondaryButtonStyles = {
  root: {
    background: 'transparent',
    border: '1px solid rgba(120,100,80,0.3)',
    color: '#5c574e',
  },
}
