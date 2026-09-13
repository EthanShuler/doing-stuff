import { useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ActionIcon, Box, Checkbox, Group, Text, UnstyledButton } from '@mantine/core'
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
import type { ListItem } from '../../types'
import { ACCENT, colors, fonts, radii, shadows, text, warmBorder } from '../../theme'
import { EmptyCard } from '../../components/EmptyCard'
import { MediaImage } from '../../components/MediaImage'
import { TitleSearchInput } from '../../components/TitleSearchInput'
import { positionBetween } from '../../lib/order'
import { isDone } from './derive'
import type { ListCopy } from './copy'

/** Row height. Dense on purpose: the point of this page is seeing a whole
 *  list at once, not one poster at a time. */
const ROW_HEIGHT = 38

/** Where a row's title starts, so a caption under it can line up: the row's
 *  own padding + the drag handle + the checkbox (+ the thumbnail), each with
 *  the Group's 8px gap after it. */
const titleIndent = (hasImage: boolean) => (hasImage ? 87 : 57)

interface ListRowsProps {
  /** Already sorted for display (see sortListItems): the open queue on top —
   *  position order, top = next up — then the done rows. */
  items: ListItem[]
  /** The list's wording (LIST_COPY for a built-in, customListCopy otherwise). */
  copy: ListCopy
  /** Add a row from the quick-add field. Resolves false when the write failed,
   *  so the typed text can go back into the input. */
  onAdd: (title: string, imageUrl: string, creator: string) => Promise<boolean>
  /** Check off an open row. */
  onCheck: (item: ListItem) => void
  /** Reopen a done row. */
  onUncheck: (item: ListItem) => void
  /** Edit an open row's title/image/creator (opens the modal). */
  onEdit: (item: ListItem) => void
  onDelete: (item: ListItem) => void
  /** A drag settled: move one open row to this queue position. */
  onMove: (id: string, position: number) => void
  /** Float precision ran out — rewrite the open queue at integer positions. */
  onRenormalize: (orderedIds: string[]) => void
}

/** One list row. Used directly for done rows and inside the DragOverlay;
 *  SortableRow wraps it with the drag wiring for open rows. */
function Row({
  item,
  copy,
  done,
  lifted,
  onCheck,
  onUncheck,
  onEdit,
  onDelete,
}: {
  item: ListItem
  copy: ListCopy
  done: boolean
  /** Floating in the DragOverlay: a panel-ish card with a shadow. */
  lifted?: boolean
  onCheck: (item: ListItem) => void
  onUncheck: (item: ListItem) => void
  onEdit: (item: ListItem) => void
  onDelete: (item: ListItem) => void
}) {
  return (
    <Group
      gap={8}
      align="center"
      wrap="nowrap"
      h={ROW_HEIGHT}
      px={10}
      bg={colors.surface}
      style={
        lifted
          ? { borderRadius: radii.chip, boxShadow: shadows.lifted, border: `1px solid ${colors.cardBorder}` }
          : undefined
      }
    >
      {/* Fixed width so done rows (which have no handle) still line up. */}
      <Text w={11} ta="center" fz={text.caption} c={colors.faint} style={{ userSelect: 'none', letterSpacing: '-0.1em' }}>
        {done ? '' : '⋮⋮'}
      </Text>
      <Checkbox
        checked={done}
        onChange={() => (done ? onUncheck(item) : onCheck(item))}
        size="sm"
        radius="xl"
        color={ACCENT}
        aria-label={
          done
            ? `Move back to ${copy.label}`
            : copy.linksToBoard
              ? `Mark ${copy.past} — add to board`
              : `Mark ${copy.past}`
        }
        styles={{ input: { cursor: 'pointer' } }}
      />
      {copy.hasImage && (
        <MediaImage imageUrl={item.imageUrl} title={item.title} emoji={copy.emoji} width={22} height={32} radius={3} emojiSize={12} />
      )}
      <Text
        onClick={done ? undefined : () => onEdit(item)}
        fz={text.body}
        c={done ? colors.faint : colors.ink}
        lineClamp={1}
        flex={1}
        style={{ cursor: done ? 'default' : 'text', textDecoration: done ? 'line-through' : 'none' }}
      >
        {item.title}
        {item.creator && (
          <Text component="span" fz={text.caption} c={colors.faint}>
            {' '}
            · {item.creator}
          </Text>
        )}
      </Text>
      <ActionIcon
        variant="subtle"
        size="sm"
        onClick={() => onDelete(item)}
        c={colors.faint}
        aria-label={`Remove from ${copy.label}`}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
      </ActionIcon>
    </Group>
  )
}

/** A draggable open row. The whole row is the handle; clicks under the
 *  sensors' activation thresholds still hit the checkbox, title and ×. */
function SortableRow(props: Parameters<typeof Row>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id })
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
      <Row {...props} />
    </div>
  )
}

