import { useState } from 'react'
import { Box, Checkbox, Flex, Grid, Group, SimpleGrid, Text, UnstyledButton } from '@mantine/core'
import type { Season, SeasonItem } from '../../types'
import { ACCENT, colors, fieldLabelStyle, fonts, radii, text, warmBorder } from '../../theme'
import { formatDate } from '../../lib/format'
import { EmptyCard } from '../../components/EmptyCard'
import {
  dayLabel,
  isDone,
  isFixed,
  isPlannableDay,
  itemTag,
  missed,
  parentTitle,
  relativeWeekendLabel,
  seasonPhase,
  unplanned,
  weekendLabel,
  weekendPlans,
  weekendsLeftPhrase,
} from './derive'
import type { ItemTag, WeekendPlan } from './derive'
import type { RowActions } from './BucketList'
import { QuickAdd } from './QuickAdd'
import { SchedulePopover } from './SchedulePopover'
import { TagChip } from './TagChip'

/** How many Unplanned rows show before "Show all". */
const TRAY_PREVIEW = 8

const panelStyle = {
  border: `1px solid ${warmBorder(0.13)}`,
  borderRadius: radii.panel,
  overflow: 'hidden',
} as const

/**
 * The Plan screen — the point of the feature: how many weekends are left,
 * what still needs a day (soonest deadline first), what slipped by, and one
 * card per remaining weekend with its Fri · Sat · Sun. Every item is a tap
 * target that opens the scheduler (SchedulePopover); each plannable day has
 * a quick-add that files a new item under "Unsorted" on that day.
 */
export function PlanView({
  season,
  items,
  actions,
  onQuickAddDay,
}: {
  season: Season
  /** This season's items. */
  items: SeasonItem[]
  actions: RowActions
  /** Add a title-only Unsorted item planned on `day`. Resolves false on failure. */
  onQuickAddDay: (day: string, title: string) => Promise<boolean>
}) {
  const { today } = actions
  const phase = seasonPhase(season, today)
  const plans = weekendPlans(items, actions.weekends)
  const open = unplanned(items)
  const slipped = missed(items, today)
  const left = weekendsLeftPhrase(actions.weekends.length)

  return (
    <>
      <Box mt={20} mb={18}>
        <Text component="h2" m={0} fz={26} fw={500} c={colors.ink} style={{ fontFamily: fonts.serif }}>
          {phase === 'over'
            ? `${season.name} is over`
            : phase === 'upcoming'
              ? `Starts ${formatDate(season.startsOn)} · ${actions.weekends.length} weekends`
              : left.charAt(0).toUpperCase() + left.slice(1)}
        </Text>
        <Text fz={text.small} c={colors.muted} mt={2}>
          {season.emoji} {season.name} · {formatDate(season.startsOn)} – {formatDate(season.endsOn)} · {open.length} still
          unplanned
        </Text>
      </Box>

      <Grid gap={20}>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <UnplannedTray items={open} all={items} actions={actions} />
          {slipped.length > 0 && <MissedTray items={slipped} all={items} actions={actions} />}
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          {plans.length === 0 ? (
            <EmptyCard
              mt={0}
              title="No weekends left"
              blurb="This season’s weekends are behind you — start the next one with “+ New season”."
            />
          ) : (
            plans.map((plan) => (
              <WeekendCard
                key={plan.weekend.fri}
                plan={plan}
                season={season}
                all={items}
                actions={actions}
                onQuickAddDay={onQuickAddDay}
              />
            ))
          )}
        </Grid.Col>
      </Grid>
    </>
  )
}

/** "Baked goods" / "Food", or "under hard cider" for a sub-option — so a row
 *  out of its bucket-list context still reads. */
function contextLine(all: SeasonItem[], item: SeasonItem): string {
  const parent = parentTitle(all, item)
  if (parent) return `under ${parent}`
  return item.subsection ? `${item.section} › ${item.subsection}` : item.section
}

function TrayHeading({ title, count, hint }: { title: string; count: number; hint: string }) {
  return (
    <Box px={12} pt={10} pb={6}>
      <Group gap={8} align="baseline">
        <Text style={{ ...fieldLabelStyle, marginBottom: 0 }}>{title}</Text>
        <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.mono }}>
          {count}
        </Text>
      </Group>
      <Text fz={text.tiny} c={colors.faint} mt={2}>
        {hint}
      </Text>
    </Box>
  )
}

