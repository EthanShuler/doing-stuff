import { Checkbox, Group, Text, TextInput } from '@mantine/core'
import type { TierList } from '../../types'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'

/** The draft backing the new/edit list modal. A list configures WORDS only —
 *  its behavior is fixed to the ice-cream template (shared pool, S–F tiers, a
 *  "Not <past>" shelf, no dates). */
export interface ListDraft {
  /** Display name: "Fruits". */
  name: string
  /** Optional single emoji for the picker pill and imageless cards. */
  emoji: string
  /** Singular noun, lowercase: "fruit" → "Add a fruit". */
  noun: string
  /** Past participle: "tried" → the "Not tried" shelf. */
  past: string
  /** One board you both rank together, instead of a board each. */
  shared: boolean
}

export const emptyListDraft = (): ListDraft => ({ name: '', emoji: '', noun: '', past: '', shared: false })

export const draftFromList = (list: TierList): ListDraft => ({
  name: list.name,
  emoji: list.emoji,
  noun: list.noun,
  past: list.past,
  shared: list.shared,
})

/**
 * Create or re-word a space-defined tier list. Presentational: the page owns
 * the draft, the save, and the delete confirm.
 *
 * The past participle is the whole trick — "tried" gives an ice-cream shaped
 * list, "eaten" or "visited" reads just as naturally — so the modal previews
 * the sentence it produces rather than explaining it.
 */
export function ListModal({
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
  draft: ListDraft
  isEditing: boolean
  onChange: (patch: Partial<ListDraft>) => void
  saving: boolean
  onSave: () => void
  /** Edit only — the page confirms before it deletes. */
  onDelete: () => void
  onClose: () => void
}) {
  const canSave = Boolean(draft.name.trim() && draft.noun.trim())
  // The preview shows what the words will actually produce, with the same
  // fallbacks the store applies on save.
  const noun = draft.noun.trim().toLowerCase() || 'thing'
  const past = draft.past.trim() || 'tried'

  return (
    <ModalShell opened={opened} onClose={onClose} title={isEditing ? 'Edit list' : 'New list'} size="sm">
      <Group gap={12} align="flex-start" wrap="nowrap" mb={18}>
        <TextInput
          label="Name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.currentTarget.value })}
          placeholder="e.g. Fruits"
          data-autofocus
          flex={1}
        />
        <TextInput
          label="Emoji"
          value={draft.emoji}
          onChange={(e) => onChange({ emoji: e.currentTarget.value })}
          placeholder="🍎"
          w={92}
        />
      </Group>
      <TextInput
        label="Singular noun"
        value={draft.noun}
        onChange={(e) => onChange({ noun: e.currentTarget.value })}
        placeholder="e.g. fruit"
        mb={18}
      />
      <TextInput
        label="Past participle"
        value={draft.past}
        onChange={(e) => onChange({ past: e.currentTarget.value })}
        placeholder="tried"
        mb={10}
      />
      <Text fz={text.caption} c={colors.faint} mb={14} style={{ fontFamily: fonts.sans }}>
        'tried', 'eaten', 'visited'.
      </Text>
      <Text fz={text.caption} c={colors.muted} mb={18} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
        Add a {noun} · "Not {past}" shelf{draft.shared ? ' · one shared board' : ''}
      </Text>

      {/* Shared = ONE board the space ranks together (no You/Partner toggle).
          Flipping it later doesn't move any rankings: the other mode's rows
          stay put in the DB and come back if you flip it again. */}
      <Checkbox
        label="Shared board"
        description={
          isEditing
            ? 'One set of tiers you both edit, instead of a board each. Rankings from the other mode are kept if you switch back.'
            : 'One set of tiers you both edit, instead of a board each.'
        }
        checked={draft.shared}
        onChange={(e) => onChange({ shared: e.currentTarget.checked })}
      />

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
