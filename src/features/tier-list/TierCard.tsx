import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Box, Text } from '@mantine/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TierItem } from '../../types'
import { colors, fonts } from '../../theme'

/** Card footprint — constant so tier rows pack densely and wrap cleanly. */
export const CARD_WIDTH = 76
const POSTER_HEIGHT = 100

/** Poster image with a graceful fallback for '' or broken URLs. Keyed on the
 *  URL by the parent, so fixing a bad link clears the broken state. */
function Poster({ item }: { item: TierItem }) {
  const [broken, setBroken] = useState(false)
  if (!item.imageUrl || broken) {
    return (
      <Box
        w="100%"
        h={POSTER_HEIGHT}
        bg={colors.chip}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}
      >
        {item.kind === 'tv' ? '📺' : '🎬'}
      </Box>
    )
  }
  return (
    <img
      src={item.imageUrl}
      alt={item.title}
      onError={() => setBroken(true)}
      draggable={false}
      style={{ width: '100%', height: POSTER_HEIGHT, objectFit: 'cover', display: 'block' }}
    />
  )
}

/** The plain card — used directly on the read-only partner board and inside
 *  the DragOverlay; SortableCard wraps it with the drag wiring. */
export function CardVisual({
  item,
  lifted,
  onClick,
}: {
  item: TierItem
  /** Floating in the DragOverlay: bigger shadow + slight tilt. */
  lifted?: boolean
  onClick?: () => void
}) {
  return (
    <Box
      w={CARD_WIDTH}
      bg="#fff"
      onClick={onClick}
      style={{
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: lifted ? '0 12px 28px rgba(40,30,20,0.28)' : '0 1px 3px rgba(40,30,20,0.08)',
        transform: lifted ? 'rotate(2deg)' : undefined,
        cursor: onClick ? 'pointer' : undefined,
        userSelect: 'none',
      }}
    >
      <Poster key={item.imageUrl} item={item} />
      <Text
        fz={10.5}
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
    </Box>
  )
}

/** A draggable/sortable card on your own board. Click (under the sensor's
 *  4px activation distance) opens the edit modal instead of starting a drag. */
export function SortableCard({ item, onClick }: { item: TierItem; onClick?: () => void }) {
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
      <CardVisual item={item} onClick={onClick} />
    </div>
  )
}
