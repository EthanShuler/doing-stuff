import { Button, Group } from '@mantine/core'
import type { Screen } from '../types'
import { ScreenToggle } from './ScreenToggle'

/** Shared header controls — the screen toggle plus the global Manage / New
 *  entry buttons, shown on both the Log and Wishlist screens. */
export function HeaderActions({
  screen,
  onScreenChange,
  onManage,
  onAdd,
}: {
  screen: Screen
  onScreenChange: (screen: Screen) => void
  onManage: () => void
  onAdd: () => void
}) {
  return (
    <Group gap={10}>
      <ScreenToggle screen={screen} onChange={onScreenChange} />
      <Button variant="default" onClick={onManage} radius={10} styles={secondaryButtonStyles}>
        Manage
      </Button>
      <Button onClick={onAdd} radius={10}>
        + New entry
      </Button>
    </Group>
  )
}

const secondaryButtonStyles = {
  root: {
    background: 'transparent',
    border: '1px solid rgba(120,100,80,0.3)',
    color: '#5c574e',
  },
}
