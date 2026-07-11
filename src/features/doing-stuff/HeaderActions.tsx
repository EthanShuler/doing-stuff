import { Button, Group } from '@mantine/core'
import type { Screen } from '../../types'
import { colors } from '../../theme'
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
      style={{ borderBottom: `1px dotted ${colors.rule}` }}
    >
      <ScreenToggle screen={screen} onChange={onScreenChange} />
      <Group gap={10}>
        <Button variant="secondary" onClick={onManage} radius={10}>
          Manage
        </Button>
        <Button onClick={onAdd} radius={10}>
          + New entry
        </Button>
      </Group>
    </Group>
  )
}
