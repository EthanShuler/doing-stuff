import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { Box, Text, UnstyledButton } from '@mantine/core'
import type { TierItem } from '../../types'
import type { Board, ContainerId, ShelfId } from './derive'
import { TIERS, tierSwatch } from './derive'
import { colors, fonts } from '../../theme'

/** Layout for a row's card area — shared by the plain and droppable variants
 *  so the board looks identical with and without drag wiring. */
const ROW_AREA_STYLE: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  alignContent: 'flex-start',
  gap: 8,
  padding: 8,
  minHeight: 116,
}

/** A collapsed shelf keeps the same flex wrap (its heading is the only child)
 *  but no card-height floor, so it folds down to one line. */
const COMPACT_ROW_AREA_STYLE: CSSProperties = { ...ROW_AREA_STYLE, minHeight: 0 }

export const rowAreaStyle = (compact: boolean): CSSProperties =>
  compact ? COMPACT_ROW_AREA_STYLE : ROW_AREA_STYLE

export interface RowAreaProps {
  container: ContainerId
  items: TierItem[]
  /** A collapsed shelf: heading only, no minimum height. */
  compact?: boolean
  children: ReactNode
}

/** Default (read-only) card area: just the flex wrap. The interactive board
 *  substitutes a version that adds useDroppable + SortableContext. */
function PlainRowArea({ compact = false, children }: RowAreaProps) {
  return <div style={rowAreaStyle(compact)}>{children}</div>
}

/** Which shelves are expanded. Both start collapsed — a long unranked shelf
 *  otherwise pushes the tiers off the screen. */
export type ShelfOpenState = Record<ShelfId, boolean>

export const SHELVES_COLLAPSED: ShelfOpenState = { unranked: false, unwatched: false }

/**
 * The board itself: six tier rows + the unranked and unwatched shelves. Purely
 * presentational — TierBoard injects sortable cards and droppable row areas for
 * your own board; the partner view renders it with plain cards and no drag
 * wiring at all.
 */
export function BoardView({
  board,
  renderCard,
  RowArea = PlainRowArea,
  shelfHint,
  unwatchedHint,
  unwatchedLabel = 'Unwatched',
  openShelves,
  onToggleShelf,
}: {
  board: Board
  renderCard: (item: TierItem, container: ContainerId) => ReactNode
  RowArea?: ComponentType<RowAreaProps>
  /** Shown in the unranked shelf when it's empty. */
  shelfHint?: string
  /** Shown in the unwatched shelf when it's empty. */
  unwatchedHint?: string
  /** The second shelf's heading — 'Unread' on the books board. */
  unwatchedLabel?: string
  /** Which shelves are expanded — the page owns this so it survives the
   *  You/Partner and filter switches and resets on a board switch. */
  openShelves: ShelfOpenState
  onToggleShelf: (shelf: ShelfId) => void
}) {
  return (
    <Box mt={20}>
      <Box style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 14, overflow: 'hidden', background: colors.surface }}>
        {TIERS.map((tier, i) => {
          const swatch = tierSwatch(tier)
          const items = board.tiers[tier]
          return (
            <Box
              key={tier}
              data-board-row={tier}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderTop: i === 0 ? undefined : `1px dotted ${colors.dotted}`,
              }}
            >
              <Box
                w={64}
                bg={swatch.tint}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  borderRight: `3px solid ${swatch.color}`,
                }}
              >
                <Text fz={30} fw={700} c={swatch.ink} style={{ fontFamily: fonts.serif }}>
                  {tier}
                </Text>
              </Box>
              <RowArea container={tier} items={items}>
                {items.map((item) => renderCard(item, tier))}
              </RowArea>
            </Box>
          )
        })}
      </Box>

      {/* The shelves: unranked (dated, not yet placed by this viewer) and
          unwatched/unread (no date for this viewer — shared for movies/TV,
          the viewer's own read record for books). */}
      {(
        [
          { container: 'unranked', label: 'Unranked', items: board.unranked, hint: shelfHint },
          { container: 'unwatched', label: unwatchedLabel, items: board.unwatched, hint: unwatchedHint },
        ] as const
      ).map(({ container, label, items, hint }) => {
        const open = openShelves[container]
        return (
          <Box
            key={container}
            data-board-shelf={container}
            data-shelf-open={open}
            mt={16}
            style={{ border: `1px dashed ${colors.dotted}`, borderRadius: 14, background: 'transparent' }}
          >
            {/* The heading sits INSIDE the card area so a collapsed shelf is
                still a drop target: a card can be unranked, or sent back to
                Not tried, without expanding the shelf first. */}
            <RowArea container={container} items={items} compact={!open}>
              <UnstyledButton
                data-shelf-toggle
                onClick={() => onToggleShelf(container)}
                aria-expanded={open}
                px={4}
                py={2}
                style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Text component="span" fz={11} c={colors.muted} aria-hidden style={{ width: 10 }}>
                  {open ? '▾' : '▸'}
                </Text>
                <Text component="span" fz={11} fw={700} c={colors.muted} tt="uppercase" style={{ letterSpacing: '0.08em' }}>
                  {label}
                </Text>
                <Text component="span" fz={11} c={colors.faint} style={{ fontFamily: fonts.sans }}>
                  · {items.length}
                </Text>
              </UnstyledButton>
              {open &&
                (items.length === 0 && hint ? (
                  <Text fz={13} c={colors.faint} p="16px 8px 24px" style={{ fontFamily: fonts.sans }}>
                    {hint}
                  </Text>
                ) : (
                  items.map((item) => renderCard(item, container))
                ))}
            </RowArea>
          </Box>
        )
      })}
    </Box>
  )
}
