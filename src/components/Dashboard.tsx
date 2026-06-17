import type { CSSProperties } from 'react'
import type { Category, SortKey, ViewMode } from '../types'
import type { DisplayRow, Stats } from '../data/derive'
import { ACCENT, colors, fonts, swatchFor } from '../theme'
import { formatDate } from '../lib/format'
import { Stars } from './Stars'

interface DashboardProps {
  title: string
  subtitle: string
  stats: Stats
  categories: Category[]
  rows: DisplayRow[]
  filterCategoryId: string
  sort: SortKey
  view: ViewMode
  onFilter: (categoryId: string) => void
  onSort: (sort: SortKey) => void
  onView: (view: ViewMode) => void
  onAdd: () => void
  onManage: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function Dashboard({
  title,
  subtitle,
  stats,
  categories,
  rows,
  filterCategoryId,
  sort,
  view,
  onFilter,
  onSort,
  onView,
  onAdd,
  onManage,
  onEdit,
  onDelete,
}: DashboardProps) {
  const isEmpty = rows.length === 0

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.pageBg,
        fontFamily: fonts.sans,
        color: colors.ink,
        padding: '48px 24px 80px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
            paddingBottom: 22,
            borderBottom: '1px dotted rgba(120,100,80,0.4)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: ACCENT,
                marginBottom: 9,
              }}
            >
              Our city, together
            </div>
            <h1
              style={{
                fontFamily: fonts.serif,
                fontWeight: 500,
                fontSize: 42,
                lineHeight: 1,
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h1>
            <div style={{ fontSize: 14, color: colors.muted, marginTop: 6 }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onManage} style={secondaryButton}>
              Manage
            </button>
            <button onClick={onAdd} style={primaryButton}>
              + New entry
            </button>
          </div>
        </div>

        {/* STATS */}
        <div style={{ display: 'flex', gap: 14, marginTop: 26, flexWrap: 'wrap' }}>
          <StatCard value={stats.total} label="Total entries" bg="oklch(0.96 0.018 78)" />
          <StatCard
            value={stats.thisMonth}
            label="This month"
            bg="oklch(0.95 0.032 150)"
            valueColor="oklch(0.42 0.06 150)"
            labelColor="oklch(0.45 0.05 150)"
          />
          <StatCard
            value={stats.avg}
            label="Avg rating"
            bg="oklch(0.95 0.045 55)"
            valueColor="oklch(0.55 0.12 45)"
            labelColor="oklch(0.55 0.1 45)"
          />
        </div>

        {/* CONTROLS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginTop: 28,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                background: colors.chip,
                border: '1px solid rgba(120,100,80,0.12)',
                borderRadius: 9,
                padding: 3,
              }}
            >
              <ViewButton label="Cards" active={view === 'cards'} onClick={() => onView('cards')} />
              <ViewButton label="Table" active={view === 'table'} onClick={() => onView('table')} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: colors.muted,
                }}
              >
                Sort
              </span>
              <select
                value={sort}
                onChange={(e) => onSort(e.target.value as SortKey)}
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.ink,
                  background: '#fff',
                  border: '1px solid rgba(120,100,80,0.25)',
                  borderRadius: 9,
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                <option value="recent">Most recent</option>
                <option value="rating">Highest rated</option>
                <option value="category">By category</option>
              </select>
            </div>
          </div>
        </div>

        {/* ENTRIES */}
        {isEmpty ? (
          <EmptyState onAdd={onAdd} />
        ) : view === 'cards' ? (
          <CardGrid rows={rows} onEdit={onEdit} onDelete={onDelete} />
        ) : (
          <Table rows={rows} onEdit={onEdit} onDelete={onDelete} />
        )}
      </div>
    </div>
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
    <div style={{ flex: 1, minWidth: 160, background: bg, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontFamily: fonts.serif, fontSize: 34, lineHeight: 1, color: valueColor }}>{value}</div>
      <div
        style={{
          fontSize: 12,
          color: labelColor ?? colors.muted,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: 7,
        }}
      >
        {label}
      </div>
    </div>
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
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 13,
    padding: '8px 16px',
    borderRadius: 30,
    cursor: 'pointer',
  }
  const style: CSSProperties = active
    ? { ...base, fontWeight: 600, background: activeBg, color: '#fff', border: `1px solid ${activeBg}` }
    : {
        ...base,
        fontWeight: 500,
        background: colors.chip,
        color: '#6b665e',
        border: '1px solid rgba(120,100,80,0.12)',
      }
  return (
    <div style={style} onClick={onClick}>
      {dotColor && (
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
      )}
      {label}
    </div>
  )
}

function ViewButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: fonts.sans,
        fontSize: 13,
        fontWeight: 600,
        padding: '6px 14px',
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        background: active ? '#fff' : 'transparent',
        color: active ? colors.ink : colors.muted,
        boxShadow: active ? '0 1px 2px rgba(60,50,40,0.12)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function CardGrid({
  rows,
  onEdit,
  onDelete,
}: {
  rows: DisplayRow[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            background: '#fff',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 14,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.categoryColor }} />
              <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.muted }}>
                {`${row.categoryName} · ${row.activityName}`.toUpperCase()}
              </span>
            </div>
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.faint }}>{formatDate(row.date)}</span>
          </div>
          <div style={{ fontFamily: fonts.serif, fontSize: 22, lineHeight: 1.12, marginBottom: 8 }}>{row.title}</div>
          <div style={{ marginBottom: 10 }}>
            <Stars rating={row.rating} />
          </div>
          <div
            style={{
              fontFamily: fonts.serif,
              fontStyle: 'italic',
              fontSize: 14,
              lineHeight: 1.5,
              color: '#6b665e',
              flex: 1,
            }}
          >
            {row.description}
          </div>
          <RowActions id={row.id} onEdit={onEdit} onDelete={onDelete} bordered />
        </div>
      ))}
    </div>
  )
}

const TABLE_COLUMNS = '2.4fr 1.3fr 1.3fr 0.9fr 1fr 0.9fr'

function Table({
  rows,
  onEdit,
  onDelete,
}: {
  rows: DisplayRow[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      style={{
        marginTop: 20,
        background: '#fff',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: TABLE_COLUMNS,
          gap: 12,
          padding: '13px 20px',
          borderBottom: '1px dotted rgba(120,100,80,0.3)',
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.muted,
        }}
      >
        <span>Title</span>
        <span>Category</span>
        <span>Activity</span>
        <span>Date</span>
        <span>Rating</span>
        <span />
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            display: 'grid',
            gridTemplateColumns: TABLE_COLUMNS,
            gap: 12,
            padding: '14px 20px',
            borderTop: '1px dotted rgba(120,100,80,0.16)',
            alignItems: 'center',
          }}
        >
          <span style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 1.2 }}>{row.title}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#5c574e' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.categoryColor, flexShrink: 0 }} />
            {row.categoryName}
          </span>
          <span style={{ fontSize: 13, color: '#6b665e' }}>{row.activityName}</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.faint }}>{formatDate(row.date)}</span>
          <span style={{ fontSize: 13 }}>
            <Stars rating={row.rating} letterSpacing={1} fontSize={13} />
          </span>
          <RowActions id={row.id} onEdit={onEdit} onDelete={onDelete} align="flex-end" />
        </div>
      ))}
    </div>
  )
}

function RowActions({
  id,
  onEdit,
  onDelete,
  bordered,
  align = 'flex-start',
}: {
  id: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  bordered?: boolean
  align?: CSSProperties['justifyContent']
}) {
  const linkButton: CSSProperties = {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: 600,
    color: colors.muted,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  }
  return (
    <div
      style={{
        display: 'flex',
        gap: bordered ? 14 : 10,
        justifyContent: align,
        ...(bordered
          ? { marginTop: 14, paddingTop: 12, borderTop: '1px dotted rgba(120,100,80,0.3)' }
          : {}),
      }}
    >
      <button style={linkButton} onClick={() => onEdit(id)}>
        Edit
      </button>
      <button style={linkButton} onClick={() => onDelete(id)}>
        Delete
      </button>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        marginTop: 20,
        textAlign: 'center',
        padding: '64px 24px',
        background: '#fff',
        border: '1px dashed rgba(120,100,80,0.28)',
        borderRadius: 16,
      }}
    >
      <div style={{ fontFamily: fonts.serif, fontSize: 24, marginBottom: 8 }}>Nothing here yet</div>
      <div style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
        No entries in this view. Log your next outing together.
      </div>
      <button onClick={onAdd} style={{ ...primaryButton, padding: '11px 20px' }}>
        + New entry
      </button>
    </div>
  )
}

const primaryButton: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 14,
  fontWeight: 600,
  color: '#fff',
  background: ACCENT,
  border: 'none',
  padding: '10px 18px',
  borderRadius: 10,
  cursor: 'pointer',
}

const secondaryButton: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 14,
  fontWeight: 600,
  color: '#5c574e',
  background: 'transparent',
  border: '1px solid rgba(120,100,80,0.3)',
  padding: '10px 16px',
  borderRadius: 10,
  cursor: 'pointer',
}