/** One tray row: the whole row opens the scheduler. */
function TrayRow({
  item,
  all,
  actions,
  tag,
}: {
  item: SeasonItem
  all: SeasonItem[]
  actions: RowActions
  tag: ItemTag | null
}) {
  return (
    <Box style={{ borderTop: `1px solid ${colors.borderFaint}` }}>
      <SchedulePopover
        item={item}
        groups={actions.dayGroups}
        onPlan={(date) => actions.onPlan(item, date)}
        onEdit={() => actions.onEdit(item)}
        ariaLabel={`Plan “${item.title}”`}
        targetStyle={{ display: 'block', width: '100%', padding: '7px 12px' }}
      >
        <Group gap={8} wrap="nowrap" justify="space-between" align="center">
          <Box miw={0}>
            <Text fz={text.body} c={colors.ink} lh={1.3}>
              {item.title}
            </Text>
            <Text fz={text.tiny} c={colors.faint}>
              {contextLine(all, item)}
            </Text>
          </Box>
          {tag && <TagChip tone={tag.tone} label={tag.label} />}
        </Group>
      </SchedulePopover>
    </Box>
  )
}

function UnplannedTray({ items, all, actions }: { items: SeasonItem[]; all: SeasonItem[]; actions: RowActions }) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? items : items.slice(0, TRAY_PREVIEW)
  return (
    <Box bg={colors.surface} style={panelStyle} mb={16} data-tray="unplanned">
      <TrayHeading title="Unplanned" count={items.length} hint="Soonest deadline first — tap one to give it a day." />
      {items.length === 0 ? (
        <Text px={12} pb={12} fz={text.small} c={colors.muted} style={{ fontStyle: 'italic' }}>
          Everything has a day. 🎉
        </Text>
      ) : (
        <>
          {shown.map((item) => (
            <TrayRow key={item.id} item={item} all={all} actions={actions} tag={itemTag(item, actions.today, actions.weekends)} />
          ))}
          {items.length > TRAY_PREVIEW && (
            <UnstyledButton
              onClick={() => setShowAll((v) => !v)}
              w="100%"
              px={12}
              py={8}
              style={{
                borderTop: `1px solid ${colors.borderFaint}`,
                fontFamily: fonts.sans,
                fontSize: text.caption,
                color: colors.muted,
              }}
            >
              {showAll ? '▴ Show fewer' : `▾ Show all ${items.length}`}
            </UnstyledButton>
          )}
        </>
      )}
    </Box>
  )
}

function MissedTray({ items, all, actions }: { items: SeasonItem[]; all: SeasonItem[]; actions: RowActions }) {
  return (
    <Box bg={colors.surface} style={panelStyle} mb={16} data-tray="missed">
      <TrayHeading title="Missed" count={items.length} hint="Planned, but the day went by — give it a new one." />
      {items.map((item) => (
        <TrayRow
          key={item.id}
          item={item}
          all={all}
          actions={actions}
          tag={{ tone: 'overdue', label: `⚠ was ${dayLabel(item.plannedOn!)}` }}
        />
      ))}
    </Box>
  )
}

function WeekendCard({
  plan,
  season,
  all,
  actions,
  onQuickAddDay,
}: {
  plan: WeekendPlan
  season: Season
  all: SeasonItem[]
  actions: RowActions
  onQuickAddDay: (day: string, title: string) => Promise<boolean>
}) {
  const { weekend } = plan
  const relative = relativeWeekendLabel(weekend, actions.today)
  const count = plan.fri.length + plan.sat.length + plan.sun.length + plan.otherDays.length
  const label = weekendLabel(weekend)
  return (
    <Box
      component="section"
      aria-label={`Weekend of ${label}`}
      data-weekend={weekend.fri}
      bg={colors.surface}
      p={14}
      mb={14}
      style={panelStyle}
    >
      <Group justify="space-between" align="baseline" mb={10} gap={8}>
        <Group gap={10} align="baseline">
          <Text fz={18} c={colors.ink} style={{ fontFamily: fonts.serif }}>
            {label}
          </Text>
          {relative && (
            <Text fz={text.tiny} fw={700} c={colors.muted} tt="uppercase" style={{ letterSpacing: '0.06em' }}>
              {relative}
            </Text>
          )}
        </Group>
        <Text fz={text.caption} c={colors.faint}>
          {count === 0 ? 'Wide open' : count === 1 ? '1 plan' : `${count} plans`}
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={10} verticalSpacing={{ base: 6, sm: 10 }}>
        {(['fri', 'sat', 'sun'] as const).map((key) => (
          <DayColumn
            key={key}
            day={weekend[key]}
            items={plan[key]}
            plannable={isPlannableDay(season, weekend[key], actions.today)}
            past={weekend[key] < actions.today}
            all={all}
            actions={actions}
            onQuickAdd={(title) => onQuickAddDay(weekend[key], title)}
          />
        ))}
      </SimpleGrid>
      {plan.otherDays.length > 0 && (
        <Text fz={text.caption} c={colors.muted} mt={10}>
          <Text component="span" fz={text.caption} fw={600} c={colors.inkSoft}>
            Other days:
          </Text>{' '}
          {plan.otherDays.map((item, i) => (
            <span key={item.id}>
              {i > 0 && ' · '}
              <SchedulePopover
                item={item}
                groups={actions.dayGroups}
                onPlan={(date) => actions.onPlan(item, date)}
                onEdit={() => actions.onEdit(item)}
                ariaLabel={`Plan “${item.title}”`}
                targetStyle={{ display: 'inline', fontSize: text.caption, color: colors.inkSoft }}
              >
                {isFixed(item) ? '📌 ' : ''}
                {dayLabel(item.fixedOn ?? item.plannedOn!)} {item.title}
              </SchedulePopover>
            </span>
          ))}
        </Text>
      )}
    </Box>
  )
}

