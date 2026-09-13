import { Group, Text, TextInput } from '@mantine/core'
import type { ListDef } from '../../types'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'

/** The draft backing the new/edit free-form list modal. A list configures its
 *  NAME only — everything else about it is fixed (shared rows, no image, no
 *  title lookup, check off = a date stamp). */
export interface ListDefDraft {
  /** Display name: "Groceries". */
  name: string
  /** Optional single emoji for the picker pill. */
  emoji: string
}

export const emptyListDefDraft = (): ListDefDraft => ({ name: '', emoji: '' })

export const draftFromListDef = (def: ListDef): ListDefDraft => ({ name: def.name, emoji: def.emoji })

/** Create or rename a free-form list. Presentational: the page owns the
 *  draft, the save, and the delete confirm. */
export function ListDefModal({
  opened,
  draft,
  isEditing,
  onChange,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  draft: ListDefDraft
  isEditing: boolean
  onChange: (patch: Partial<ListDefDraft>) => void
  saving: boolean
  onSave: () => void
  /** Edit only — the page confirms before it deletes. */
  onDelete: () => void
  onClose: () => void
}) {
  const canSave = Boolean(draft.name.trim())

  return (
    <ModalShell opened={opened} onClose={onClose} title={isEditing ? 'Edit list' : 'New list'} size="sm">
      <Group gap={12} align="flex-start" wrap="nowrap" mb={12}>
        <TextInput
          label="Name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.currentTarget.value })}
          placeholder="e.g. Groceries"
          data-autofocus
          flex={1}
        />
        <TextInput
          label="Emoji"
          value={draft.emoji}
          onChange={(e) => onChange({ emoji: e.currentTarget.value })}
          placeholder="🛒"
          w={92}
        />
      </Group>
      <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.sans }}>
        A shared list you both add to. Check a row off and it drops into Done — nothing lands on a tier board.
      </Text>

      <ModalFooter
        onCancel={onClose}
        onConfirm={onSave}
        confirmLabel={isEditing ? 'Save changes' : 'Create list'}
        confirmDisabled={!canSave}
        loading={saving}
        onDelete={isEditing ? onDelete : undefined}
        deleteLabel="Delete list"
      />
    </ModalShell>
  )
}
