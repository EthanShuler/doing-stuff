import { useState } from 'react'
import { Box, Button, Group, Text, Title, UnstyledButton } from '@mantine/core'
import type { Category, Screen } from '../types'
import type { CalendarDay, CalendarMark } from '../data/derive'
import type { YearMonth } from '../lib/format'
import { ACCENT, colors, fonts, swatchFor } from '../theme'
import { monthLabel, shiftMonth } from '../lib/format'
import { HeaderActions } from './HeaderActions'

interface CalendarViewProps {
  title: string
  categories: Category[]
  filterCategoryId: string
  onFilter: (categoryId: string) => void
  /** The 6×7 (or 5×7) grid for `month`, prebuilt in App via calendarDays(). */
  days: CalendarDay[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  /** Jump back to the month containing today. */
  onToday: () => void
  screen: Screen
  onScreenChange: (screen: Screen) => void
  onManage: () => void
  /** Open the new-entry modal; an ISO date prefills it (used by empty days). */
  onNewEntry: (date?: string) => void
  /** Open the entry modal for the entry behind a chip. */
  onEditEntry: (id: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// How many chips a day shows before collapsing the rest behind "+N more".
const CHIP_CAP = 3

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
}

export function CalendarView({
  title,
  categories,
  filterCategoryId,
  onFilter,
  days,
  month,
  onMonthChange,
  onToday,
  screen,
  onScreenChange,
  onManage,
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
    <Box mih="100vh" bg={colors.pageBg} c={colors.ink} pt={48} pb={80} px={24} style={{ fontFamily: fonts.sans }}>
      <Box maw={960} mx="auto">
        {/* HEADER */}
        <Group
          justify="space-between"
          align="flex-end"
          gap={24}
          wrap="wrap"
          pb={22}
          style={{ borderBottom: '1px dotted rgba(120,100,80,0.4)' }}
        >
          <Box>
            <Text c="clay.6" mb={9} style={eyebrowStyle}>
              When we did it
            </Text>
            <Title order={1} fz={42} lh={1} style={{ letterSpacing: '-0.01em' }}>
              {title}
            </Title>
          </Box>
          <HeaderActions screen={screen} onScreenChange={onScreenChange} onManage={onManage} onAdd={() => onNewEntry()} />
        </Group>

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
            <Button
              variant="default"
              onClick={onToday}
              radius={9}
              ml={6}
              styles={{ root: { background: 'transparent', border: '1px solid rgba(120,100,80,0.3)', color: '#5c574e' } }}
            >
              Today
            </Button>
          </Group>
          <Group gap={8} wrap="wrap">
            <Pill label="All" active={filterCategoryId === 'all'} activeBg="#3a352e" onClick={() => onFilter('all')} />
            {categories.map((category) => {
              const swatch = swatchFor(category.colorIndex)
              const active = filterCategoryId === category.id
              return (
                <Pill
                  key={category.id}
                  label={category.name}
                  active={active}
                  activeBg={swatch.color}
                  dotColor={active ? '#fff' : swatch.color}
                  onClick={() => onFilter(category.id)}
                />
              )
            })}
          </Group>
        </Group>

        {/* GRID */}
        <Box
          mt={20}
          bg="#fff"
          style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}
        >
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
                  borderBottom: '1px dotted rgba(120,100,80,0.3)',
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
        borderTop: topBorder ? '1px dotted rgba(120,100,80,0.18)' : undefined,
        borderLeft: '1px dotted rgba(120,100,80,0.18)',
        background: day.inMonth ? 'transparent' : 'rgba(120,100,80,0.035)',
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
        gap: 5,
        width: '100%',
        padding: '2px 6px',
        borderRadius: 6,
        background: colors.chip,
        border: '1px solid rgba(120,100,80,0.12)',
      }}
    >
      <Box w={6} h={6} style={{ flexShrink: 0, borderRadius: '50%', background: mark.categoryColor }} />
      <Text
        fz={11}
        lh={1.25}
        c="#5c574e"
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
        border: '1px solid rgba(120,100,80,0.3)',
        background: 'transparent',
        color: '#5c574e',
        fontSize: 20,
        lineHeight: 1,
      }}
    >
      {children}
    </UnstyledButton>
  )
}

function Pill({
  label,
  active,
  activeBg,
  dotColor,
  onClick,
}: {
  label: string
  active: boolean
  activeBg: string
  dotColor?: string
  onClick: () => void
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: fonts.sans,
        fontSize: 13,
        padding: '8px 16px',
        borderRadius: 30,
        fontWeight: active ? 600 : 500,
        background: active ? activeBg : colors.chip,
        color: active ? '#fff' : '#6b665e',
        border: active ? `1px solid ${activeBg}` : '1px solid rgba(120,100,80,0.12)',
      }}
    >
      {dotColor && <Box w={7} h={7} style={{ borderRadius: '50%', background: dotColor }} />}
      {label}
    </UnstyledButton>
  )
}
