import { useState } from 'react'
import { Box, Button, Group, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import type { Repeat } from '../../types'
import { colors, DANGER, fonts } from '../../theme'
import { formatDate, today } from '../../lib/format'
import { ModalShell } from '../../components/ModalShell'

interface RepeatModalProps {
  opened: boolean
  /** Title of the entry being repeated (for the header). */
  entryTitle: string
  /** The original (first) entry date. */
  firstDate: string
  /** This entry's repeats, oldest first. */
  repeats: Repeat[]
  onAdd: (date: string) => void
  onRemove: (repeatId: string) => void
  onClose: () => void
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: colors.muted,
  marginBottom: 7,
}

export function RepeatModal({
  opened,
  entryTitle,
  firstDate,
  repeats,
  onAdd,
  onRemove,
  onClose,
}: RepeatModalProps) {
  const [date, setDate] = useState(today())

  const add = () => {
    onAdd(date || today())
    setDate(today())
  }

  // First entry + repeats, newest first, for the history list.
  const history = [
    { id: '__first__', date: firstDate, first: true },
    ...[...repeats].sort((a, b) => b.date.localeCompare(a.date)).map((r) => ({ id: r.id, date: r.date, first: false })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <ModalShell opened={opened} onClose={onClose}>
      <Title order={3} fz={28} mb={4}>
        Add repeat
      </Title>
      <Text c={colors.muted} fz={14} mb={22} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
        {entryTitle}
      </Text>

      <Group gap={10} mb={24} align="flex-end">
        <TextInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button onClick={add} radius={10} disabled={!date}>
          Add repeat
        </Button>
      </Group>

      <Text style={labelStyle}>
        History · {history.length} total
      </Text>
      <Box>
        {history.map((item) => (
          <Group
            key={item.id}
            justify="space-between"
            align="center"
            py={9}
            style={{ borderTop: '1px dotted rgba(120,100,80,0.22)' }}
          >
            <Group gap={9} align="center">
              <Text fz={14} style={{ fontFamily: fonts.serif }}>
                {formatDate(item.date)}
              </Text>
              {item.first && (
                <Text c={colors.faint} style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em' }}>
                  FIRST ENTRY
                </Text>
              )}
            </Group>
            {!item.first && (
              <UnstyledButton
                onClick={() => onRemove(item.id)}
                aria-label={`Remove repeat on ${formatDate(item.date)}`}
                style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, color: DANGER }}
              >
                Remove
              </UnstyledButton>
            )}
          </Group>
        ))}
      </Box>

      <Group justify="flex-end" mt={24}>
        <Button variant="default" onClick={onClose} radius={10} styles={secondaryButtonStyles}>
          Done
        </Button>
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
