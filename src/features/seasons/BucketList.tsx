import { Anchor, Box, Checkbox, Group, SimpleGrid, Text, UnstyledButton } from '@mantine/core'
import type { SeasonItem } from '../../types'
import { ACCENT, colors, fieldLabelStyle, fonts, radii, text, warmBorder } from '../../theme'
import { EmptyCard } from '../../components/EmptyCard'
import { isDone, itemTag } from './derive'
import type { SectionGroup, Weekend, WeekendDayGroup } from './derive'
import { QuickAdd } from './QuickAdd'
import { SchedulePopover } from './SchedulePopover'
import { TagChip } from './TagChip'

/** What every item row needs from the page. */
export interface RowActions {
  today: string
  /** The season's remaining weekends (deadline counting). */
  weekends: Weekend[]
  /** The scheduler's chips. */
  dayGroups: WeekendDayGroup[]
  onToggleDone: (item: SeasonItem) => void
  onEdit: (item: SeasonItem) => void
  onPlan: (item: SeasonItem, date: string | null) => void
}

/**
 * The bucket list: every section as a headed group, its subsections as
 * panels in a two-up grid (one column on a phone), items as dense rows with
 * their sub-options indented beneath. The chip at a row's end is its day or
 * deadline and opens the scheduler; the title opens the item modal.
 */
export function BucketList({
  groups,
  filtering,
  actions,
  onQuickAdd,
}: {
  /** Already filtered (see filterItems) and grouped (groupSections). */
  groups: SectionGroup[]
  /** A filter is on — changes the empty state's wording. */
  filtering: boolean
  actions: RowActions
  /** Add a title-only item to one subsection. Resolves false on failure. */
  onQuickAdd: (section: string, subsection: string, title: string) => Promise<boolean>
}) {
  if (groups.length === 0) {
    return filtering ? (
      <EmptyCard title="Nothing fits those filters" blurb="Clear a pill or two to see the rest of the list." />
    ) : (
      <EmptyCard title="Nothing on this season yet" blurb="Add the first thing you want to do — “+ Add item” up top." />
    )
  }

  return (
    <Box mt={8}>
      {groups.map((group) => {
        const count = group.subsections.reduce((n, s) => n + s.nodes.reduce((m, node) => m + 1 + node.children.length, 0), 0)
        return (
          <Box key={group.section} component="section" mt={26}>
            <Group gap={10} align="baseline" mb={10}>
              <Text component="h2" m={0} fz={22} fw={500} c={colors.ink} style={{ fontFamily: fonts.serif }}>
                {group.section}
              </Text>
              <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.mono }}>
                {count}
              </Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={14} verticalSpacing={14}>
              {group.subsections.map((sub) => (
                <Box
                  key={sub.subsection || '(none)'}
                  bg={colors.surface}
                  style={{ border: `1px solid ${warmBorder(0.13)}`, borderRadius: radii.panel, overflow: 'hidden', alignSelf: 'start' }}
                >
                  {sub.subsection && (
                    <Text px={12} pt={10} pb={4} style={{ ...fieldLabelStyle, fontSize: text.tiny, marginBottom: 0 }}>
                      {sub.subsection}
                    </Text>
                  )}
                  {sub.nodes.map((node) => (
                    <Box key={node.item.id}>
                      <ItemRow item={node.item} child={false} actions={actions} />
                      {node.children.map((c) => (
                        <ItemRow key={c.id} item={c} child actions={actions} />
                      ))}
                    </Box>
                  ))}
                  <Box px={12} style={{ borderTop: `1px solid ${colors.borderFaint}` }}>
                    <QuickAdd
                      placeholder={`+ Add to ${sub.subsection || group.section}…`}
                      ariaLabel={`Add to ${[group.section, sub.subsection].filter(Boolean).join(' › ')}`}
                      onAdd={(title) => onQuickAdd(group.section, sub.subsection, title)}
                    />
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )
      })}
    </Box>
  )
}

/** One dense bucket-list row: check · title (· note ↗) · day/deadline chip. */
function ItemRow({ item, child, actions }: { item: SeasonItem; child: boolean; actions: RowActions }) {
  const done = isDone(item)
  const tag = itemTag(item, actions.today, actions.weekends)
  return (
    <Group gap={8} wrap="nowrap" align="center" mih={36} py={5} pr={10} pl={child ? 30 : 12}>
      {child && (
        <Text fz={text.caption} c={colors.faint} ml={-16} w={10} aria-hidden style={{ userSelect: 'none' }}>
          ↳
        </Text>
      )}
      <Checkbox
        checked={done}
        onChange={() => actions.onToggleDone(item)}
        size="sm"
        radius="xl"
        color={ACCENT}
        aria-label={done ? `Reopen “${item.title}”` : `Mark “${item.title}” done`}
        styles={{ input: { cursor: 'pointer' } }}
      />
      <Box flex={1} miw={0}>
        <UnstyledButton
          onClick={() => actions.onEdit(item)}
          style={{
            fontFamily: fonts.sans,
            fontSize: text.body,
            color: done ? colors.faint : colors.ink,
            textDecoration: done ? 'line-through' : 'none',
            textAlign: 'left',
            lineHeight: 1.35,
          }}
        >
          {item.title}
        </UnstyledButton>
        {item.note && (
          <Text component="span" fz={text.caption} c={colors.faint}>
            {' '}
            · {item.note}
          </Text>
        )}
        {item.url && (
          <Anchor
            href={item.url}
            target="_blank"
            rel="noreferrer"
            fz={text.caption}
            c={colors.muted}
            ml={6}
            aria-label={`Open the link for ${item.title}`}
          >
            ↗
          </Anchor>
        )}
      </Box>
      {(tag || !done) && (
        <SchedulePopover
          item={item}
          groups={actions.dayGroups}
          onPlan={(date) => actions.onPlan(item, date)}
          onEdit={() => actions.onEdit(item)}
          ariaLabel={tag ? `${tag.label} — plan “${item.title}”` : `Plan “${item.title}”`}
          targetStyle={{ flexShrink: 0 }}
        >
          <TagChip tone={tag ? tag.tone : 'plan'} label={tag ? tag.label : '+ plan'} />
        </SchedulePopover>
      )}
    </Group>
  )
}
