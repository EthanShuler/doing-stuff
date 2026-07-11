import { SegmentedControl } from '@mantine/core'
import type { Screen } from '../../types'

/** Top-level Log / Wishlist switcher, shown in both screens' headers. */
export function ScreenToggle({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  return (
    <SegmentedControl
      value={screen}
      onChange={(value) => onChange(value as Screen)}
      data={[
        { label: 'Log', value: 'log' },
        { label: 'Wishlist', value: 'wishlist' },
        { label: 'Map', value: 'map' },
        { label: 'Calendar', value: 'calendar' },
      ]}
    />
  )
}
