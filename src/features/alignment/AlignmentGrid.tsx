import { useState } from 'react'
import { Box, SimpleGrid, Text, Textarea, UnstyledButton } from '@mantine/core'
import type { AlignmentChart, AlignmentKey } from '../../types'
import { colors, fonts, radii, shadows, text } from '../../theme'
import { ALIGNMENT_KEYS, alignmentLabel } from './derive'

/** The 3×3 chart. Each square edits in place: tap it, type, and Enter (or
 *  clicking away) saves just that square; Escape backs out. Shift+Enter adds
 *  a line break. */
export function AlignmentGrid({
  chart,
  onSetCell,
}: {
  chart: AlignmentChart
  onSetCell: (key: AlignmentKey, text: string) => void
}) {
  return (
    <SimpleGrid cols={3} spacing={{ base: 6, sm: 10 }} maw={900} mx="auto" mt={14}>
      {ALIGNMENT_KEYS.map((key) => (
        // Keyed by chart too, so switching charts drops a half-typed edit.
        <Square key={`${chart.id}:${key}`} label={alignmentLabel(key)} value={chart.cells[key]} onSave={(t) => onSetCell(key, t)} />
      ))}
    </SimpleGrid>
  )
}

function Square({ label, value, onSave }: { label: string; value: string; onSave: (text: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null

  const commit = () => {
    if (draft !== null && draft.trim() !== value) onSave(draft)
    setDraft(null)
  }

  return (
    <Box
      mih={{ base: 116, sm: 170 }}
      bg={colors.surface}
      p={{ base: 8, sm: 14 }}
      style={{
        border: `1px solid ${editing ? colors.dotted : colors.cardBorder}`,
        borderRadius: radii.card,
        boxShadow: shadows.card,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <Text
        fz={{ base: text.micro, sm: text.tiny }}
        fw={700}
        c={colors.muted}
        ta="center"
        style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: fonts.sans }}
      >
        {label}
      </Text>
      {editing ? (
        <Textarea
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setDraft(null)
            }
          }}
          autoFocus
          autosize
          minRows={2}
          mt={8}
          styles={{ input: { textAlign: 'center', fontFamily: fonts.serif, fontSize: 16 } }}
        />
      ) : (
        <UnstyledButton
          aria-label={`Edit ${label}`}
          onClick={() => setDraft(value)}
          mt={6}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            borderRadius: radii.chip,
          }}
        >
          {value ? (
            <Text
              fz={{ base: 15, sm: 20 }}
              lh={1.25}
              c={colors.ink}
              style={{ fontFamily: fonts.serif, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
            >
              {value}
            </Text>
          ) : (
            <Text fz={text.caption} c={colors.faint} style={{ fontStyle: 'italic' }}>
              Tap to fill in
            </Text>
          )}
        </UnstyledButton>
      )}
    </Box>
  )
}
