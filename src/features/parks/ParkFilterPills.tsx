import { Group } from '@mantine/core'
import { colors } from '../../theme'
import { Pill, TriPill } from '../../components/Pill'
import type { TriFilterState } from '../../lib/triFilter'
import type { Member } from './derive'
import { TOGETHER, UNVISITED } from './derive'

/** The status filter shared by the map and the list: All, each member (in
 *  their pin color), Together, Unvisited — tri-state pills, so right-click
 *  excludes (see src/lib/triFilter.ts). */
export function ParkFilterPills({
  members,
  filter,
  onCycle,
  onCycleBack,
  onClear,
}: {
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
      {members.map((m) => pill(m.id, m.name || 'Member', m.color, m.color))}
      {members.length > 1 && pill(TOGETHER, 'Together', colors.ink)}
      {pill(UNVISITED, 'Unvisited', colors.muted)}
    </Group>
  )
}
