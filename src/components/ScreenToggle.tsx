import { SegmentedControl } from '@mantine/core'
import type { Screen } from '../types'
import { colors, fonts } from '../theme'

/** Top-level Log / Wishlist switcher, shown in both screens' headers. */
export function ScreenToggle({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  return (
    <SegmentedControl
      value={screen}
      onChange={(value) => onChange(value as Screen)}
      data={[
        { label: 'Log', value: 'log' },
        { label: 'Wishlist', value: 'wishlist' },
      ]}
      radius={9}
      styles={{
        root: { background: colors.chip, border: '1px solid rgba(120,100,80,0.12)', padding: 3 },
        label: { fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: colors.muted },
      }}
    />
  )
}
