import { Button, Group } from '@mantine/core'
import type { Screen } from '../../types'
import { ScreenToggle } from './ScreenToggle'

/** The doing-stuff control bar, rendered once above every screen: the
 *  Log / Wishlist / Map / Calendar toggle plus the global Manage / New entry
 *  buttons. (The app title lives in the shell header now.) */
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
    <Group
      justify="space-between"
      align="center"
      gap={12}
      wrap="wrap"
      pb={18}
      style={{ borderBottom: '1px dotted rgba(120,100,80,0.4)' }}
    >
      <ScreenToggle screen={screen} onChange={onScreenChange} />
      <Group gap={10}>
        <Button variant="default" onClick={onManage} radius={10} styles={secondaryButtonStyles}>
          Manage
        </Button>
        <Button onClick={onAdd} radius={10}>
          + New entry
        </Button>
      </Group>
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
