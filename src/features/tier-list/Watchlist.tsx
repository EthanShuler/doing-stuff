import { ActionIcon, Box, Checkbox, Group, Paper, Text } from '@mantine/core'
import type { TierKind, WatchlistItem } from '../../types'
import { ACCENT, colors, fonts } from '../../theme'
import { formatDate } from '../../lib/format'
import { EmptyCard } from '../../components/EmptyCard'
import { KIND_COPY } from './copy'
import { MediaImage } from './TierCard'

interface WatchlistProps {
  items: WatchlistItem[]
  kind: TierKind
  /** Date per TIER item id — a checked wish looks its own up via `tierItemId`
   *  (the wish row has no date). For movies/TV that's the shared watched date;
   *  for books the page passes the VIEWER's own read dates, so a book the
   *  partner checked off shows dateless here until you read it too. */
  watchedDates: ReadonlyMap<string, string | null>
  /** Check off an open item — creates the tier item and drops it on the board. */
  onCheck: (item: WatchlistItem) => void
  /** Reopen a checked item (the tier item it made stays on the board). */
  onUncheck: (id: string) => void
  /** Edit an open item's title/poster (opens the modal). */
  onEdit: (item: WatchlistItem) => void
  onDelete: (id: string) => void
}

/** The "want to watch/read/try" list for one kind — shared, except books,
 *  where each member keeps their own reading list (the page passes only the
 *  viewer's rows). Checking an item off promotes it into the tier pool (the
 *  page owns that action + the add/edit modal). */
export function Watchlist({ items, kind, watchedDates, onCheck, onUncheck, onEdit, onDelete }: WatchlistProps) {
  const copy = KIND_COPY[kind]

  if (items.length === 0) {
    return <EmptyCard mt={24} title={copy.listEmptyTitle} blurb={copy.listEmptyBlurb} />
  }

  return (
    <Box mt={24} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => {
        const done = item.tierItemId !== null
        const watchedOn = item.tierItemId ? watchedDates.get(item.tierItemId) : null
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
                aria-label={done ? `Move back to ${copy.listLabel.toLowerCase()}` : `Mark ${copy.past} — add to board`}
                styles={{ input: { cursor: 'pointer' } }}
              />
              <MediaImage
                imageUrl={item.imageUrl}
                title={item.title}
                emoji={copy.emoji}
                width={38}
                height={54}
                radius={5}
                emojiSize={18}
              />
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
                    {copy.usesDates && watchedOn
                      ? `${copy.pastCap} ${formatDate(watchedOn)} — on your tier board, go rank it.`
                      : copy.onBoardNote}
                  </Text>
                )}
              </Box>
              <ActionIcon
                variant="subtle"
                onClick={() => onDelete(item.id)}
                c={colors.faint}
                aria-label={`Remove from ${copy.listLabel.toLowerCase()}`}
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
