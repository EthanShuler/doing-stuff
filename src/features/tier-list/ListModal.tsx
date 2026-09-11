import { Group, Text, TextInput } from '@mantine/core'
import type { TierList } from '../../types'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'

/** The draft backing the new/edit list modal. A list configures WORDS only —
 *  its behavior is fixed to the ice-cream template (shared pool, S–F tiers, a
 *  "Not <past>" shelf, a shared to-<verb> list, no dates). */
export interface ListDraft {
  /** Display name: "Fruits". */
  name: string
  /** Optional single emoji for the picker pill and imageless cards. */
  emoji: string
  /** Singular noun, lowercase: "fruit" → "Add a fruit". */
  noun: string
  /** Infinitive: "try" → "To-try list". */
  verb: string
  /** Past participle: "tried" → the "Not tried" shelf. */
  past: string
}

export const emptyListDraft = (): ListDraft => ({ name: '', emoji: '', noun: '', verb: '', past: '' })

export const draftFromList = (list: TierList): ListDraft => ({
  name: list.name,
  emoji: list.emoji,
  noun: list.noun,
  verb: list.verb,
  past: list.past,
})

/**
 * Create or re-word a space-defined tier list. Presentational: the page owns
 * the draft, the save, and the delete confirm.
 *
 * The two grammar fields are the whole trick — "try/tried" gives an ice-cream
 * shaped list, "eat/eaten" or "visit/visited" reads just as naturally — so the
 * modal previews the sentences they produce rather than explaining them.
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
  const verb = draft.verb.trim() || 'try'
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
      <Group gap={12} align="flex-start" wrap="nowrap" mb={10}>
        <TextInput
          label="Verb"
          value={draft.verb}
          onChange={(e) => onChange({ verb: e.currentTarget.value })}
          placeholder="try"
          flex={1}
        />
        <TextInput
          label="Past participle"
          value={draft.past}
          onChange={(e) => onChange({ past: e.currentTarget.value })}
          placeholder="tried"
          flex={1}
        />
      </Group>
      <Text fz={text.caption} c={colors.faint} mb={14} style={{ fontFamily: fonts.sans }}>
        'try' / 'tried', 'eat' / 'eaten', 'visit' / 'visited'.
      </Text>
      <Text fz={text.caption} c={colors.muted} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
        Add a {noun} to {verb} · "Not {past}" shelf · To-{verb} list
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
