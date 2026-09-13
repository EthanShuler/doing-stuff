import type { ReactNode } from 'react'
import { Box } from '@mantine/core'
import { colors, fonts } from '../theme'

/** The reading width every feature page's content column shares. A page that
 *  genuinely wants more room (the doing-stuff map) widens only that region —
 *  the control bar above it stays at this width so the chrome never shifts
 *  between screens. */
export const PAGE_MAX_WIDTH = 1200

/** Every feature page's outer frame: the page padding, ink color, and sans
 *  stack, plus the centered content column. One place to change the rhythm of
 *  all eight pages. */
export function PageFrame({ children, maw = PAGE_MAX_WIDTH }: { children: ReactNode; maw?: number }) {
  return (
    <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
      <Box maw={maw} mx="auto">
        {children}
      </Box>
    </Box>
  )
}
