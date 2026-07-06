import { Box, Button, Group, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import type { TierItem, TierKind } from '../../types'
import { colors, DANGER, fonts } from '../../theme'
import { ModalShell } from '../../components/ModalShell'
import { CardVisual } from './TierCard'

/** The draft backing the add/edit item modal. */
export interface ItemDraft {
  title: string
  imageUrl: string
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

  const heading = isWatchlist
    ? isEditing
      ? 'Edit watchlist item'
      : `Add a ${noun} to watch`
    : isEditing
      ? `Edit ${noun}`
      : `Add a ${noun}`
  const hint = isWatchlist
    ? `Check it off later and it joins both of your unranked shelves.`
    : `New ${noun}s land on both of your unranked shelves.`
  const saveLabel = isEditing ? 'Save changes' : isWatchlist ? 'Add to watchlist' : `Add ${noun}`
  const deleteLabel = isWatchlist ? 'Remove from watchlist' : `Delete ${noun}`

  // Live preview of the card exactly as it will render on the board.
  const previewItem: TierItem = {
    id: 'preview',
    kind,
    title: draft.title.trim() || 'Title…',
    imageUrl: draft.imageUrl.trim(),
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
          <TextInput
            label="Title"
            value={draft.title}
            onChange={(e) => onChange({ title: e.currentTarget.value })}
            placeholder={kind === 'tv' ? 'e.g. Severance' : 'e.g. Paddington 2'}
            data-autofocus
            mb={18}
          />
          <TextInput
            label="Poster image URL"
            value={draft.imageUrl}
            onChange={(e) => onChange({ imageUrl: e.currentTarget.value })}
            placeholder="Paste an image link (optional)"
            mb={6}
          />
          <Text fz={12} c={colors.faint} style={{ fontFamily: fonts.sans }}>
            {hint}
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
