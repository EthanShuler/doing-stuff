import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Text } from '@mantine/core'
import type { ListItem, ListRef } from '../../types'
import { colors, fonts, text } from '../../theme'
import { useBusy } from '../../lib/useBusy'
import { useConfirm } from '../../components/ConfirmModal'
import { ControlBar } from '../../components/ControlBar'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { PickerRow } from '../../components/PickerRow'
import type { PickerEntry } from '../../components/PickerRow'
import { Splash } from '../../components/Splash'
import { useListStore } from './useListStore'
import { isDone, listIdOf, listIsPersonal, refFor, sortListItems } from './derive'
import { LIST_COPY, copyFor } from './copy'
import { ListRows } from './ListRows'
import { ListItemModal } from './ListItemModal'
import type { ListItemDraft } from './ListItemModal'
import { ListDefModal, draftFromListDef, emptyListDefDraft } from './ListDefModal'
import type { ListDefDraft } from './ListDefModal'

/** The three built-in lists, in picker order. Each keeps its own URL, so the
 *  pills navigate rather than set local state. */
const BUILT_INS: { ref: 'movie' | 'tv' | 'book'; path: string }[] = [
  { ref: 'movie', path: '/lists/movies' },
  { ref: 'tv', path: '/lists/tv' },
  { ref: 'book', path: '/lists/books' },
]

const emptyItemDraft = (): ListItemDraft => ({ title: '', imageUrl: '', creator: '' })

interface ListsPageProps {
  /** The built-in list this route renders. Omitted for `/lists/:id`, where the
   *  list id in the URL names the list instead. */
  kind?: 'movie' | 'tv' | 'book'
  spaceId: string | null
  userId: string | null
  configured: boolean
}

/** Every Lists route — the three built-ins and `/lists/:id` — renders this
 *  same component in the same tree slot, so the store (and its realtime
 *  channel) survives switching lists; only the ref changes and the rows
 *  re-derive. */