function DayColumn({
  day,
  items,
  plannable,
  past,
  all,
  actions,
  onQuickAdd,
}: {
  day: string
  items: SeasonItem[]
  plannable: boolean
  past: boolean
  all: SeasonItem[]
  actions: RowActions
  onQuickAdd: (title: string) => Promise<boolean>
}) {
  return (
    // On a phone the three days stack, so each lays out as a row — the day
    // label on the left, its plans beside it — to keep a weekend card short.
    <Flex
      data-day={day}
      direction={{ base: 'row', sm: 'column' }}
      gap={{ base: 10, sm: 0 }}
      bg={colors.cardTint}
      px={10}
      py={{ base: 4, sm: 8 }}
      style={{ borderRadius: radii.chip, opacity: past ? 0.7 : 1 }}
    >
      <Text fz={text.caption} fw={700} c={colors.inkSoft} mb={{ base: 0, sm: 4 }} pt={{ base: 7, sm: 0 }} w={{ base: 64, sm: 'auto' }} style={{ flexShrink: 0 }}>
        {dayLabel(day)}
        {past && (
          <Text component="span" fz={text.tiny} fw={500} c={colors.faint}>
            {' '}
            · past
          </Text>
        )}
        {!past && !plannable && (
          <Text component="span" fz={text.tiny} fw={500} c={colors.faint}>
            {' '}
            · outside the season
          </Text>
        )}
      </Text>
      <Box flex={1} miw={0}>
        {items.map((item) => {
          const done = isDone(item)
          const parent = parentTitle(all, item)
          return (
            <Group key={item.id} gap={7} wrap="nowrap" align="flex-start" py={3}>
              <Checkbox
                checked={done}
                onChange={() => actions.onToggleDone(item)}
                size="xs"
                radius="xl"
                color={ACCENT}
                mt={2}
                aria-label={done ? `Reopen “${item.title}”` : `Mark “${item.title}” done`}
                styles={{ input: { cursor: 'pointer' } }}
              />
              <SchedulePopover
                item={item}
                groups={actions.dayGroups}
                onPlan={(date) => actions.onPlan(item, date)}
                onEdit={() => actions.onEdit(item)}
                ariaLabel={`Plan “${item.title}”`}
                targetStyle={{ flex: 1 }}
              >
                <Text
                  fz={text.small}
                  lh={1.35}
                  c={done ? colors.faint : colors.ink}
                  style={{ textDecoration: done ? 'line-through' : 'none', overflowWrap: 'anywhere' }}
                >
                  {isFixed(item) && <span aria-label="Fixed date">📌 </span>}
                  {item.title}
                  {parent && (
                    <Text component="span" fz={text.tiny} c={colors.faint}>
                      {' '}
                      · {parent}
                    </Text>
                  )}
                </Text>
              </SchedulePopover>
            </Group>
          )
        })}
        {plannable ? (
          <QuickAdd compact placeholder="+ add" ariaLabel={`Add to ${dayLabel(day)}`} onAdd={onQuickAdd} />
        ) : (
          items.length === 0 && (
            <Text fz={text.tiny} c={colors.faint} py={{ base: 7, sm: 4 }}>
              —
            </Text>
          )
        )}
      </Box>
    </Flex>
  )
}
