import { Group, Select, SimpleGrid, Text, TextInput } from '@mantine/core'
import type { Season } from '../../types'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import type { SeasonDraft } from './derive'

/** The season modal's draft: the season's own fields plus, on create, the
 *  season to copy items from ('' = start empty). */
export interface SeasonModalDraft extends SeasonDraft {
  copyFrom: string
}

export const emptySeasonDraft = (): SeasonModalDraft => ({ name: '', emoji: '', startsOn: '', endsOn: '', copyFrom: '' })

export const draftFromSeason = (s: Season): SeasonModalDraft => ({
  name: s.name,
  emoji: s.emoji,
  startsOn: s.startsOn,
  endsOn: s.endsOn,
  copyFrom: '',
})

const START_EMPTY = '__empty__'

/** Create or edit a season. Presentational: the page owns the draft, the
 *  save, and the delete confirm. */
export function SeasonModal({
  opened,
  draft,
  isEditing,
  seasons,
  onChange,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  draft: SeasonModalDraft
  isEditing: boolean
  /** Seasons that can be copied from (create only). */
  seasons: Season[]
  onChange: (patch: Partial<SeasonModalDraft>) => void
  saving: boolean
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const datesOk = Boolean(draft.startsOn && draft.endsOn && draft.endsOn >= draft.startsOn)
  const canSave = Boolean(draft.name.trim()) && datesOk

  return (
    <ModalShell opened={opened} onClose={onClose} title={isEditing ? 'Edit season' : 'New season'} size="sm">
      <Group gap={12} align="flex-start" wrap="nowrap" mb={16}>
        <TextInput
          label="Name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.currentTarget.value })}
          placeholder="e.g. Winter 2026"
          data-autofocus
          flex={1}
        />
        <TextInput
          label="Emoji"
          value={draft.emoji}
          onChange={(e) => onChange({ emoji: e.currentTarget.value })}
          placeholder="🍂"
          w={92}
        />
      </Group>
      <SimpleGrid cols={2} spacing={12} mb={16}>
        <TextInput
          label="Starts"
          type="date"
          value={draft.startsOn}
          onChange={(e) => onChange({ startsOn: e.currentTarget.value })}
        />
        <TextInput
          label="Ends"
          type="date"
          value={draft.endsOn}
          onChange={(e) => onChange({ endsOn: e.currentTarget.value })}
          error={draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn ? 'Ends before it starts' : undefined}
        />
      </SimpleGrid>
      {!isEditing && seasons.length > 0 && (
        <Select
          label="Copy items from"
          value={draft.copyFrom || START_EMPTY}
          onChange={(value) => onChange({ copyFrom: !value || value === START_EMPTY ? '' : value })}
          data={[
            { value: START_EMPTY, label: 'Nothing — start empty' },
            ...seasons.map((s) => ({ value: s.id, label: `${s.emoji} ${s.name}` })),
          ]}
          allowDeselect={false}
          mb={10}
        />
      )}
      <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.sans }}>
        {isEditing
          ? 'The planner lists the weekends between these dates.'
          : 'Copying brings the sections and items along — plans, deadlines, fixed dates and check-offs start fresh.'}
      </Text>

      <ModalFooter
        onCancel={onClose}
        onConfirm={onSave}
        confirmLabel={isEditing ? 'Save changes' : 'Create season'}
        confirmDisabled={!canSave}
        loading={saving}
        onDelete={isEditing ? onDelete : undefined}
        deleteLabel="Delete season"
      />
    </ModalShell>
  )
}
