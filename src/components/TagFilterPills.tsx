import { Group, Text } from '@mantine/core'
import { ACCENT, colors, fonts } from '../theme'
import { Pill } from './Pill'
import type { TagFilterState } from '../lib/useTagFilter'

/** The tri-state tag pill row (see useTagFilter): an "All …" pill resets,
 *  each tag pill cycles include → exclude → off, and a hint appears once any
 *  state is set. Renders nothing when no tags are in use. */
export function TagFilterPills({
  tags,
  allLabel,
  tagFilter,
  filterActive,
  onToggle,
  onClear,
}: {
  tags: string[]
  /** Label for the reset pill, e.g. "All recipes" / "All movies". */
  allLabel: string
  tagFilter: TagFilterState
  filterActive: boolean
  onToggle: (tag: string) => void
  onClear: () => void
}) {
  if (tags.length === 0) return null
  return (
    <Group gap={8} mt={16} wrap="wrap">
      <Pill label={allLabel} active={!filterActive} activeBg={ACCENT} onClick={onClear} />
      {tags.map((tag) => (
        <Pill
          key={tag.toLowerCase()}
          label={tag}
          active={tagFilter[tag] !== undefined}
          excluded={tagFilter[tag] === 'exclude'}
          activeBg={ACCENT}
          onClick={() => onToggle(tag)}
        />
      ))}
      {filterActive && (
        <Text fz={12} c={colors.faint} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
          tap a tag again to exclude it
        </Text>
      )}
    </Group>
  )
}
