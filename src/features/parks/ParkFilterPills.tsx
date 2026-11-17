import { Group } from '@mantine/core'
import { ACCENT_BLUE, colors } from '../../theme'
import { Pill, TriPill } from '../../components/Pill'
import type { TriFilterState } from '../../lib/triFilter'
import type { Member } from './derive'
import { TOGETHER, UNVISITED, VISITED } from './derive'

/** The status filter shared by the map and the list: All, each member (in
 *  their pin color), Together, Unvisited — tri-state pills, so right-click
 *  excludes (see src/lib/triFilter.ts). In group mode (3+ members) it's
 *  All / Visited / Unvisited, read against the page's whose-map viewer. */
export function ParkFilterPills({
  group = false,
  members,
  filter,
  onCycle,
  onCycleBack,
  onClear,
}: {
  group?: boolean
  members: Member[]
  filter: TriFilterState
  onCycle: (key: string) => void
  onCycleBack: (key: string) => void
  onClear: () => void
}) {
  const pill = (key: string, label: string, activeBg: string, dot?: string) => (
    <TriPill
      key={key}
      label={label}
      state={filter[key]}
      activeBg={activeBg}
      dot={dot}
      onCycle={() => onCycle(key)}
      onCycleBack={() => onCycleBack(key)}
    />
  )
  return (
    <Group gap={8} mt={20} wrap="wrap">
      <Pill label="All" active={Object.keys(filter).length === 0} activeBg={colors.ink} onClick={onClear} />
      {group ? (
        pill(VISITED, 'Visited', ACCENT_BLUE, ACCENT_BLUE)
      ) : (
        <>
          {members.map((m) => pill(m.id, m.name || 'Member', m.color, m.color))}
          {members.length > 1 && pill(TOGETHER, 'Together', colors.ink)}
        </>
      )}
      {pill(UNVISITED, 'Unvisited', colors.muted)}
    </Group>
  )
}
