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
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  kind: TierKind
  draft: ItemDraft
  isEditing: boolean
  onChange: (patch: Partial<ItemDraft>) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const noun = KIND_NOUN[kind]
  const canSave = Boolean(draft.title.trim())

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
        {isEditing ? `Edit ${noun}` : `Add a ${noun}`}
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
            New {noun}s land on both of your unranked shelves.
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
            Delete {noun}
          </UnstyledButton>
        )}
        <Group gap={10} ml="auto">
          <Button variant="default" onClick={onClose} radius={10} styles={secondaryButtonStyles}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave} radius={10}>
            {isEditing ? 'Save changes' : `Add ${noun}`}
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
