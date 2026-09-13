import type { CSSProperties } from 'react'
import { Box, Text } from '@mantine/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TierItem } from '../../types'
import { colors, fonts, shadows, text } from '../../theme'
import { MediaImage } from '../../components/MediaImage'

/** Card footprint — constant so tier rows pack densely and wrap cleanly. */
export const CARD_WIDTH = 76
const POSTER_HEIGHT = 100

/** The plain card — used directly on the read-only partner board and inside
 *  the DragOverlay; SortableCard wraps it with the drag wiring. */
export function CardVisual({
  item,
  emoji,
  lifted,
  onClick,
}: {
  item: TierItem
  /** Board emoji shown when the item has no image — passed in rather than
   *  looked up, since a space-defined list's emoji lives on its row (see
   *  copyFor in copy.ts), not in a static table. */
  emoji: string
  /** Floating in the DragOverlay: bigger shadow + slight tilt. */
  lifted?: boolean
  onClick?: () => void
}) {
  return (
    <Box
      w={CARD_WIDTH}
      bg={colors.surface}
      onClick={onClick}
      style={{
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: lifted ? shadows.lifted : shadows.card,
        transform: lifted ? 'rotate(2deg)' : undefined,
        cursor: onClick ? 'pointer' : undefined,
        userSelect: 'none',
      }}
    >
      <MediaImage
        imageUrl={item.imageUrl}
        title={item.title}
        emoji={emoji}
        width="100%"
        height={POSTER_HEIGHT}
        srcWidth={CARD_WIDTH}
      />
      <Text
        fz={text.tiny}
        lh={1.25}
        fw={600}
        c={colors.ink}
        p="4px 5px"
        lineClamp={2}
        ta="center"
        style={{ fontFamily: fonts.sans, minHeight: 34 }}
      >
        {item.title}
      </Text>
      {item.creator && (
        <Text
          fz={9}
          lh={1.2}
          c={colors.faint}
          px={5}
          pb={4}
          mt={-2}
          lineClamp={1}
          ta="center"
          style={{ fontFamily: fonts.sans }}
        >
          {item.creator}
        </Text>
      )}
    </Box>
  )
}

/** A draggable/sortable card on your own board. Click (under the sensor's
 *  4px activation distance) opens the edit modal instead of starting a drag. */
export function SortableCard({
  item,
  emoji,
  onClick,
}: {
  item: TierItem
  emoji: string
  onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The original stays in place as a ghost; the DragOverlay is the visual.
    opacity: isDragging ? 0.35 : 1,
    touchAction: 'manipulation',
    cursor: 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardVisual item={item} emoji={emoji} onClick={onClick} />
    </div>
  )
}
