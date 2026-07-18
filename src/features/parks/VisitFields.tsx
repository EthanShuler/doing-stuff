import { Box, Checkbox, Group, Text, Textarea, TextInput } from '@mantine/core'
import { colors, fieldLabelStyle } from '../../theme'
import type { Member } from './derive'
import type { VisitDraft } from './useParkStore'

/** The trip fields shared by the park detail modal's add/edit form and the
 *  header's Log visit modal: optional date, who went (≥1 required), notes. */
export function VisitFields({
  draft,
  members,
  onChange,
}: {
  draft: VisitDraft
  members: Member[]
  onChange: (patch: Partial<VisitDraft>) => void
}) {
  const toggleAttendee = (id: string, checked: boolean) =>
    onChange({
      attendeeIds: checked
        ? [...draft.attendeeIds, id]
        : draft.attendeeIds.filter((a) => a !== id),
    })

  return (
    <>
      <TextInput
        label="When"
        type="date"
        value={draft.date}
        onChange={(e) => onChange({ date: e.currentTarget.value })}
        mb={4}
      />
      <Text fz={12} c={colors.faint} mb={16}>
        Leave blank for “sometime, long ago.”
      </Text>

      <Box mb={18}>
        <Text component="span" style={fieldLabelStyle}>
          Who went
        </Text>
        <Group gap={18} mt={2}>
          {members.map((member) => (
            <Checkbox
              key={member.id}
              checked={draft.attendeeIds.includes(member.id)}
              onChange={(e) => toggleAttendee(member.id, e.currentTarget.checked)}
              label={
                <Group gap={7} wrap="nowrap" component="span" display="inline-flex">
                  <Box w={9} h={9} component="span" style={{ borderRadius: '50%', background: member.color }} />
                  <span>{member.name || 'Member'}</span>
                </Group>
              }
            />
          ))}
        </Group>
        {draft.attendeeIds.length === 0 && (
          <Text fz={12} c={colors.muted} mt={6}>
            Somebody must have gone — check at least one name.
          </Text>
        )}
        {draft.attendeeIds.length > 1 && (
          <>
            <Checkbox
              mt={12}
              checked={draft.separate}
              onChange={(e) => onChange({ separate: e.currentTarget.checked })}
              label="We went separately (different trips)"
            />
            {draft.separate && (
              <Text fz={12} c={colors.faint} mt={6}>
                Counts for each of you, but not as a park you did together.
              </Text>
            )}
          </>
        )}
      </Box>

      <Textarea
        label="Notes"
        value={draft.notes}
        onChange={(e) => onChange({ notes: e.currentTarget.value })}
        placeholder="e.g. camped at the north rim (optional)"
        autosize
        minRows={2}
        mb={6}
      />
    </>
  )
}
