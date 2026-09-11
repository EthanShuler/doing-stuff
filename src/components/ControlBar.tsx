import type { ReactNode } from 'react'
import { Group } from '@mantine/core'
import { colors } from '../theme'

/** The row at the top of every feature page: screen toggles, filters and
 *  counts on the left, the primary action on the right, over a dotted rule.
 *  It renders whether or not the page's data has arrived — the loading splash
 *  replaces the content below it, never the chrome. */
export function ControlBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <Group
      justify="space-between"
      align="center"
      gap={12}
      wrap="wrap"
      pb={18}
      style={{ borderBottom: `1px dotted ${colors.rule}` }}
    >
      <Group gap={12} align="center" wrap="wrap">
        {left}
      </Group>
      {right && (
        <Group gap={10} align="center" wrap="nowrap">
          {right}
        </Group>
      )}
    </Group>
  )
}
