import { createContext, use, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import { colors, DANGER, fonts, radii, shadows, text } from '../theme'

export interface ConfirmOptions {
  /** The question, as a sentence: "Delete this entry?" */
  title: string
  /** What else goes with it — spell out anything that cascades. */
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive (the default) paints the confirm button red. */
  danger?: boolean
}

type Ask = (options: ConfirmOptions) => Promise<boolean>

/** Without a provider (a stray render outside main.tsx) nothing should be
 *  silently destroyed, so decline rather than throw mid-delete. */
const DECLINE: Ask = () => Promise.resolve(false)

const ConfirmContext = createContext<Ask | null>(null)
const ConfirmOpenContext = createContext(false)

/**
 * App-wide replacement for `window.confirm`: a themed modal that can stack
 * above an already-open modal (ModalShell reads `useConfirmOpen()` and yields
 * the focus trap and the escape key to it). Mounted once in main.tsx, inside
 * MantineProvider.
 *
 * `await confirm({...})` resolves true only on the confirm button — Escape,
 * the overlay, and Cancel all resolve false, so a caller can always write
 * `if (!(await confirm(...))) return`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  // Held across renders so the modal's buttons can settle the promise the
  // caller is awaiting.
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const ask = useCallback<Ask>((next) => {
    // A second ask while one is open (shouldn't happen — the first blocks a
    // modal) cancels the earlier one rather than stranding its promise.
    resolveRef.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = null
    setOptions(null)
  }, [])

  const opened = options !== null
  const danger = options?.danger ?? true

  // Escape is handled here rather than by the confirm's own Modal, because
  // Mantine closes on a window keydown listener and every modal in the app
  // has one. `closeOnEscape={!confirmOpen}` in ModalShell stops a modal that
  // registered BEFORE this provider, but a feature page's modal registers
  // AFTER (every route is a lazy chunk): by the time its listener ran, the
  // confirm had already closed and it would swallow the same key and close
  // itself too. This listener is registered at app mount, so it runs first
  // and takes the key out of circulation.
  const openedRef = useRef(false)
  useEffect(() => {
    openedRef.current = opened
  }, [opened])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || !openedRef.current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      settle(false)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [settle])

  return (
    <ConfirmContext value={ask}>
      <ConfirmOpenContext value={opened}>
        {children}
        <Modal
          opened={opened}
          onClose={() => settle(false)}
          centered
          title={options?.title ?? ''}
          withCloseButton={false}
          closeOnEscape={false}
          // Above the modals it stacks over (200), below the error banner (300)
          // — a failed write still has to be readable from here.
          zIndex={250}
          size={400}
          padding={26}
          radius={radii.modal}
          overlayProps={{ color: '#2d261e', backgroundOpacity: 0.42 }}
          styles={{
            content: { background: 'oklch(0.985 0.01 78)', boxShadow: shadows.modal, padding: 26 },
            header: { background: 'transparent', position: 'static', padding: 0, minHeight: 'auto', marginBottom: 10 },
            title: { fontFamily: fonts.serif, fontSize: 22, fontWeight: 500, lineHeight: 1.25, color: colors.ink },
            body: { padding: 0 },
          }}
        >
          {options?.message && (
            <Text fz={text.body} c={colors.inkFaded} lh={1.5} style={{ fontFamily: fonts.sans }}>
              {options.message}
            </Text>
          )}
          <Group justify="flex-end" gap={10} mt={22}>
            <Button variant="secondary" data-autofocus onClick={() => settle(false)}>
              {options?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              onClick={() => settle(true)}
              color={danger ? DANGER : undefined}
            >
              {options?.confirmLabel ?? 'Delete'}
            </Button>
          </Group>
        </Modal>
      </ConfirmOpenContext>
    </ConfirmContext>
  )
}

/** `const confirm = useConfirm()` → `if (!(await confirm({ title }))) return`. */
export function useConfirm(): Ask {
  return use(ConfirmContext) ?? DECLINE
}

/** Whether a confirm is up — ModalShell uses it to yield focus/escape. */
export function useConfirmOpen(): boolean {
  return use(ConfirmOpenContext)
}
