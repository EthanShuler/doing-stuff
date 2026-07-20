import { SegmentedControl } from '@mantine/core'
import type { Screen } from '../../types'

/** Log / Wishlist / Map / Calendar switcher, rendered once in the feature
 *  control bar (see HeaderActions). */
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
