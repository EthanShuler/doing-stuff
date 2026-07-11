import {
  Box,
  Button,
  Checkbox,
  Group,
  Rating,
  Select,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import type { Activity, Category, EntryDraft } from '../../types'
import { ACCENT, colors, DANGER, fieldLabelStyle, fonts } from '../../theme'
import { ModalShell } from '../../components/ModalShell'

interface EntryModalProps {
  opened: boolean
  draft: EntryDraft
  isEditing: boolean
  categories: Category[]
  activities: Activity[]
  onChange: (patch: Partial<EntryDraft>) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

export function EntryModal({
  opened,
  draft,
  isEditing,
  categories,
  activities,
  onChange,
  onSave,
  onDelete,
  onClose,
}: EntryModalProps) {
  const activityChoices = activities.filter((a) => a.categoryId === draft.categoryId)
  const hasCategory = Boolean(draft.categoryId)
  const showNoActivityMsg = hasCategory && activityChoices.length === 0
  const activityPlaceholder = !hasCategory
    ? 'Pick a category first'
    : activityChoices.length === 0
      ? 'No activities yet'
      : 'Choose an activity…'

  const canSave = Boolean(draft.activityId) && draft.rating > 0

  return (
    <ModalShell opened={opened} onClose={onClose}>
      <Title order={3} fz={28} mb={22}>
        {isEditing ? 'Edit entry' : 'New entry'}
      </Title>

      <Group gap={12} mb={18} grow align="flex-start">
        <Select
          label="Category"
          placeholder="Choose…"
          value={draft.categoryId || null}
          onChange={(value) => onChange({ categoryId: value ?? '', activityId: '' })}
          data={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          label="Activity"
          placeholder={activityPlaceholder}
          value={draft.activityId || null}
          onChange={(value) => onChange({ activityId: value ?? '' })}
          disabled={!hasCategory}
          data={activityChoices.map((a) => ({ value: a.id, label: a.name }))}
        />
      </Group>

      {showNoActivityMsg && (
        <Text c={colors.muted} fz={13} mt={-8} mb={18} style={{ fontStyle: 'italic', fontFamily: fonts.serif }}>
          No activities in this category yet — add some under <strong>Manage</strong>.
        </Text>
      )}

      <TextInput
        label="Title"
        value={draft.title}
        onChange={(e) => onChange({ title: e.currentTarget.value })}
        placeholder="Give this outing a name…"
        mb={18}
      />

      <TextInput
        label="Date"
        type="date"
        value={draft.date}
        onChange={(e) => onChange({ date: e.currentTarget.value })}
        mb={18}
      />

      <TextInput
        label="Address"
        value={draft.address}
        onChange={(e) => onChange({ address: e.currentTarget.value })}
        placeholder="Where was it? (optional — drops a pin on the map)"
        mb={draft.address.trim() ? 10 : 18}
      />

      {draft.address.trim() && (
        <Checkbox
          label="Hide this entry from the map"
          checked={draft.hideFromMap}
          onChange={(e) => onChange({ hideFromMap: e.currentTarget.checked })}
          mb={18}
          styles={{ label: { fontSize: 13, color: colors.muted } }}
        />
      )}

      <Box mb={18}>
        <Text component="label" style={fieldLabelStyle}>
          How was it?
        </Text>
        <Rating
          value={draft.rating}
          onChange={(value) => onChange({ rating: value })}
          count={5}
          fullSymbol={<span style={{ color: ACCENT, fontSize: 32 }}>★</span>}
          emptySymbol={<span style={{ color: colors.starEmpty, fontSize: 32 }}>★</span>}
        />
      </Box>

      <Textarea
        label="Notes"
        value={draft.description}
        onChange={(e) => onChange({ description: e.currentTarget.value })}
        placeholder="What did you two do? How did it go?"
        autosize
        minRows={3}
        mb={24}
        styles={{ input: { fontFamily: fonts.serif, lineHeight: 1.5 } }}
      />

      <Group justify="space-between" align="center" gap={10}>
        {isEditing && (
          <UnstyledButton
            onClick={onDelete}
            style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: DANGER, padding: '8px 0' }}
          >
            Delete entry
          </UnstyledButton>
        )}
        <Group gap={10} ml="auto">
          <Button variant="secondary" onClick={onClose} radius={10}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave} radius={10}>
            {isEditing ? 'Save changes' : 'Add entry'}
          </Button>
        </Group>
      </Group>
    </ModalShell>
  )
}
