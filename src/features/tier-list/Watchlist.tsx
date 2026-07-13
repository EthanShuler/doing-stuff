import { useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ActionIcon, Box, Checkbox, Group, Paper, Text } from '@mantine/core'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TierKind, WatchlistItem } from '../../types'
import { ACCENT, colors, fonts } from '../../theme'
import { formatDate } from '../../lib/format'
import { EmptyCard } from '../../components/EmptyCard'
import { positionBetween } from './derive'
import { KIND_COPY } from './copy'
import type { KindCopy } from './copy'
import { MediaImage } from './TierCard'

interface WatchlistProps {
  /** Already sorted for display (see sortWatchlist): the open queue on top —
   *  position order, top = next up — then the checked-off rows. */
  items: WatchlistItem[]
  kind: TierKind
  /** Date per TIER item id — a checked wish looks its own up via `tierItemId`
   *  (the wish row has no date). For movies/TV that's the shared watched date;
   *  for books the page passes the VIEWER's own read dates, so a book the
   *  partner checked off shows dateless here until you read it too. */
  watchedDates: ReadonlyMap<string, string | null>
  /** Check off an open item — creates the tier item and drops it on the board. */
  onCheck: (item: WatchlistItem) => void
  /** Reopen a checked item (the tier item it made stays on the board). */
  onUncheck: (id: string) => void
  /** Edit an open item's title/poster (opens the modal). */
  onEdit: (item: WatchlistItem) => void
  onDelete: (id: string) => void
  /** A drag settled: move one open item to this queue position. */
  onMove: (id: string, position: number) => void
  /** Float precision ran out — rewrite the open queue at integer positions. */
  onRenormalize: (orderedIds: string[]) => void
}

/** One list row — used directly for checked-off rows and inside the
 *  DragOverlay; SortableRow wraps it with the drag wiring for open rows. */
function WatchRow({
  item,
  copy,
  done,
  watchedOn,
  lifted,
  onCheck,
  onUncheck,
  onEdit,
  onDelete,
}: {
  item: WatchlistItem
  copy: KindCopy
  done: boolean
  watchedOn: string | null
  /** Floating in the DragOverlay: bigger shadow + slight tilt. */
  lifted?: boolean
  onCheck: (item: WatchlistItem) => void
  onUncheck: (id: string) => void
  onEdit: (item: WatchlistItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <Paper
      bg="#fff"
      withBorder
      p="12px 16px"
      style={{
        borderColor: colors.cardBorder,
        borderRadius: 12,
        boxShadow: lifted ? '0 12px 28px rgba(40,30,20,0.28)' : undefined,
        transform: lifted ? 'rotate(1deg)' : undefined,
      }}
    >
      <Group gap={14} align="center" wrap="nowrap">
        <Checkbox
          checked={done}
          onChange={() => (done ? onUncheck(item.id) : onCheck(item))}
          radius="xl"
          size="md"
          color={ACCENT}
          aria-label={done ? `Move back to ${copy.listLabel.toLowerCase()}` : `Mark ${copy.past} — add to board`}
          styles={{ input: { cursor: 'pointer' } }}
        />
        <MediaImage
          imageUrl={item.imageUrl}
          title={item.title}
          emoji={copy.emoji}
          width={38}
          height={54}
          radius={5}
          emojiSize={18}
        />
        <Box flex={1} miw={0}>
          <Text
            onClick={done ? undefined : () => onEdit(item)}
            fz={17}
            c={done ? colors.faint : colors.ink}
            lineClamp={2}
            style={{
              fontFamily: fonts.serif,
              cursor: done ? 'default' : 'text',
              textDecoration: done ? 'line-through' : 'none',
            }}
          >
            {item.title}
          </Text>
          {item.creator && (
            <Text fz={12} c={colors.faint} mt={1} lineClamp={1} style={{ fontFamily: fonts.sans }}>
              {item.creator}
            </Text>
          )}
          {done && (
            <Text fz={12} c={colors.muted} mt={2} style={{ fontFamily: fonts.sans }}>
              {copy.usesDates && watchedOn
                ? `${copy.pastCap} ${formatDate(watchedOn)} — on your tier board, go rank it.`
                : copy.onBoardNote}
            </Text>
          )}
        </Box>
        <ActionIcon
          variant="subtle"
          onClick={() => onDelete(item.id)}
          c={colors.faint}
          aria-label={`Remove from ${copy.listLabel.toLowerCase()}`}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
        </ActionIcon>
      </Group>
    </Paper>
  )
}

/** A draggable open row. Clicks (under the sensors' activation thresholds)
 *  still hit the checkbox / title / delete button as usual. */
function SortableRow(props: Parameters<typeof WatchRow>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The original stays in place as a ghost; the DragOverlay is the visual.
    opacity: isDragging ? 0.35 : 1,
    touchAction: 'manipulation',
    cursor: 'grab',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <WatchRow {...props} />
    </div>
  )
}

