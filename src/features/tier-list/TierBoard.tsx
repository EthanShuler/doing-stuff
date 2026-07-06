import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Tier, TierItem } from '../../types'
import type { Board, ContainerId } from './derive'
import { containerItems, findContainer, moveItem, positionBetween } from './derive'
import { BoardView, ROW_AREA_STYLE } from './BoardView'
import type { RowAreaProps } from './BoardView'
import { CardVisual, SortableCard } from './TierCard'

/** A tier row's (or the shelf's) card area as a drop target: droppable under
 *  the container's own id — so empty rows still catch drops — plus a sortable
 *  context for the cards it holds. rectSorting because full rows wrap. */
function DroppableRowArea({ container, items, children }: RowAreaProps) {
  const { setNodeRef } = useDroppable({ id: container })
  return (
    <SortableContext id={container} items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} style={ROW_AREA_STYLE}>
        {children}
      </div>
    </SortableContext>
  )
}

// Tier rows are big targets, so trust the pointer while it's inside one; fall
// back to closestCorners for keyboard drags and the gaps between rows. Plain
// rectIntersection misfires here — the floating card often overlaps two
// stacked rows at once.
const collisionStrategy: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length > 0 ? within : closestCorners(args)
}

function findItem(board: Board, id: string): TierItem | undefined {
  for (const list of [...Object.values(board.tiers), board.unranked]) {
    const hit = list.find((item) => item.id === id)
    if (hit) return hit
  }
  return undefined
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

export function TierBoard({
  board: storeBoard,
  positions,
  onPlace,
  onUnrank,
  onRenormalize,
  onCardClick,
  shelfHint,
}: {
  /** The viewer's board as derived from the store (the source of truth). */
  board: Board
  /** The viewer's placement position per item id — neighbor lookup on drop. */
  positions: Map<string, number>
  onPlace: (itemId: string, tier: Tier, position: number) => void
  onUnrank: (itemId: string) => void
  /** Float precision ran out in a tier — rewrite it at integer positions. */
  onRenormalize: (tier: Tier, orderedItemIds: string[]) => void
  onCardClick: (item: TierItem) => void
  shelfHint?: string
}) {
  // While dragging, render a frozen local copy: onDragOver mutates it for the
  // cross-row preview, and realtime updates landing in the store can't yank
  // the board around under the cursor. null = not dragging.
  const [dragBoard, setDragBoard] = useState<Board | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const board = dragBoard ?? storeBoard

  const sensors = useSensors(
    // 4px of travel before a drag starts, so a plain click opens the editor.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Long-press on touch, so the page still scrolls normally.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const finishDrag = () => {
    setActiveId(null)
    setDragBoard(null)
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    setDragBoard(storeBoard)
  }

  // Cross-container moves happen live, mid-drag, so the target row visibly
  // opens up. Same-container reordering is SortableContext's job until drop.
  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!dragBoard || !over) return
    const id = String(active.id)
    const overId = String(over.id)
    const from = findContainer(dragBoard, id)
    const to = findContainer(dragBoard, overId)
    if (!from || !to || from === to) return
    const targetItems = containerItems(dragBoard, to)
    // Over a card → take its slot; over the container itself → append.
    const overIndex = targetItems.findIndex((i) => i.id === overId)
    setDragBoard(moveItem(dragBoard, id, from, to, overIndex === -1 ? targetItems.length : overIndex))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    const id = String(active.id)
    if (!dragBoard || !over) {
      finishDrag()
      return
    }

    // After onDragOver the active card already lives in its final container.
    const container = findContainer(dragBoard, id)
    const overContainer = findContainer(dragBoard, String(over.id))
    if (!container || !overContainer || container !== overContainer) {
      finishDrag()
      return
    }

    // Settle the final ordering: dropping on a sibling card takes its index.
    let ids = containerItems(dragBoard, container).map((i) => i.id)
    const overId = String(over.id)
    if (overId !== id && overId !== container) {
      const oldIndex = ids.indexOf(id)
      const newIndex = ids.indexOf(overId)
      if (oldIndex !== -1 && newIndex !== -1) ids = arrayMove(ids, oldIndex, newIndex)
    }

    // No-op drop (same container, same order as the store) → no write.
    const storeContainer = findContainer(storeBoard, id)
    if (
      storeContainer === container &&
      sameOrder(ids, containerItems(storeBoard, container).map((i) => i.id))
    ) {
      finishDrag()
      return
    }

    if (container === 'unranked') {
      if (storeContainer !== 'unranked') onUnrank(id)
      finishDrag()
      return
    }

    // Position between the settled neighbors' stored positions. The store's
    // optimistic update lands in the same synchronous handler as finishDrag,
    // so React batches them — no flash of the pre-drag board.
    const index = ids.indexOf(id)
    const before = index > 0 ? positions.get(ids[index - 1]) ?? null : null
    const after = index < ids.length - 1 ? positions.get(ids[index + 1]) ?? null : null
    const position = positionBetween(before, after)
    if (position === null) onRenormalize(container, ids)
    else onPlace(id, container, position)
    finishDrag()
  }

  const activeItem = activeId ? findItem(board, activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={finishDrag}
    >
      <BoardView
        board={board}
        RowArea={DroppableRowArea}
        shelfHint={shelfHint}
        renderCard={(item: TierItem, _container: ContainerId) => (
          <SortableCard key={item.id} item={item} onClick={() => onCardClick(item)} />
        )}
      />
      {createPortal(
        <DragOverlay>{activeItem ? <CardVisual item={activeItem} lifted /> : null}</DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
