import { Box, Group, TagsInput, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import type { ListKey, TierItem } from '../../types'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import { TitleSearchInput, canSearch } from '../../components/TitleSearchInput'
import type { SearchKind } from '../../components/TitleSearchInput'
import type { KindCopy } from './copy'
import { CardVisual } from './TierCard'

/** The draft backing the add/edit item modal. */
export interface ItemDraft {
  title: string
  imageUrl: string
  /** ISO date it was finished; '' = not yet (the item sits on the unwatched/
   *  unread shelf until it's dated or dragged into a tier). For movies/TV this
   *  is the item's shared done date; for books it's the EDITOR's own one;
   *  dateless kinds (ice cream) show no field and just pass the existing
   *  tried marker through unchanged. Board items only — list items aren't
   *  started yet, so the field is hidden. */
  doneOn: string
  /** Shared filter labels ("disney", "fantasy"). Board items only. */
  tags: string[]
  /** Who made it — author/director/etc. (label per kind in copy.ts). Both
   *  variants: a watchlist row carries it onto the tier item on check-off. */
  creator: string
}

export function ItemModal({
  opened,
  kind,
  copy,
  draft,
  isEditing,
  variant = 'board',
  tagSuggestions = [],
  onChange,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  /** The board this item belongs to. Only used to pick a search provider —
   *  a custom list matches none, so it gets hand entry (the same as ice
   *  cream). All wording comes from `copy`. */
  kind: ListKey
  /** The board's wording (KIND_COPY for a built-in, customCopy for a list). */
  copy: KindCopy
  draft: ItemDraft
  isEditing: boolean
  /** 'board' adds straight to the tier pool; 'watchlist' adds a "want to watch"
   *  item that only reaches the board once it's checked off. Just tweaks copy. */
  variant?: 'board' | 'watchlist'
  /** Tags already used on this kind's items, offered as autocomplete options
   *  so spellings converge instead of forking ("Disney" vs "disney"). */
  tagSuggestions?: string[]
  onChange: (patch: Partial<ItemDraft>) => void
  saving: boolean
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const noun = copy.noun
  const canSave = Boolean(draft.title.trim())
  const isWatchlist = variant === 'watchlist'

  // Title suggestions — TMDB for movies/TV (needs a key), Open Library for
  // books (keyless, so always on). No provider covers ice cream or a
  // space-defined list — hand entry only (see TitleSearchInput).
  const searchKind: SearchKind = kind === 'movie' || kind === 'tv' || kind === 'book' ? kind : null

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

  // Live preview of the card exactly as it will render on the board. The
  // image URL is debounced so typing or pasting a link fires one request when
  // you stop, not one per keystroke.
  const [previewUrl] = useDebouncedValue(draft.imageUrl.trim(), 400)
  const previewItem: TierItem = {
    id: 'preview',
    kind,
    title: draft.title.trim() || 'Title…',
    imageUrl: previewUrl,
    doneOn: null,
    tags: [],
    creator: draft.creator.trim(),
    createdBy: null,
    createdAt: '',
  }

  return (
    <ModalShell opened={opened} onClose={onClose} title={heading}>
      <Group gap={20} align="flex-start" wrap="nowrap">
        <Box flex={1}>
          <Box mb={18}>
            <TitleSearchInput
              searchKind={searchKind}
              value={draft.title}
              onChange={(title) => onChange({ title })}
              // Only overwrite the creator when the provider knows one, so a
              // TMDB pick doesn't blank a hand-typed director.
              onPick={(result) =>
                onChange({
                  title: result.title,
                  imageUrl: result.imageUrl,
                  ...(result.creator ? { creator: result.creator } : {}),
                })
              }
              label="Title"
              // A custom list has no example title to suggest.
              placeholder={copy.example ? `e.g. ${copy.example}` : `Name of the ${noun}`}
              autoFocus
              emoji={copy.emoji}
            />
          </Box>
          <TextInput
            label={copy.imageLabel}
            value={draft.imageUrl}
            onChange={(e) => onChange({ imageUrl: e.currentTarget.value })}
            placeholder="Paste an image link (optional)"
            mb={18}
          />
          <TextInput
            label={copy.creatorLabel}
            value={draft.creator}
            onChange={(e) => onChange({ creator: e.currentTarget.value })}
            placeholder="Optional"
            mb={isWatchlist ? 6 : 18}
          />
          {!isWatchlist && (
            <>
              {/* Dateless kinds (ice cream) get no field here: tried/not-tried
                  is managed by dragging on/off the shelf, and the draft passes
                  the existing marker through untouched. */}
              {copy.usesDates && (
                <TextInput
                  label={copy.dateLabel}
                  type="date"
                  value={draft.doneOn}
                  onChange={(e) => onChange({ doneOn: e.currentTarget.value })}
                  mb={18}
                />
              )}
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
          <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.sans }}>
            {hint}
            {canSearch(searchKind) && ` ${copy.attribution}`}
          </Text>
        </Box>
        {/* No key: MediaImage already remembers "broken" per URL, so a new
            link retries on its own without remounting the whole card. */}
        <Box mt={4}>
          <CardVisual item={previewItem} emoji={copy.emoji} />
        </Box>
      </Group>

      <ModalFooter
        onCancel={onClose}
        onConfirm={onSave}
        confirmLabel={saveLabel}
        confirmDisabled={!canSave}
        loading={saving}
        onDelete={isEditing ? onDelete : undefined}
        deleteLabel={deleteLabel}
      />
    </ModalShell>
  )
}