/** The "want to watch/read/try" list for one kind — shared, except books,
 *  where each member keeps their own reading list (the page passes only the
 *  viewer's rows). The open rows are a priority queue: drag to reorder, the
 *  top is what you'll watch next. Checking an item off promotes it into the
 *  tier pool (the page owns that action + the add/edit modal). */
export function Watchlist({
  items,
  kind,
  watchedDates,
  onCheck,
  onUncheck,
  onEdit,
  onDelete,
  onMove,
  onRenormalize,
}: WatchlistProps) {
  const copy = KIND_COPY[kind]

  const open = items.filter((w) => w.tierItemId === null)
  const done = items.filter((w) => w.tierItemId !== null)
  const openById = new Map(open.map((w) => [w.id, w]))

  const [activeId, setActiveId] = useState<string | null>(null)
  // While dragging, render the queue in an order frozen at drag start, so a
  // realtime update landing in the store can't yank rows around under the
  // cursor (mirrors the board's frozen drag copy). null = not dragging.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const rows = dragOrder
    ? dragOrder.map((id) => openById.get(id)).filter((w): w is WatchlistItem => w !== undefined)
    : open

  const sensors = useSensors(
    // 4px of travel before a drag starts, so plain clicks still work.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Long-press on touch, so the page still scrolls normally.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const finishDrag = () => {
    setActiveId(null)
    setDragOrder(null)
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    setDragOrder(open.map((w) => w.id))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    const id = String(active.id)
    const ids = rows.map((w) => w.id)
    const oldIndex = ids.indexOf(id)
    const newIndex = over ? ids.indexOf(String(over.id)) : -1
    // No target, unknown ids, or dropped back where it started → no write.
    if (!over || oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      finishDrag()
      return
    }
    const nextIds = arrayMove(ids, oldIndex, newIndex)
    // Midpoint between the settled neighbors' stored positions, falling back
    // to a full renormalize when float precision runs out — same scheme as
    // tier placements.
    const positionOf = (rowId: string) => openById.get(rowId)?.position ?? null
    const before = newIndex > 0 ? positionOf(nextIds[newIndex - 1]) : null
    const after = newIndex < nextIds.length - 1 ? positionOf(nextIds[newIndex + 1]) : null
    const position = positionBetween(before, after)
    if (position === null) onRenormalize(nextIds)
    else onMove(id, position)
    finishDrag()
  }

  if (items.length === 0) {
    return <EmptyCard mt={24} title={copy.listEmptyTitle} blurb={copy.listEmptyBlurb} />
  }

  const activeItem = activeId ? openById.get(activeId) : undefined
  const rowProps = (item: WatchlistItem, isDone: boolean) => ({
    item,
    copy,
    done: isDone,
    watchedOn: item.tierItemId ? watchedDates.get(item.tierItemId) ?? null : null,
    onCheck,
    onUncheck,
    onEdit,
    onDelete,
  })

  return (
    <>
      {open.length > 1 && (
        <Text fz={13} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
          Drag to reorder — the top of the list is what you'll {copy.verb} next.
        </Text>
      )}
      <Box mt={open.length > 1 ? 10 : 24} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={finishDrag}
        >
          <SortableContext items={rows.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            {rows.map((item) => (
              <SortableRow key={item.id} {...rowProps(item, false)} />
            ))}
          </SortableContext>
          {createPortal(
            <DragOverlay>{activeItem ? <WatchRow {...rowProps(activeItem, false)} lifted /> : null}</DragOverlay>,
            document.body,
          )}
        </DndContext>
        {done.map((item) => (
          <WatchRow key={item.id} {...rowProps(item, true)} />
        ))}
      </Box>
    </>
  )
}