export function ListsPage({ kind, spaceId, userId, configured }: ListsPageProps) {
  const store = useListStore(spaceId, userId)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { id: routeListId } = useParams()
  // Which list is showing: a built-in from the route, or the free-form list
  // named in the URL.
  const ref: ListRef = kind ?? refFor(routeListId ?? '')
  const copy = copyFor(ref, store.lists)

  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [itemDraft, setItemDraft] = useState<ListItemDraft>(emptyItemDraft)

  // The list modal (create / rename a free-form list) is separate: it edits
  // the LIST, not a row on it.
  const [listModalOpen, setListModalOpen] = useState(false)
  const [listDraft, setListDraft] = useState<ListDefDraft>(emptyListDefDraft)
  const [editingList, setEditingList] = useState(false)

  // Every list renders this same component, so a list switch (a picker pill,
  // or browser back/forward) must drop an open modal — a movie edit saved on
  // the Groceries route would file it under the wrong list.
  useEffect(() => {
    setItemModalOpen(false)
    setEditingId(null)
    setListModalOpen(false)
  }, [ref])

  // The rows on this list. The reading list is per person: show only the
  // viewer's (RLS also refuses writes to anyone else's book rows).
  const rows = sortListItems(
    store.items.filter((w) => w.key === ref && (!listIsPersonal(ref) || w.createdBy === store.selfId)),
  )
  const openCount = rows.filter((w) => !isDone(w)).length
  const doneCount = rows.length - openCount

  const activeList = store.lists.find((l) => l.id === listIdOf(ref)) ?? null

  const entries: PickerEntry[] = [
    ...BUILT_INS.map((entry) => ({
      key: entry.ref,
      label: `${LIST_COPY[entry.ref].emoji} ${LIST_COPY[entry.ref].label}`,
      path: entry.path,
    })),
    ...store.lists.map((def) => ({
      key: refFor(def.id),
      label: `${def.emoji || '🏷️'} ${def.name}`,
      path: `/lists/${def.id}`,
    })),
  ]

  // --- Row actions ---

  const openEdit = (item: ListItem) => {
    setEditingId(item.id)
    setItemDraft({ title: item.title, imageUrl: item.imageUrl, creator: item.creator })
    setItemModalOpen(true)
  }

  const closeItemModal = () => {
    setItemModalOpen(false)
    setEditingId(null)
  }

  const { busy: savingItem, run: runSaveItem } = useBusy()
  const saveItem = () =>
    runSaveItem(async () => {
      if (!editingId || !itemDraft.title.trim()) return
      try {
        await store.updateItem(editingId, itemDraft.title, itemDraft.imageUrl, itemDraft.creator)
        closeItemModal()
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const removeItem = async (item: ListItem) => {
    const ok = await confirm({
      title: `Remove this from ${copy.label}?`,
      message: `"${item.title}" comes off the list.`,
    })
    if (!ok) return
    try {
      await store.deleteItem(item.id)
      if (editingId === item.id) closeItemModal()
    } catch {
      // Keep the modal open on failure.
    }
  }

  const removeEditingItem = async () => {
    const item = rows.find((w) => w.id === editingId)
    if (!item) {
      closeItemModal()
      return
    }
    await removeItem(item)
  }

  // --- The list itself ---

  const openNewList = () => {
    setEditingList(false)
    setListDraft(emptyListDefDraft())
    setListModalOpen(true)
  }

  const openEditList = () => {
    if (!activeList) return
    setEditingList(true)
    setListDraft(draftFromListDef(activeList))
    setListModalOpen(true)
  }

  const { busy: savingList, run: runSaveList } = useBusy()
  const saveList = () =>
    runSaveList(async () => {
      if (!listDraft.name.trim()) return
      try {
        if (editingList && activeList) {
          await store.updateList(activeList.id, listDraft)
          setListModalOpen(false)
        } else {
          const created = await store.addList(listDraft)
          setListModalOpen(false)
          // Land on the new list right away — it's empty and waiting.
          navigate(`/lists/${created.id}`)
        }
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const deleteActiveList = async () => {
    if (!activeList) return
    const ok = await confirm({
      title: `Delete "${activeList.name}" for both of you?`,
      message: 'Everything on it is removed too.',
    })
    if (!ok) return
    try {
      await store.deleteList(activeList.id)
      setListModalOpen(false)
      // The <Navigate> guard below bounces this route to /lists/movies once
      // the list row is gone.
    } catch {
      // Keep the modal open on failure.
    }
  }

  // Gate on the first data load (live mode only; the space resolves in App).
  // The picker and control bar stay put; only the rows wait.
  const loadingData = configured && store.loading

  // A `custom:<id>` ref with no matching row means the list never existed, or
  // the partner just deleted the one you were looking at. Checked AFTER the
  // loading gate so a hard load of /lists/:id in live mode waits for the
  // snapshot instead of bouncing on an empty store; in seed mode the data is
  // there from the first render, so it bounces immediately.
  const missingList = listIdOf(ref) !== null && activeList === null
  if (missingList && !loadingData) {
    return <Navigate to="/lists/movies" replace />
  }

  return (
    <>
      <title>{`${copy.label} · Lists · cajubinile.com`}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <PageFrame maw={760}>
        {/* Which list you're looking at — the pills are this feature's nav. */}
        <PickerRow
          entries={entries}
          activeKey={ref}
          onNew={openNewList}
          // Only a free-form list can be renamed; the built-ins are fixed.
          onEdit={listIdOf(ref) ? openEditList : undefined}
        />

        <ControlBar
          left={
            <>
              {!loadingData && (
                <Text fz={text.small} c={colors.muted} style={{ fontFamily: fonts.sans }}>
                  {openCount} to {copy.verb} · {doneCount} {copy.past}
                </Text>
              )}
              {listIsPersonal(ref) && (
                <Text fz={text.small} c={colors.faint} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                  Just yours — your partner keeps their own.
                </Text>
              )}
            </>
          }
        />

        {loadingData ? (
          <Splash text="Loading your space…" mih="40vh" />
        ) : (
          <ListRows
            items={rows}
            copy={copy}
            onAdd={(title, imageUrl, creator) => store.addItem(ref, title, imageUrl, creator)}
            onCheck={(item) => {
              void store.checkOff(item)
            }}
            onUncheck={(item) => {
              void store.uncheck(item)
            }}
            onEdit={openEdit}
            onDelete={(item) => {
              void removeItem(item)
            }}
            onMove={(id, position) => {
              void store.moveItem(id, position)
            }}
            onRenormalize={(orderedIds) => {
              void store.renormalize(orderedIds)
            }}
          />
        )}
      </PageFrame>

      <ListDefModal
        opened={listModalOpen}
        draft={listDraft}
        isEditing={editingList}
        onChange={(patch) => setListDraft((prev) => ({ ...prev, ...patch }))}
        saving={savingList}
        onSave={saveList}
        onDelete={deleteActiveList}
        onClose={() => setListModalOpen(false)}
      />

      <ListItemModal
        opened={itemModalOpen}
        copy={copy}
        draft={itemDraft}
        onChange={(patch) => setItemDraft((prev) => ({ ...prev, ...patch }))}
        saving={savingItem}
        onSave={saveItem}
        onDelete={removeEditingItem}
        onClose={closeItemModal}
      />
    </>
  )
}
