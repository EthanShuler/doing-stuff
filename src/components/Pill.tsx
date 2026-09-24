import { Box, UnstyledButton } from '@mantine/core'
import { colors, fonts } from '../theme'
import type { TriState } from '../lib/triFilter'

/** Rounded pill: the filter rows (usually via TriPill below) and the
 *  PickerRow. Active pills fill with `activeBg`; `dotColor` draws a swatch
 *  dot. `excluded` is a tri-state filter's third state — outlined in
 *  `activeBg` with a struck-through "− label". */
export function Pill({
  label,
  active,
  excluded = false,
  activeBg,
  dotColor,
  title,
  onClick,
  onContextMenu,
}: {
  label: string
  active: boolean
  excluded?: boolean
  activeBg: string
  dotColor?: string
  /** Native hover tooltip. */
  title?: string
  onClick: () => void
  /** Right-click handler; the browser's own menu is suppressed when set. */
  onContextMenu?: () => void
}) {
  const filled = active && !excluded
  return (
    <UnstyledButton
      onClick={onClick}
      title={title}
      onContextMenu={
        onContextMenu
          ? (event) => {
              event.preventDefault()
              onContextMenu()
            }
          : undefined
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: fonts.sans,
        fontSize: 13,
        padding: '8px 16px',
        borderRadius: 30,
        fontWeight: filled || excluded ? 600 : 500,
        background: filled ? activeBg : colors.chip,
        color: filled ? colors.onAccent : colors.inkFaded,
        border: filled || excluded ? `1px solid ${activeBg}` : `1px solid ${colors.borderFaint}`,
        textDecoration: excluded ? 'line-through' : 'none',
      }}
    >
      {dotColor && <Box w={7} h={7} style={{ borderRadius: '50%', background: dotColor }} />}
      {excluded ? `− ${label}` : label}
    </UnstyledButton>
  )
}

/** Hover hint on every tri-state pill — right-click is otherwise invisible. */
export const TRI_PILL_HINT = 'Click to filter · right-click to exclude'

/** A pill in a tri-state filter row (see src/lib/triFilter.ts): click cycles
 *  off → include → exclude, right-click runs that cycle backwards. `dot` is
 *  the swatch color; it flips to the on-accent color while the pill is filled. */
export function TriPill({
  label,
  state,
  activeBg,
  dot,
  onCycle,
  onCycleBack,
}: {
  label: string
  state: TriState | undefined
  activeBg: string
  dot?: string
  onCycle: () => void
  onCycleBack: () => void
}) {
  return (
    <Pill
      label={label}
      active={state !== undefined}
      excluded={state === 'exclude'}
      activeBg={activeBg}
      dotColor={dot && (state === 'include' ? colors.onAccent : dot)}
      title={TRI_PILL_HINT}
      onClick={onCycle}
      onContextMenu={onCycleBack}
    />
  )
}
