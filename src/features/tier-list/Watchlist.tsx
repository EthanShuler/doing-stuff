import { useState } from 'react'
import { ActionIcon, Box, Checkbox, Group, Paper, Text } from '@mantine/core'
import type { TierKind, WatchlistItem } from '../../types'
import { ACCENT, colors, fonts } from '../../theme'

const KIND_NOUN: Record<TierKind, string> = { movie: 'movie', tv: 'show' }

interface WatchlistProps {
  items: WatchlistItem[]
  kind: TierKind
  /** Check off an open item — creates the tier item and drops it on the board. */
  onCheck: (item: WatchlistItem) => void
  /** Reopen a checked item (the tier item it made stays on the board). */
  onUncheck: (id: string) => void
  /** Edit an open item's title/poster (opens the modal). */
  onEdit: (item: WatchlistItem) => void
  onDelete: (id: string) => void
}

/** A small poster thumbnail with the same graceful fallback the board cards use. */
function Thumb({ item }: { item: WatchlistItem }) {
  const [broken, setBroken] = useState(false)
  const emoji = item.kind === 'tv' ? '📺' : '🎬'
  if (!item.imageUrl || broken) {
    return (
      <Box
        w={38}
        h={54}
        bg={colors.chip}
        style={{
          flexShrink: 0,
          borderRadius: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}
      >
        {emoji}
      </Box>
    )
  }
  return (
    <img
      key={item.imageUrl}
      src={item.imageUrl}
      alt={item.title}
      onError={() => setBroken(true)}
      style={{ width: 38, height: 54, objectFit: 'cover', borderRadius: 5, flexShrink: 0, display: 'block' }}
    />
  )
}

/** The shared "want to watch" list for one kind. Checking an item off promotes
 *  it into the tier pool (the page owns that action + the add/edit modal). */
export function Watchlist({ items, kind, onCheck, onUncheck, onEdit, onDelete }: WatchlistProps) {
  const noun = KIND_NOUN[kind]

  if (items.length === 0) {
    return (
      <Box
        mt={24}
        ta="center"
        bg="#fff"
        p="56px 24px"
        style={{ border: '1px dashed rgba(120,100,80,0.28)', borderRadius: 16 }}
      >
        <Text fz={22} mb={6} style={{ fontFamily: fonts.serif }}>
          Nothing to watch yet
        </Text>
        <Text fz={14} c={colors.muted}>
          Add a {noun} you both want to see. Check it off and it lands on your tier board, ready to rank.
        </Text>
      </Box>
    )
  }

  return (
    <Box mt={24} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => {
        const done = item.tierItemId !== null
        return (
          <Paper
            key={item.id}
            bg="#fff"
            withBorder
            p="12px 16px"
            style={{ borderColor: colors.cardBorder, borderRadius: 12 }}
          >
            <Group gap={14} align="center" wrap="nowrap">
              <Checkbox
                checked={done}
                onChange={() => (done ? onUncheck(item.id) : onCheck(item))}
                radius="xl"
                size="md"
                color={ACCENT}
                aria-label={done ? 'Move back to watchlist' : 'Mark watched — add to board'}
                styles={{ input: { cursor: 'pointer' } }}
              />
              <Thumb item={item} />
              <Box flex={1} miw={0}>
                <Text
                  onClick={done ? undefined : () => onEdit(item)}
                  fz={17}
                  c={done ? colors.faint : colors.ink}
                  lineClamp={2}
                  style={{
                    fontFamily: fonts.serif,
                    cursor: done ? 'default' : 'text',
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  {item.title}
                </Text>
                {done && (
                  <Text fz={12} c={colors.muted} mt={2} style={{ fontFamily: fonts.sans }}>
                    On your tier board — go rank it.
                  </Text>
                )}
              </Box>
              <ActionIcon
                variant="subtle"
                onClick={() => onDelete(item.id)}
                c={colors.faint}
                aria-label="Remove from watchlist"
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
              </ActionIcon>
            </Group>
          </Paper>
        )
      })}
    </Box>
  )
}
