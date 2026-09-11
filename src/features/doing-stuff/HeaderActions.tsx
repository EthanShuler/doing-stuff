import { Button } from '@mantine/core'
import type { Screen } from '../../types'
import { ControlBar } from '../../components/ControlBar'
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
    <ControlBar
      left={<ScreenToggle screen={screen} onChange={onScreenChange} />}
      right={
        <>
          <Button variant="secondary" onClick={onManage}>
            Manage
          </Button>
          <Button onClick={onAdd}>+ New entry</Button>
        </>
      }
    />
  )
}
