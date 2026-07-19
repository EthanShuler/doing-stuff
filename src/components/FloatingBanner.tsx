import { Box } from '@mantine/core'
import { colors, fonts } from '../theme'

const TONES = {
  /** A failed write — clicking dismisses it. */
  error: {
    color: 'oklch(0.45 0.14 25)',
    background: 'oklch(0.96 0.04 25)',
    border: `1px solid ${colors.cardBorder}`,
  },
  /** A non-fatal warning (e.g. an address that couldn't be geocoded). */
  notice: {
    color: 'oklch(0.42 0.07 75)',
    background: 'oklch(0.96 0.05 85)',
    border: '1px solid rgba(160,120,40,0.35)',
  },
} as const

/** Floating dismissible banner pinned under the shell header. Renders nothing
 *  when `message` is null, so callers can pass `store.error` straight in. */
export function FloatingBanner({
  message,
  tone,
  top = 68,
  onDismiss,
}: {
  message: string | null
  tone: keyof typeof TONES
  /** Offset from the viewport top — lets a notice stack under an error. */
  top?: number
  onDismiss: () => void
}) {
  if (!message) return null
  const t = TONES[tone]
  return (
    <Box
      role="alert"
      c={t.color}
      px={14}
      py={9}
      onClick={onDismiss}
      style={{
        position: 'fixed',
        top,
        left: '50%',
        transform: 'translateX(-50%)',
        // Above Mantine's modal (200): failed writes keep their modal open and
        // rely on this banner to say why.
        zIndex: 300,
        maxWidth: 'min(92vw, 520px)',
        border: t.border,
        borderRadius: 9,
        background: t.background,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: fonts.sans,
        boxShadow: '0 8px 24px rgba(40,30,20,0.14)',
        cursor: 'pointer',
      }}
    >
      {message}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        style={{
          marginLeft: 10,
          padding: 0,
          border: 'none',
          background: 'none',
          color: colors.faint,
          font: 'inherit',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </Box>
  )
}
