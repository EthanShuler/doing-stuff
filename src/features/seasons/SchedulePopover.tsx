import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Box, Button, Group, Popover, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import type { SeasonItem } from '../../types'
import { ACCENT, colors, fonts, radii, shadows, text } from '../../theme'
import { dayLabel, isFixed, weekendLabel } from './derive'
import type { WeekendDayGroup } from './derive'

/**
 * Tap-to-schedule: the trigger (an item row, a tag chip) opens a small
 * popover with a chip for every remaining weekend day, plus Unplan and
 * Edit…. One tap on a chip plans the item there and closes. A fixed-date item
 * can't be re-planned — its popover says so and offers only Edit….
 *
 * No drag-and-drop on purpose: taps work the same on a phone and a laptop.
 */
export function SchedulePopover({
  item,
  groups,
  onPlan,
  onEdit,
  ariaLabel,
  targetStyle,
  children,
}: {
  item: SeasonItem
  /** The season's plannable days, per weekend (weekendDayGroups). */
  groups: WeekendDayGroup[]
  onPlan: (date: string | null) => void
  onEdit: () => void
  /** The trigger button's accessible name. */
  ariaLabel: string
  targetStyle?: CSSProperties
  /** The trigger's visible content. */
  children: ReactNode
}) {
  const [opened, setOpened] = useState(false)
  const fixed = isFixed(item)

  const plan = (date: string | null) => {
    setOpened(false)
    onPlan(date)
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={300}
      trapFocus
      returnFocus
      styles={{
        dropdown: {
          background: colors.surface,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: radii.panel,
          boxShadow: shadows.popover,
          padding: 14,
          fontFamily: fonts.sans,
        },
      }}
    >
      <Popover.Target>
        <UnstyledButton
          onClick={() => setOpened((o) => !o)}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          style={{ textAlign: 'left', minWidth: 0, ...targetStyle }}
        >
          {children}
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown>
        <Text fz={text.lead} c={colors.ink} lh={1.25} mb={4} style={{ fontFamily: fonts.serif }}>
          {item.title}
        </Text>
        {fixed ? (
          <Text fz={text.caption} c={colors.muted} mb={10}>
            📌 Fixed on {dayLabel(item.fixedOn!)} — an event with a set day, so it can’t be moved here. Change the
            date in Edit….
          </Text>
        ) : (
          <>
            <Text fz={text.caption} c={colors.muted} mb={10}>
              {item.byOn
                ? `Do it by ${dayLabel(item.byOn)} — days after that are dashed.`
                : 'Pick a weekend day.'}
            </Text>
            {groups.length === 0 ? (
              <Text fz={text.caption} c={colors.faint} mb={10} style={{ fontStyle: 'italic' }}>
                No weekend days left this season.
              </Text>
            ) : (
              <ScrollArea.Autosize mah={250} type="auto" offsetScrollbars mb={10}>
                {groups.map((group) => (
                  <Box key={group.weekend.fri} mb={8}>
                    <Text fz={text.tiny} c={colors.faint} mb={4}>
                      {weekendLabel(group.weekend)}
                    </Text>
                    <Group gap={6} wrap="wrap">
                      {group.days.map((day) => (
                        <DayChip
                          key={day}
                          day={day}
                          selected={item.plannedOn === day}
                          late={item.byOn !== null && day > item.byOn}
                          onClick={() => plan(day)}
                        />
                      ))}
                    </Group>
                  </Box>
                ))}
              </ScrollArea.Autosize>
            )}
          </>
        )}
        <Group justify="space-between" gap={8}>
          {!fixed && item.plannedOn ? (
            <Button variant="secondary" size="compact-sm" onClick={() => plan(null)}>
              Unplan
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="subtle"
            size="compact-sm"
            c={colors.inkSoft}
            onClick={() => {
              setOpened(false)
              onEdit()
            }}
          >
            Edit…
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  )
}

/** One "Sat 10/3" chip. Selected = filled with a ✓; after the deadline =
 *  dashed — shape and text cues, never color alone. */
function DayChip({
  day,
  selected,
  late,
  onClick,
}: {
  day: string
  selected: boolean
  late: boolean
  onClick: () => void
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      aria-pressed={selected}
      title={late ? 'After the deadline' : undefined}
      style={{
        fontFamily: fonts.sans,
        fontSize: text.caption,
        fontWeight: selected ? 700 : 500,
        padding: '4px 10px',
        borderRadius: 20,
        background: selected ? ACCENT : colors.chip,
        color: selected ? colors.onAccent : colors.inkSoft,
        border: selected
          ? `1px solid ${ACCENT}`
          : late
            ? `1px dashed ${colors.dashedBorder}`
            : `1px solid ${colors.borderFaint}`,
      }}
    >
      {selected ? `✓ ${dayLabel(day)}` : dayLabel(day)}
    </UnstyledButton>
  )
}
