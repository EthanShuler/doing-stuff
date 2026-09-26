import { Autocomplete, Box, Button, Select, SimpleGrid, Text, TextInput } from '@mantine/core'
import type { SeasonItem } from '../../types'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import type { SeasonItemDraft } from './derive'

/** Select value standing in for "no parent" (Mantine Select wants a string). */
const TOP_LEVEL = '__top__'

/** Add or edit one season item. Presentational: the page owns the draft, the
 *  save, the duplicate, and the delete confirm. */
export function ItemModal({
  opened,
  draft,
  isEditing,
  sections,
  subsections,
  parents,
  parentHint,
  notice,
  onChange,
  saving,
  onSave,
  onDuplicate,
  onDelete,
  onClose,
}: {
  opened: boolean
  draft: SeasonItemDraft
  isEditing: boolean
  /** Existing sections, for the autocomplete. */
  sections: string[]
  /** Existing subsections of the draft's section. */
  subsections: string[]
  /** Top-level items this one may sit under (parentChoices). */
  parents: SeasonItem[]
  /** Why there are no parent choices, when that's not just an empty
   *  subsection (the item has sub-options of its own). */
  parentHint?: string | null
  /** A one-line note over the fields ("This is the copy"). */
  notice?: string | null
  onChange: (patch: Partial<SeasonItemDraft>) => void
  saving: boolean
  onSave: () => void
  /** Edit only. */
  onDuplicate: () => void
  /** Edit only — the page confirms before it deletes. */
  onDelete: () => void
  onClose: () => void
}) {
  const canSave = Boolean(draft.title.trim())
  const parent = parents.find((p) => p.id === draft.parentId) ?? null
  const fixed = Boolean(draft.fixedOn)

  return (
    <ModalShell
      opened={opened}
      onClose={onClose}
      size="md"
      title={
        isEditing ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
            Edit item
            <Button variant="secondary" size="compact-sm" onClick={onDuplicate}>
              Duplicate
            </Button>
          </span>
        ) : (
          'Add item'
        )
      }
    >
      {notice && (
        <Text fz={text.caption} c={colors.muted} mb={14} style={{ fontStyle: 'italic' }}>
          {notice}
        </Text>
      )}
      <TextInput
        label="Title"
        value={draft.title}
        onChange={(e) => onChange({ title: e.currentTarget.value })}
        placeholder="e.g. apple orchard"
        data-autofocus
        mb={16}
      />
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={12} verticalSpacing={16} mb={16}>
        <Autocomplete
          label="Section"
          value={parent ? parent.section : draft.section}
          onChange={(section) => onChange({ section })}
          data={sections}
          placeholder="Unsorted"
          disabled={parent !== null}
        />
        <Autocomplete
          label="Subsection"
          value={parent ? parent.subsection : draft.subsection}
          onChange={(subsection) => onChange({ subsection })}
          data={subsections}
          placeholder="Optional"
          disabled={parent !== null}
        />
      </SimpleGrid>
      <Select
        label="Sub-option of"
        value={draft.parentId ?? TOP_LEVEL}
        onChange={(value) => {
          const id = !value || value === TOP_LEVEL ? null : value
          const p = parents.find((c) => c.id === id)
          // A sub-option lives under its parent's headings.
          onChange(p ? { parentId: id, section: p.section, subsection: p.subsection } : { parentId: null })
        }}
        data={[
          { value: TOP_LEVEL, label: 'Nothing — a top-level item' },
          ...parents.map((p) => ({ value: p.id, label: p.title })),
        ]}
        allowDeselect={false}
        disabled={parents.length === 0 && !draft.parentId}
        description={
          parentHint
            ? parentHint
            : parents.length === 0 && !draft.parentId
            ? 'No top-level items in this subsection yet.'
            : 'A specific option under a general one — “Sweetland” under “apple orchard”.'
        }
        mb={16}
      />
      <TextInput
        label="Note"
        value={draft.note}
        onChange={(e) => onChange({ note: e.currentTarget.value })}
        placeholder="Optional"
        mb={16}
      />
      <TextInput
        label="Link"
        value={draft.url}
        onChange={(e) => onChange({ url: e.currentTarget.value })}
        placeholder="https://… (optional)"
        mb={16}
      />
      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing={12} verticalSpacing={16}>
        <TextInput
          label="Fixed date"
          type="date"
          value={draft.fixedOn ?? ''}
          onChange={(e) => onChange({ fixedOn: e.currentTarget.value || null })}
        />
        <TextInput
          label="Do it by"
          type="date"
          value={draft.byOn ?? ''}
          onChange={(e) => onChange({ byOn: e.currentTarget.value || null })}
        />
        <TextInput
          label="Planned for"
          type="date"
          value={fixed ? '' : (draft.plannedOn ?? '')}
          onChange={(e) => onChange({ plannedOn: e.currentTarget.value || null })}
          disabled={fixed}
        />
      </SimpleGrid>
      <Box mt={8}>
        <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.sans }}>
          {fixed
            ? '📌 A fixed date is an event with a set day — it sits there and can’t be re-planned.'
            : 'Fixed date = an event with a set day. “Do it by” warns you as the weekends run out.'}
        </Text>
      </Box>

      <ModalFooter
        onCancel={onClose}
        onConfirm={onSave}
        confirmLabel={isEditing ? 'Save changes' : 'Add item'}
        confirmDisabled={!canSave}
        loading={saving}
        onDelete={isEditing ? onDelete : undefined}
        deleteLabel="Delete item"
      />
    </ModalShell>
  )
}
