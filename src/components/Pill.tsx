import { Box, UnstyledButton } from '@mantine/core'
import { colors, fonts } from '../theme'

/** Rounded filter pill used by the Log, Map, and Calendar category filters.
 *  Active pills fill with `activeBg`; `dotColor` draws the category swatch dot. */
export function Pill({
  label,
  active,
  activeBg,
  dotColor,
  onClick,
}: {
  label: string
  active: boolean
  activeBg: string
  dotColor?: string
  onClick: () => void
}) {
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
        fontWeight: active ? 600 : 500,
        background: active ? activeBg : colors.chip,
        color: active ? '#fff' : '#6b665e',
        border: active ? `1px solid ${activeBg}` : '1px solid rgba(120,100,80,0.12)',
      }}
    >
      {dotColor && <Box w={7} h={7} style={{ borderRadius: '50%', background: dotColor }} />}
      {label}
    </UnstyledButton>
  )
}
