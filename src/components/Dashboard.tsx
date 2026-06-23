import {
  Anchor,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import type { Category, Screen, SortKey, ViewMode } from '../types'
import type { DisplayRow, Stats } from '../data/derive'
import { ACCENT, colors, fonts, swatchFor } from '../theme'
import { formatDate } from '../lib/format'
import { Stars } from './Stars'
import { HeaderActions } from './HeaderActions'

interface DashboardProps {
  title: string
  subtitle: string
  stats: Stats
  categories: Category[]
  rows: DisplayRow[]
  screen: Screen
  onScreenChange: (screen: Screen) => void
  filterCategoryId: string
  search: string
  sort: SortKey
  view: ViewMode
  onFilter: (categoryId: string) => void
  onSearch: (search: string) => void
  onSort: (sort: SortKey) => void
  onView: (view: ViewMode) => void
  onAdd: () => void
  onManage: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRepeat: (id: string) => void
}

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
}

const monoLabelStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
}

export function Dashboard({
  title,
  subtitle,
  stats,
  categories,
  rows,
  screen,
  onScreenChange,
  filterCategoryId,
  search,
  sort,
  view,
  onFilter,
  onSearch,
  onSort,
  onView,
  onAdd,
  onManage,
  onEdit,
  onDelete,
  onRepeat,
}: DashboardProps) {
  const isEmpty = rows.length === 0

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
            </Text>
            <Title order={1} fz={42} lh={1} style={{ letterSpacing: '-0.01em' }}>
              {title}
            </Title>
            <Text fz={14} c={colors.muted} mt={6}>
              {subtitle}
            </Text>
          </Box>
          <HeaderActions screen={screen} onScreenChange={onScreenChange} onManage={onManage} onAdd={onAdd} />
        </Group>

        {/* STATS */}
        <Group gap={14} mt={26} wrap="wrap" align="stretch">
          <StatCard value={stats.total} label="Total entries" bg="oklch(0.96 0.018 78)" />
          <StatCard
            value={stats.thisMonth}
            label="This month"
            bg="oklch(0.95 0.032 150)"
            valueColor="oklch(0.42 0.06 150)"
            labelColor="oklch(0.45 0.05 150)"
          />
        </Group>

        {/* CONTROLS */}
        <Group justify="space-between" align="center" gap={16} mt={28} wrap="wrap">
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
          <Group align="center" gap={14} wrap="wrap">
            <TextInput
              value={search}
              onChange={(event) => onSearch(event.currentTarget.value)}
              placeholder="Search titles…"
              aria-label="Search entries by title"
              rightSection={
                search ? (
                  <UnstyledButton
                    onClick={() => onSearch('')}
                    aria-label="Clear search"
                    style={{ color: colors.faint, fontSize: 14, lineHeight: 1 }}
                  >
                    ✕
                  </UnstyledButton>
                ) : null
              }
              w={200}
              styles={{ input: { fontFamily: fonts.sans } }}
            />
            <SegmentedControl
              value={view}
              onChange={(value) => onView(value as ViewMode)}
              data={[
                { label: 'Cards', value: 'cards' },
                { label: 'Table', value: 'table' },
              ]}
              radius={9}
              styles={{
                root: { background: colors.chip, border: '1px solid rgba(120,100,80,0.12)', padding: 3 },
                label: { fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: colors.muted },
              }}
            />
            <Group align="center" gap={9}>
              <Text c={colors.muted} style={monoLabelStyle}>
                Sort
              </Text>
              <Select
                value={sort}
                onChange={(value) => value && onSort(value as SortKey)}
                allowDeselect={false}
                data={[
                  { value: 'recent', label: 'Most recent' },
                  { value: 'rating', label: 'Highest rated' },
                  { value: 'category', label: 'By category' },
                ]}
                w={160}
                styles={{ input: { fontWeight: 600 } }}
              />
            </Group>
          </Group>
        </Group>

        {/* ENTRIES */}
        {isEmpty ? (
          <EmptyState onAdd={onAdd} />
        ) : view === 'cards' ? (
          <CardGrid rows={rows} onEdit={onEdit} onDelete={onDelete} onRepeat={onRepeat} />
        ) : (
          <Table rows={rows} onEdit={onEdit} onDelete={onDelete} onRepeat={onRepeat} />
        )}
      </Box>
    </Box>
  )
}

