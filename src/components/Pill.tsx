import { Box, UnstyledButton } from '@mantine/core'
import { colors, fonts } from '../theme'

/** Rounded filter pill used by the Log, Map, and Calendar category filters
 *  and the tier-list tag filter. Active pills fill with `activeBg`; `dotColor`
 *  draws the category swatch dot. `excluded` is the tri-state tag filter's
 *  third state — outlined in `activeBg` with a struck-through "− tag" label. */
export function Pill({
  label,
  active,
  excluded = false,
  activeBg,
  dotColor,
  onClick,
}: {
  label: string
  active: boolean
  excluded?: boolean
  activeBg: string
  dotColor?: string
  onClick: () => void
}) {
  const filled = active && !excluded
  return (
    <UnstyledButton
      onClick={onClick}
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
        color: filled ? '#fff' : colors.inkFaded,
        border: filled || excluded ? `1px solid ${activeBg}` : `1px solid ${colors.borderFaint}`,
        textDecoration: excluded ? 'line-through' : 'none',
      }}
    >
      {dotColor && <Box w={7} h={7} style={{ borderRadius: '50%', background: dotColor }} />}
      {excluded ? `− ${label}` : label}
    </UnstyledButton>
  )
}
