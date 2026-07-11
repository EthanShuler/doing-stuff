import { useState } from 'react'
import { Box, Button, Group, Text, UnstyledButton } from '@mantine/core'
import type { Category } from '../../types'
import type { CalendarDay, CalendarMark } from './derive'
import type { YearMonth } from '../../lib/format'
import { ACCENT, colors, fonts, warmBorder } from '../../theme'
import { monthLabel, shiftMonth } from '../../lib/format'
import { CategoryPills } from '../../components/CategoryPills'

interface CalendarViewProps {
  categories: Category[]
  filterCategoryId: string
  onFilter: (categoryId: string) => void
  /** The 6×7 (or 5×7) grid for `month`, prebuilt in App via calendarDays(). */
  days: CalendarDay[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  /** Jump back to the month containing today. */
  onToday: () => void
  /** Open the new-entry modal; an ISO date prefills it (used by empty days). */
  onNewEntry: (date?: string) => void
  /** Open the entry modal for the entry behind a chip. */
  onEditEntry: (id: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// How many chips a day shows before collapsing the rest behind "+N more".
const CHIP_CAP = 3

export function CalendarView({
  categories,
  filterCategoryId,
  onFilter,
  days,
  month,
  onMonthChange,
  onToday,
  onNewEntry,
  onEditEntry,
}: CalendarViewProps) {
  // Days whose "+N more" has been expanded to reveal all chips.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpand = (date: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  return (
    <>
      {/* MONTH NAV + CATEGORY FILTER */}
      <Group justify="space-between" align="center" gap={16} mt={28} wrap="wrap">
        <Group gap={10} align="center">
          <NavArrow label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}>
            ‹
          </NavArrow>
          <Text fz={20} miw={170} ta="center" style={{ fontFamily: fonts.serif }}>
            {monthLabel(month)}
          </Text>
          <NavArrow label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))}>
            ›
          </NavArrow>
          <Button variant="secondary" onClick={onToday} radius={9} ml={6}>
            Today
          </Button>
          {expanded.size > 0 && (
            <Button variant="secondary" onClick={() => setExpanded(new Set())} radius={9}>
              Reset view
            </Button>
          )}
        </Group>
        <CategoryPills categories={categories} value={filterCategoryId} onChange={onFilter} />
      </Group>

      {/* GRID */}
      <Box
        mt={20}
        bg="#fff"
        style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}
      >
        {/* Seven day columns need real width; scroll sideways on phones
            rather than crushing the cells. */}
        <Box style={{ overflowX: 'auto' }}>
          <Box miw={560}>
            {/* Weekday header */}
            <Box display="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {WEEKDAYS.map((label) => (
                <Box
                  key={label}
                  py={10}
                  ta="center"
                  c={colors.muted}
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    borderBottom: `1px dotted ${colors.dotted}`,
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
            {/* Day cells */}
            <Box display="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {days.map((day, i) => (
                <DayCell
                  key={day.date}
                  day={day}
                  expanded={expanded.has(day.date)}
                  onExpand={() => toggleExpand(day.date)}
                  onAdd={() => onNewEntry(day.date)}
                  onEditEntry={onEditEntry}
                  // Top-row cells need no top border (the weekday header draws it).
                  topBorder={i >= 7}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  )
}

function DayCell({
  day,
  expanded,
  onExpand,
  onAdd,
  onEditEntry,
  topBorder,
}: {
  day: CalendarDay
  expanded: boolean
  onExpand: () => void
  onAdd: () => void
  onEditEntry: (id: string) => void
  topBorder: boolean
}) {
  const { marks } = day
  const overflowing = marks.length > CHIP_CAP
  // When capped, show one fewer chip to leave room for the "+N more" button.
  const visible = expanded || !overflowing ? marks : marks.slice(0, CHIP_CAP - 1)
  const hiddenCount = marks.length - visible.length

  const clickableEmpty = day.inMonth && marks.length === 0

  return (
    <Box
      onClick={clickableEmpty ? onAdd : undefined}
      p={6}
      style={{
        minHeight: 96,
        borderTop: topBorder ? `1px dotted ${warmBorder(0.18)}` : undefined,
        borderLeft: `1px dotted ${warmBorder(0.18)}`,
        background: day.inMonth ? 'transparent' : warmBorder(0.035),
        cursor: clickableEmpty ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* Date number — today gets an accent disc. */}
      <Group justify="flex-start" gap={0}>
        <Box
          w={22}
          h={22}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            fontFamily: fonts.mono,
            fontSize: 11,
            fontWeight: day.isToday ? 700 : 500,
            background: day.isToday ? ACCENT : 'transparent',
            color: day.isToday ? '#fff' : day.inMonth ? colors.muted : colors.faint,
          }}
        >
          {day.dayOfMonth}
        </Box>
      </Group>

      {visible.map((mark) => (
        <Chip key={mark.key} mark={mark} onClick={() => onEditEntry(mark.entryId)} />
      ))}

      {hiddenCount > 0 && (
        <UnstyledButton
          onClick={(event) => {
            event.stopPropagation()
            onExpand()
          }}
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            letterSpacing: '0.04em',
            color: colors.faint,
            padding: '1px 4px',
            textAlign: 'left',
          }}
        >
          {expanded ? '− less' : `+${hiddenCount} more`}
        </UnstyledButton>
      )}
    </Box>
  )
}

function Chip({ mark, onClick }: { mark: CalendarMark; onClick: () => void }) {
  return (
    <UnstyledButton
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      title={mark.title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: '100%',
        padding: '2px 6px',
        borderRadius: 6,
        background: mark.categoryTint,
        borderLeft: `3px solid ${mark.categoryColor}`,
      }}
    >
      {mark.emoji && (
        <Box component="span" style={{ flexShrink: 0, fontSize: 11, lineHeight: 1 }}>
          {mark.emoji}
        </Box>
      )}
      <Text
        fz={11}
        lh={1.25}
        c={mark.categoryInk}
        fw={500}
        style={{ fontFamily: fonts.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {mark.title}
      </Text>
    </UnstyledButton>
  )
}

function NavArrow({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <UnstyledButton
      onClick={onClick}
      aria-label={label}
      style={{
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9,
        border: `1px solid ${colors.dotted}`,
        background: 'transparent',
        color: colors.inkSoft,
        fontSize: 20,
        lineHeight: 1,
      }}
    >
      {children}
    </UnstyledButton>
  )
}
