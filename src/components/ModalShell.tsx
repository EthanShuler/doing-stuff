import type { ReactNode } from 'react'
import { Modal } from '@mantine/core'
import { colors, fonts, radii, shadows } from '../theme'
import { useConfirmOpen } from './ConfirmModal'

/** The named widths a modal may take. Everything wider than a form column is
 *  a two-column layout (fields + photo), so there are only four. */
const SIZES = { sm: 460, md: 520, lg: 560, xl: 640 } as const

/**
 * Shared modal shell: the earthy "Compass" card on a dim brown backdrop, ported
 * from the old hand-rolled Overlay onto Mantine's Modal (focus trap, esc/click-out
 * to close, scroll lock come for free).
 *
 * The title goes through Mantine's own `title` prop rather than a hand-rolled
 * `<Title>` in the body: `ModalBaseContent` hardcodes `aria-labelledby` to its
 * title element's id, so that is the only way the dialog gets an accessible
 * name. Mantine's header is restyled here to look exactly like the heading it
 * replaced (serif 28, flush with the body, 22px below).
 */
export function ModalShell({
  opened,
  onClose,
  title,
  size = 'sm',
  zIndex,
  children,
}: {
  opened: boolean
  onClose: () => void
  /** Usually a string; a fragment when the header carries an action or an
   *  eyebrow line beside the name. */
  title: ReactNode
  size?: keyof typeof SIZES
  zIndex?: number
  children: ReactNode
}) {
  // A confirm dialog stacks above this one. While it's up, hand it the focus
  // trap and the escape key — otherwise this modal swallows both (the same
  // thing Mantine's own Modal.Stack does internally).
  const confirmOpen = useConfirmOpen()

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      title={title}
      withCloseButton={false}
      trapFocus={!confirmOpen}
      closeOnEscape={!confirmOpen}
      size={SIZES[size]}
      padding={30}
      radius={radii.modal}
      zIndex={zIndex}
      overlayProps={{ color: '#2d261e', backgroundOpacity: 0.42 }}
      styles={{
        content: {
          background: 'oklch(0.985 0.01 78)',
          boxShadow: shadows.modal,
          padding: 30,
        },
        // Mantine's header is a sticky, padded, opaque bar; flatten it back
        // into a plain heading sitting above the fields.
        header: {
          background: 'transparent',
          position: 'static',
          padding: 0,
          minHeight: 'auto',
          marginBottom: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        },
        // Matches the hand-rolled <Title order={3} fz={28}> these replaced.
        // `flex: 1` gives the heading the full header width, so a title
        // fragment can lay its own parts out (ManageModal's trailing button,
        // ParkModal's eyebrow line) without fighting the header.
        title: {
          fontFamily: fonts.serif,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.2,
          color: colors.ink,
          flex: 1,
        },
        body: { padding: 0 },
      }}
    >
      {children}
    </Modal>
  )
}