function StatCard({
  value,
  label,
  bg,
  valueColor,
  labelColor,
}: {
  value: number | string
  label: string
  bg: string
  valueColor?: string
  labelColor?: string
}) {
  return (
    <Box flex={1} miw={160} bg={bg} p="18px 20px" style={{ borderRadius: 14 }}>
      <Text fz={34} lh={1} c={valueColor} style={{ fontFamily: fonts.serif }}>
        {value}
      </Text>
      <Text fz={12} fw={600} mt={7} c={labelColor ?? colors.muted} tt="uppercase" style={{ letterSpacing: '0.05em' }}>
        {label}
      </Text>
    </Box>
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

function CardGrid({
  rows,
  onEdit,
  onDelete,
  onRepeat,
}: {
  rows: DisplayRow[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRepeat: (id: string) => void
}) {
  return (
    <SimpleGrid cols={2} spacing={14} mt={20}>
      {rows.map((row) => (
        <Paper
          key={row.id}
          bg="#fff"
          withBorder
          p="18px 20px"
          style={{ borderColor: colors.cardBorder, borderRadius: 14, display: 'flex', flexDirection: 'column' }}
        >
          <Group justify="space-between" align="center" mb={11}>
            <Group gap={7} align="center">
              <Box w={8} h={8} style={{ borderRadius: '50%', background: row.categoryColor }} />
              <Text c={colors.muted} style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em' }}>
                {[row.categoryName, row.activityName, row.createdBy && `by ${row.createdBy}`]
                  .filter(Boolean)
                  .join(' · ')
                  .toUpperCase()}
              </Text>
            </Group>
            <Text c={colors.faint} style={{ fontFamily: fonts.mono, fontSize: 11 }}>
              {formatDate(row.date)}
            </Text>
          </Group>
          <Text fz={22} lh={1.12} mb={8} style={{ fontFamily: fonts.serif }}>
            {row.title}
          </Text>
          <Group mb={10} gap={10} align="center">
            <Stars rating={row.rating} />
            {row.totalCount > 1 && <RepeatBadge count={row.totalCount} since={row.firstDate} />}
          </Group>
          <Text fz={14} lh={1.5} c="#6b665e" flex={1} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
            {row.description}
          </Text>
          <RowActions id={row.id} onEdit={onEdit} onDelete={onDelete} onRepeat={onRepeat} bordered />
        </Paper>
      ))}
    </SimpleGrid>
  )
}

const TABLE_COLUMNS = '2.2fr 1.2fr 1.1fr 0.9fr 0.9fr 0.8fr 0.8fr'

function Table({
  rows,
  onEdit,
  onDelete,
  onRepeat,
}: {
  rows: DisplayRow[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRepeat: (id: string) => void
}) {
  return (
    <Paper
      mt={20}
      bg="#fff"
      withBorder
      style={{ borderColor: colors.cardBorder, borderRadius: 14, overflow: 'hidden' }}
    >
      <Box
        display="grid"
        px={20}
        py={13}
        c={colors.muted}
        style={{
          gridTemplateColumns: TABLE_COLUMNS,
          gap: 12,
          borderBottom: '1px dotted rgba(120,100,80,0.3)',
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <span>Title</span>
        <span>Category</span>
        <span>Activity</span>
        <span>Date</span>
        <span>Rating</span>
        <span>By</span>
        <span />
      </Box>
      {rows.map((row) => (
        <Box
          key={row.id}
          display="grid"
          px={20}
          py={14}
          style={{
            gridTemplateColumns: TABLE_COLUMNS,
            gap: 12,
            borderTop: '1px dotted rgba(120,100,80,0.16)',
            alignItems: 'center',
          }}
        >
          <Group gap={8} align="center">
            <Text fz={17} lh={1.2} style={{ fontFamily: fonts.serif }}>
              {row.title}
            </Text>
            {row.totalCount > 1 && (
              <Text c={colors.muted} style={{ fontFamily: fonts.mono, fontSize: 11, flexShrink: 0 }}>
                {row.totalCount}×
              </Text>
            )}
          </Group>
          <Group component="span" gap={7} align="center" fz={13} c="#5c574e">
            <Box component="span" display="block" w={8} h={8} style={{ borderRadius: '50%', background: row.categoryColor, flexShrink: 0 }} />
            {row.categoryName}
          </Group>
          <Text fz={13} c="#6b665e">
            {row.activityName}
          </Text>
          <Text c={colors.faint} style={{ fontFamily: fonts.mono, fontSize: 12 }}>
            {formatDate(row.date)}
          </Text>
          <Box fz={13}>
            <Stars rating={row.rating} fontSize={13} />
          </Box>
          <Text fz={13} c="#6b665e">
            {row.createdBy || '—'}
          </Text>
          <RowActions id={row.id} onEdit={onEdit} onDelete={onDelete} onRepeat={onRepeat} align="flex-end" />
        </Box>
      ))}
    </Paper>
  )
}

function RowActions({
  id,
  onEdit,
  onDelete,
  onRepeat,
  bordered,
  align = 'flex-start',
}: {
  id: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRepeat: (id: string) => void
  bordered?: boolean
  align?: 'flex-start' | 'flex-end'
}) {
  return (
    <Group
      gap={bordered ? 14 : 10}
      justify={align}
      mt={bordered ? 14 : 0}
      pt={bordered ? 12 : 0}
      style={bordered ? { borderTop: '1px dotted rgba(120,100,80,0.3)' } : undefined}
    >
      <Anchor component="button" onClick={() => onRepeat(id)} fz={12} fw={600} c={ACCENT} underline="never">
        + Repeat
      </Anchor>
      <Anchor component="button" onClick={() => onEdit(id)} fz={12} fw={600} c={colors.muted} underline="never">
        Edit
      </Anchor>
      <Anchor component="button" onClick={() => onDelete(id)} fz={12} fw={600} c={colors.muted} underline="never">
        Delete
      </Anchor>
    </Group>
  )
}

/** Small pill on repeated-entry cards: "3× · since Jun 12". */
function RepeatBadge({ count, since }: { count: number; since: string }) {
  return (
    <Box
      px={9}
      py={3}
      style={{
        borderRadius: 30,
        background: colors.chip,
        border: '1px solid rgba(120,100,80,0.14)',
        fontFamily: fonts.mono,
        fontSize: 10,
        letterSpacing: '0.06em',
        color: colors.muted,
        whiteSpace: 'nowrap',
      }}
    >
      {count}× · SINCE {formatDate(since).toUpperCase()}
    </Box>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Box
      mt={20}
      ta="center"
      bg="#fff"
      p="64px 24px"
      style={{ border: '1px dashed rgba(120,100,80,0.28)', borderRadius: 16 }}
    >
      <Text fz={24} mb={8} style={{ fontFamily: fonts.serif }}>
        Nothing here yet
      </Text>
      <Text fz={14} c={colors.muted} mb={20}>
        No entries in this view. Log your next outing together.
      </Text>
      <Button onClick={onAdd} radius={10} px={20} py={11} style={{ background: ACCENT }}>
        + New entry
      </Button>
    </Box>
  )
}
