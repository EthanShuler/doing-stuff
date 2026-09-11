import type { ReactNode } from 'react'
import { Box, Text, UnstyledButton } from '@mantine/core'
import { colors, fonts, radii, shadows } from '../theme'
import { PhotoWithFallback } from './PhotoWithFallback'

/** Auto-filling card grid — spoons, little guys, recipes. `minColumnWidth`
 *  is the narrowest a column may get before the grid drops one. */
export function PhotoCardGrid({
  minColumnWidth = 170,
  children,
}: {
  minColumnWidth?: number
  children: ReactNode
}) {
  return (
    <Box
      mt={24}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`,
        gap: 18,
      }}
    >
      {children}
    </Box>
  )
}

/** One card in a PhotoCardGrid: photo (with its feature's emoji fallback),
 *  title, and whatever meta lines the feature wants below it. `data-hover-card`
 *  wires up the shared hover/focus treatment in index.css — inline styles
 *  can't express `:hover`. */
export function PhotoCard({
  imageUrl,
  alt,
  fallbackEmoji,
  photoHeight = 170,
  title,
  onClick,
  children,
}: {
  imageUrl: string
  alt: string
  fallbackEmoji: string
  photoHeight?: number
  title: string
  onClick: () => void
  children?: ReactNode
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      bg={colors.surface}
      data-hover-card
      style={{
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: radii.card,
        overflow: 'hidden',
        boxShadow: shadows.card,
        display: 'block',
      }}
    >
      <PhotoWithFallback imageUrl={imageUrl} alt={alt} height={photoHeight} fallbackEmoji={fallbackEmoji} />
      <Box p="10px 12px 12px">
        <Text fz={15} fw={700} c={colors.ink} lh={1.3} style={{ fontFamily: fonts.sans }}>
          {title}
        </Text>
        {children}
      </Box>
    </UnstyledButton>
  )
}
