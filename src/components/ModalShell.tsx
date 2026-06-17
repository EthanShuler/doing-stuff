import type { ReactNode } from 'react'
import { Modal } from '@mantine/core'

/**
 * Shared modal shell: the earthy "Compass" card on a dim brown backdrop, ported
 * from the old hand-rolled Overlay onto Mantine's Modal (focus trap, esc/click-out
 * to close, scroll lock come for free). Modals supply their own title + actions,
 * so the built-in header/close button is suppressed.
 */
export function ModalShell({
  opened,
  onClose,
  width = 460,
  children,
}: {
  opened: boolean
  onClose: () => void
  width?: number
  children: ReactNode
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      withCloseButton={false}
      size={width}
      padding={30}
      radius={18}
      overlayProps={{ color: '#2d261e', backgroundOpacity: 0.42 }}
      styles={{
        content: {
          background: 'oklch(0.985 0.01 78)',
          boxShadow: '0 24px 60px rgba(40,30,20,0.3)',
        },
      }}
    >
      {children}
    </Modal>
  )
}
