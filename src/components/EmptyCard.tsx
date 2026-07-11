import type { ReactNode } from 'react'
import { Box, Text } from '@mantine/core'
import { colors, fonts } from '../theme'

/** Dashed empty-state card shared by the Log, wishlist, and watchlist views.
 *  `children` renders below the blurb (e.g. a call-to-action button). */
export function EmptyCard({
  title,
  blurb,
  mt = 20,
  children,
}: {
  title: string
  blurb: string
  mt?: number
  children?: ReactNode
}) {
  return (
    <Box
      mt={mt}
      ta="center"
      bg="#fff"
      p="56px 24px"
      style={{ border: `1px dashed ${colors.dashedBorder}`, borderRadius: 16 }}
    >
      <Text fz={22} mb={6} style={{ fontFamily: fonts.serif }}>
        {title}
      </Text>
      <Text fz={14} c={colors.muted} mb={children ? 20 : 0}>
        {blurb}
      </Text>
      {children}
    </Box>
  )
}
