import { Group, Text } from '@mantine/core'
import { ACCENT, colors, fonts } from '../theme'
import { Pill, TriPill } from './Pill'
import type { TriFilterState } from '../lib/triFilter'

/** The tri-state tag pill row (see src/lib/triFilter.ts): an "All …" pill
 *  resets, each tag pill cycles include → exclude → off (right-click runs it
 *  backwards), and a hint appears once any state is set. Renders nothing when
 *  no tags are in use. */
export function TagFilterPills({
  tags,
  allLabel,
  state,
  onCycle,
  onCycleBack,
  onClear,
}: {
  tags: string[]
  /** Label for the reset pill, e.g. "All recipes" / "All movies". */
  allLabel: string
  state: TriFilterState
  onCycle: (tag: string) => void
  onCycleBack: (tag: string) => void
  onClear: () => void
}) {
  if (tags.length === 0) return null
  const filterActive = Object.keys(state).length > 0
  return (
    <Group gap={8} mt={16} wrap="wrap">
      <Pill label={allLabel} active={!filterActive} activeBg={ACCENT} onClick={onClear} />
      {tags.map((tag) => (
        <TriPill
          key={tag.toLowerCase()}
          label={tag}
          state={state[tag]}
          activeBg={ACCENT}
          onCycle={() => onCycle(tag)}
          onCycleBack={() => onCycleBack(tag)}
        />
      ))}
      {filterActive && (
        <Text fz={12} c={colors.faint} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
          tap twice or right-click to exclude
        </Text>
      )}
    </Group>
  )
}