/**
 * One list, dense: a quick-add field over a single panel of ~38px rows. Open
 * rows are a priority queue — drag to reorder, the top is what you'll do next
 * — and checked-off rows collapse into a "Done · n" section at the bottom so
 * a long history never pushes the live list off screen.
 */
export function ListRows({
  items,
  copy,
  onAdd,
  onCheck,
  onUncheck,
  onEdit,
  onDelete,
  onMove,
  onRenormalize,
}: ListRowsProps) {
  const [addText, setAddText] = useState('')
  const [doneOpen, setDoneOpen] = useState(false)

  const open = items.filter((w) => !isDone(w))
  const done = items.filter(isDone)
  const openById = new Map(open.map((w) => [w.id, w]))

  const [activeId, setActiveId] = useState<string | null>(null)
  // While dragging, render the queue in an order frozen at drag start, so a
  // realtime update landing in the store can't yank rows around under the
  // cursor (mirrors the tier board's frozen drag copy). null = not dragging.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const rows = dragOrder
    ? dragOrder.map((id) => openById.get(id)).filter((w): w is ListItem => w !== undefined)
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
    // to a full renormalize when float precision runs out — the same scheme
    // as tier placements (see src/lib/order.ts).
    const positionOf = (rowId: string) => openById.get(rowId)?.position ?? null
    const before = newIndex > 0 ? positionOf(nextIds[newIndex - 1]) : null
    const after = newIndex < nextIds.length - 1 ? positionOf(nextIds[newIndex + 1]) : null
    const position = positionBetween(before, after)
    if (position === null) onRenormalize(nextIds)
    else onMove(id, position)
    finishDrag()
  }

  // Adding clears the field right away (so Enter-Enter can't double-add) but
  // puts the text back if the write failed — no retyping from memory. Focus
  // stays where it is, so several rows can go in one after another.
  const submitAdd = async (title: string, imageUrl = '', creator = '') => {
    const trimmed = title.trim()
    if (!trimmed) return
    setAddText('')
    const ok = await onAdd(trimmed, imageUrl, creator)
    if (!ok) setAddText((current) => current || trimmed)
  }

  const activeItem = activeId ? openById.get(activeId) : undefined
  const rowProps = (item: ListItem, isRowDone: boolean) => ({
    item,
    copy,
    done: isRowDone,
    onCheck,
    onUncheck,
    onEdit,
    onDelete,
  })

  const separator = { borderTop: `1px solid ${colors.borderFaint}` }

  return (
    <>
      {/* Quick add. With no provider (a free-form list) TitleSearchInput is
          exactly a plain TextInput — see its docs. */}
      <Box mt={18} mb={14}>
        <TitleSearchInput
          searchKind={copy.searchKind}
          value={addText}
          onChange={setAddText}
          onPick={(result) => {
            void submitAdd(result.title, copy.hasImage ? result.imageUrl : '', result.creator)
          }}
          onSubmit={() => {
            void submitAdd(addText)
          }}
          placeholder={copy.addPlaceholder}
          emoji={copy.emoji}
        />
      </Box>

      {items.length === 0 ? (
        <EmptyCard mt={0} title={copy.emptyTitle} blurb={copy.emptyBlurb} />
      ) : (
        <Box
          bg={colors.surface}
          style={{ border: `1px solid ${warmBorder(0.13)}`, borderRadius: radii.panel, overflow: 'hidden' }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={finishDrag}
          >
            <SortableContext items={rows.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              {rows.map((item, i) => (
                <Box key={item.id} style={i === 0 ? undefined : separator}>
                  <SortableRow {...rowProps(item, false)} />
                </Box>
              ))}
            </SortableContext>
            {createPortal(
              <DragOverlay>{activeItem ? <Row {...rowProps(activeItem, false)} lifted /> : null}</DragOverlay>,
              document.body,
            )}
          </DndContext>

          {done.length > 0 && (
            <>
              <UnstyledButton
                onClick={() => setDoneOpen((v) => !v)}
                w="100%"
                px={10}
                py={8}
                style={{
                  ...(rows.length > 0 ? separator : {}),
                  fontFamily: fonts.sans,
                  fontSize: text.caption,
                  color: colors.muted,
                  textAlign: 'left',
                }}
              >
                {doneOpen ? '▾' : '▸'} Done · {done.length}
              </UnstyledButton>
              {doneOpen &&
                done.map((item) => (
                  <Box key={item.id} style={separator}>
                    <Row {...rowProps(item, true)} />
                    {copy.linksToBoard && copy.onBoardNote && (
                      <Text fz={text.tiny} c={colors.faint} pb={6} pl={titleIndent(copy.hasImage)} style={{ fontFamily: fonts.sans }}>
                        {copy.onBoardNote}
                      </Text>
                    )}
                  </Box>
                ))}
            </>
          )}
        </Box>
      )}
    </>
  )
}
