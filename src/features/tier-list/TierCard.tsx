import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Box, Text } from '@mantine/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TierItem } from '../../types'
import { colors, fonts, shadows, text } from '../../theme'
import { posterSrc } from '../../lib/imageUrl'
import { KIND_COPY } from './copy'

/** Card footprint — constant so tier rows pack densely and wrap cleanly. */
export const CARD_WIDTH = 76
const POSTER_HEIGHT = 100

/** A poster/cover image with a graceful emoji fallback for '' or broken URLs —
 *  shared by the board cards (full-width) and the watchlist rows (thumbnail).
 *  The broken state is remembered per URL, so pasting a new link retries. */
export function MediaImage({
  imageUrl,
  title,
  emoji,
  width,
  height,
  radius = 0,
  emojiSize = 26,
  srcWidth,
}: {
  imageUrl: string
  title: string
  /** Kind emoji shown when there's no usable image (see KIND_COPY). */
  emoji: string
  width: number | string
  height: number
  radius?: number
  emojiSize?: number
  /** Rendered width in CSS px, used to ask the CDN for a right-sized file
   *  (see posterSrc). Defaults to a numeric `width`, else the card width —
   *  pass it explicitly whenever `width` is a percentage. */
  srcWidth?: number
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  if (!imageUrl || brokenUrl === imageUrl) {
    return (
      <Box
        w={width}
        h={height}
        bg={colors.chip}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: radius,
          fontSize: emojiSize,
        }}
      >
        {emoji}
      </Box>
    )
  }
  // The rewritten src is a render-time detail; `brokenUrl` stays keyed on the
  // STORED url so the retry-on-new-link behaviour doesn't depend on sizing.
  return (
    <img
      src={posterSrc(imageUrl, srcWidth ?? (typeof width === 'number' ? width : CARD_WIDTH))}
      alt={title}
      onError={() => setBrokenUrl(imageUrl)}
      draggable={false}
      loading="lazy"
      decoding="async"
      style={{ width, height, objectFit: 'cover', borderRadius: radius, flexShrink: 0, display: 'block' }}
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
        emoji={KIND_COPY[item.kind].emoji}
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
