import { useEffect, useState } from 'react'
import { Box, Button, Group, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import type { Repeat } from '../../types'
import { colors, DANGER, fieldLabelStyle, fonts, warmBorder } from '../../theme'
import { formatDate, today } from '../../lib/format'
import { useBusy } from '../../lib/useBusy'
import { ModalShell } from '../../components/ModalShell'

interface RepeatModalProps {
  opened: boolean
  /** Title of the entry being repeated (for the header). */
  entryTitle: string
  /** The original (first) entry date. */
  firstDate: string
  /** This entry's repeats, oldest first. */
  repeats: Repeat[]
  /** Rejects on a failed write (the store throws for repeat actions). */
  onAdd: (date: string) => Promise<void>
  onRemove: (repeatId: string) => void
  onClose: () => void
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

  // The modal stays mounted between opens, so refresh the default date each
  // time it opens (a tab left overnight would otherwise offer yesterday).
  useEffect(() => {
    if (opened) setDate(today())
  }, [opened])

  const { busy, run } = useBusy()
  const add = () =>
    run(async () => {
      try {
        await onAdd(date || today())
        setDate(today())
      } catch {
        // Write failed — keep the picked date; store.error shows the reason.
      }
    })

  // First entry + repeats, newest first, for the history list.
  const history = [
    { id: '__first__', date: firstDate, first: true },
    ...repeats.map((r) => ({ id: r.id, date: r.date, first: false })),
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
        <Button onClick={() => void add()} radius={10} disabled={!date} loading={busy}>
          Add repeat
        </Button>
      </Group>

      <Text style={fieldLabelStyle}>
        History · {history.length} total
      </Text>
      <Box>
        {history.map((item) => (
          <Group
            key={item.id}
            justify="space-between"
            align="center"
            py={9}
            style={{ borderTop: `1px dotted ${warmBorder(0.22)}` }}
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
        <Button variant="secondary" onClick={onClose} radius={10}>
          Done
        </Button>
      </Group>
    </ModalShell>
  )
}
