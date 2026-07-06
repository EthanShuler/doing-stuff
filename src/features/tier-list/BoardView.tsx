import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { Box, Text } from '@mantine/core'
import type { TierItem } from '../../types'
import type { Board, ContainerId } from './derive'
import { TIERS, tierSwatch } from './derive'
import { colors, fonts } from '../../theme'

/** Layout for a row's card area — shared by the plain and droppable variants
 *  so the board looks identical with and without drag wiring. */
export const ROW_AREA_STYLE: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  alignContent: 'flex-start',
  gap: 8,
  padding: 8,
  minHeight: 116,
}

export interface RowAreaProps {
  container: ContainerId
  items: TierItem[]
  children: ReactNode
}

/** Default (read-only) card area: just the flex wrap. The interactive board
 *  substitutes a version that adds useDroppable + SortableContext. */
function PlainRowArea({ children }: RowAreaProps) {
  return <div style={ROW_AREA_STYLE}>{children}</div>
}

/**
 * The board itself: six tier rows + the unranked shelf. Purely presentational —
 * TierBoard injects sortable cards and droppable row areas for your own board;
 * the partner view renders it with plain cards and no drag wiring at all.
 */
export function BoardView({
  board,
  renderCard,
  RowArea = PlainRowArea,
  shelfHint,
}: {
  board: Board
  renderCard: (item: TierItem, container: ContainerId) => ReactNode
  RowArea?: ComponentType<RowAreaProps>
  /** Shown in the unranked shelf when it's empty. */
  shelfHint?: string
}) {
  return (
    <Box mt={20}>
      <Box style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        {TIERS.map((tier, i) => {
          const swatch = tierSwatch(tier)
          const items = board.tiers[tier]
          return (
            <Box
              key={tier}
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

      {/* Unranked shelf: everything not yet placed by this viewer. */}
      <Box
        mt={16}
        style={{ border: `1px dashed ${colors.dotted}`, borderRadius: 14, background: 'transparent' }}
      >
        <Text fz={11} fw={700} c={colors.muted} px={12} pt={10} tt="uppercase" style={{ letterSpacing: '0.08em' }}>
          Unranked
        </Text>
        <RowArea container="unranked" items={board.unranked}>
          {board.unranked.length === 0 && shelfHint ? (
            <Text fz={13} c={colors.faint} p="24px 8px" style={{ fontFamily: fonts.sans }}>
              {shelfHint}
            </Text>
          ) : (
            board.unranked.map((item) => renderCard(item, 'unranked'))
          )}
        </RowArea>
      </Box>
    </Box>
  )
}
