import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button, SegmentedControl, Text } from '@mantine/core'
import type { ListKey, Tier, TierItem, TierKind, WatchlistItem } from '../../types'
import { colors, fonts, text } from '../../theme'
import { today } from '../../lib/format'
import { displayNameFor } from '../../lib/profile'
import { useBusy } from '../../lib/useBusy'
import { useTagFilter } from '../../lib/useTagFilter'
import { TagFilterPills } from '../../components/TagFilterPills'
import { useConfirm } from '../../components/ConfirmModal'
import { ControlBar } from '../../components/ControlBar'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { Splash } from '../../components/Splash'
import { useTierListStore } from './useTierListStore'
import { datesArePersonal, deriveBoard, distinctTags, filterByTags, listIdOf, listIsPersonal, listKeyFor, sortWatchlist } from './derive'
import { copyFor } from './copy'
import { TierBoard } from './TierBoard'
import { BoardView } from './BoardView'
import { CardVisual } from './TierCard'
import { Watchlist } from './Watchlist'
import { ItemModal } from './ItemModal'
import type { ItemDraft } from './ItemModal'
import { ListPicker } from './ListPicker'
import { ListModal, draftFromList, emptyListDraft } from './ListModal'
import type { ListDraft } from './ListModal'

type Mode = 'board' | 'watchlist'

// A board add is "just finished this" → default the date to today (the shared
// watched date, or your own read date for books). Watchlist items aren't
// started yet, so their draft leaves it blank (and hides the field).
const emptyDraft = (variant: Mode): ItemDraft => ({
  title: '',
  imageUrl: '',
  doneOn: variant === 'board' ? today() : '',
  tags: [],
  creator: '',
})

interface TierListPageProps {
  /** The built-in board this route renders. Omitted for `/lists/:id`, where
   *  the list id in the URL names the board instead. */
  kind?: TierKind
  spaceId: string | null
  userId: string | null
  configured: boolean
}

/** Every tier-list route — the four built-ins and `/lists/:id` — renders this
 *  same component in the same tree slot, so the store (and its realtime
 *  channel) survives switching boards; only the key changes and the board
 *  re-derives. */
export function TierListPage({ kind, spaceId, userId, configured }: TierListPageProps) {
  const store = useTierListStore(spaceId, userId)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { id: routeListId } = useParams()
  // Which board is showing: a built-in kind from the route, or the custom
  // list named in the URL.
  const key: ListKey = kind ?? listKeyFor(routeListId ?? '')
  const copy = copyFor(key, store.lists)
  const noun = copy.noun
  // Books track "have I read it" per person; everything else shares one date.
  const personal = datesArePersonal(key)

  // Board (tier ranking) vs. Watchlist/Reading list (things we want to get
  // to). Both live in the same tab; the store survives the switch just like
  // kind switches.
  const [mode, setMode] = useState<Mode>('board')

  // Whose board is showing. Yours is drag-and-drop; the partner's renders the
  // same layout read-only (their placements are also read-only under RLS).
  const [viewer, setViewer] = useState<'you' | 'partner'>('you')
  const partner = store.profiles.find((p) => p.id !== store.selfId) ?? null
  const partnerName = displayNameFor(partner) || 'Partner'
  const showingPartner = viewer === 'partner' && partner !== null

  // Modal state. `variant` selects the save path: a board add/edit writes to the
  // tier pool; a watchlist add/edit writes to `watchlist_items`.
  const [modalOpen, setModalOpen] = useState(false)
  const [modalVariant, setModalVariant] = useState<Mode>('board')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft>(() => emptyDraft('board'))

  // The list modal (create / re-word a space-defined list) is separate: it
  // edits the BOARD, not an item on it.
  const [listModalOpen, setListModalOpen] = useState(false)
  const [listDraft, setListDraft] = useState<ListDraft>(emptyListDraft)
  const [editingList, setEditingList] = useState(false)

  // The watchlist for this kind: the open queue first (position order — drag
  // to reorder, top = next up), then checked-off ones. Reading lists (books)
  // are per person — show only the viewer's own rows; the other lists are
  // shared, so everyone's rows show.
  const watchItems = useMemo(
    () =>
      sortWatchlist(
        store.watchlist.filter(
          (w) => w.kind === key && (!listIsPersonal(key) || w.createdBy === store.selfId),
        ),
      ),
    [store.watchlist, key, store.selfId],
  )

  // Date per tier item id, for the checked-off watchlist rows (the wish itself
  // has no date — it's looked up via the tier item it produced). Movies/TV:
  // the shared watched date. Books: YOUR read date — a book the partner
  // checked off shows dateless until you read it too.
  const doneDates = useMemo<Map<string, string | null>>(
    () =>
      personal
        ? new Map(store.completions.filter((r) => r.userId === store.selfId).map((r) => [r.itemId, r.doneOn]))
        : new Map(store.items.filter((item) => item.kind === key).map((item) => [item.id, item.doneOn])),
    [personal, store.completions, store.selfId, store.items, key],
  )

  // Tag filter (shared tri-state pills — see src/lib/useTagFilter). While any
  // state is set the board shows only matching items — read-only, because
  // drops between visible neighbors would land at arbitrary positions
  // relative to the hidden cards.
  const { tagFilter, includedTags, excludedTags, filterActive, toggleTag, clearTagFilter } = useTagFilter()
  useEffect(() => clearTagFilter(), [key])
  // Every board renders this same component, so a board switch (a picker pill,
  // or browser back/forward) must drop an open modal: saving a movie draft
  // onto /tv would file it under the wrong board, and a book edit saved on a
  // movie route would flip its date semantics.
  useEffect(() => {
    setModalOpen(false)
    setEditingId(null)
    setListModalOpen(false)
  }, [key])
  const kindTags = useMemo(() => distinctTags(store.items, key), [store.items, key])

  const viewerId = showingPartner ? partner.id : store.selfId
  const board = useMemo(
    () => deriveBoard(filterByTags(store.items, includedTags, excludedTags), store.placements, store.completions, viewerId, key),
    [store.items, tagFilter, store.placements, store.completions, viewerId, key],
  )

  // Your placement position per item — neighbor lookup when a drop lands.
  const positions = useMemo(
    () => new Map(store.placements.filter((p) => p.userId === store.selfId).map((p) => [p.itemId, p.position])),
    [store.placements, store.selfId],
  )

  // The "+ Add" button adds to whichever view you're in.
  const openAdd = () => {
    setModalVariant(mode)
    setEditingId(null)
    setDraft(emptyDraft(mode))
    setModalOpen(true)
  }

  const openEdit = (item: TierItem) => {
    setModalVariant('board')
    setEditingId(item.id)
    // The date field edits the shared watched date — or, for books, YOUR own
    // read date (blank = you haven't read it, whatever the partner has done).
    const dateOn = personal
      ? store.completions.find((r) => r.itemId === item.id && r.userId === store.selfId)?.doneOn ?? ''
      : item.doneOn ?? ''
    setDraft({ title: item.title, imageUrl: item.imageUrl, doneOn: dateOn, tags: item.tags, creator: item.creator })
    setModalOpen(true)
  }

  const openEditWatch = (item: WatchlistItem) => {
    setModalVariant('watchlist')
    setEditingId(item.id)
    setDraft({ title: item.title, imageUrl: item.imageUrl, doneOn: '', tags: [], creator: item.creator })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const { busy: saving, run: runSave } = useBusy()
  const saveItem = () =>
    runSave(async () => {
      if (!draft.title.trim()) return
      try {
        if (modalVariant === 'watchlist') {
          if (editingId) await store.updateWatchlistItem(editingId, draft.title, draft.imageUrl, draft.creator)
          else await store.addWatchlistItem(key, draft.title, draft.imageUrl, draft.creator)
        } else {
          const dateOn = draft.doneOn || null
          if (editingId) await store.updateItem(editingId, key, draft.title, draft.imageUrl, draft.creator, dateOn, draft.tags)
          else await store.addItem(key, draft.title, draft.imageUrl, draft.creator, dateOn, draft.tags)
        }
        closeModal()
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  // Watch/reading-list rows are shared too (except books), and the row's ×
  // sits right beside the checkbox — so removing one asks first.
  const confirmRemoveFromList = () =>
    confirm({
      title: `Remove this from the ${copy.listLabel.toLowerCase()}?`,
      message: `It hasn't been ${copy.past} yet, so nothing else goes with it.`,
      confirmLabel: 'Remove',
    })

  const removeFromList = async (id: string) => {
    if (!(await confirmRemoveFromList())) return
    void store.deleteWatchlistItem(id)
  }

  const deleteEditingItem = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    try {
      if (modalVariant === 'watchlist') {
        if (!(await confirmRemoveFromList())) return
        await store.deleteWatchlistItem(editingId)
      } else {
        const ok = await confirm({
          title: `Delete this ${noun} for both of you?`,
          message: "Everyone's rankings of it are removed too.",
        })
        if (!ok) return
        await store.deleteItem(editingId)
      }
      closeModal()
    } catch {
      // Keep the modal open on failure.
    }
  }

  // --- The list itself (the board's own name and words) ---

  const activeList = store.lists.find((l) => l.id === listIdOf(key)) ?? null

  const openNewList = () => {
    setEditingList(false)
    setListDraft(emptyListDraft())
    setListModalOpen(true)
  }

  const openEditList = () => {
    if (!activeList) return
    setEditingList(true)
    setListDraft(draftFromList(activeList))
    setListModalOpen(true)
  }

  const { busy: savingList, run: runSaveList } = useBusy()
  const saveList = () =>
    runSaveList(async () => {
      if (!listDraft.name.trim() || !listDraft.noun.trim()) return
      try {
        if (editingList && activeList) {
          await store.updateList(activeList.id, listDraft)
          setListModalOpen(false)
        } else {
          const created = await store.addList(listDraft)
          setListModalOpen(false)
          // Land on the new board right away — it's empty and waiting.
          navigate(`/lists/${created.id}`)
        }
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const deleteActiveList = async () => {
    if (!activeList) return
    const ok = await confirm({
      title: `Delete the "${activeList.name}" list for both of you?`,
      message: `Every ${activeList.noun} on it, everyone's rankings of them, and its to-${activeList.verb} list are removed too.`,
    })
    if (!ok) return
    try {
      await store.deleteList(activeList.id)
      setListModalOpen(false)
      // The <Navigate> guard below bounces this route to /movies once the
      // list row is gone.
    } catch {
      // Keep the modal open on failure.
    }
  }

  // Gate on the first data load (live mode only; the space resolves in App).
  // The picker and control bar stay put; only the board waits.
  const loadingData = configured && store.loading

  // A `list:<id>` key with no matching row means the list never existed, or
  // the partner just deleted the one you were looking at. Checked AFTER the
  // loading gate so a hard load of /lists/:id in live mode waits for the
  // snapshot instead of bouncing on an empty store; in seed mode the data is
  // there from the first render, so it bounces immediately.
  const missingList = listIdOf(key) !== null && activeList === null
  if (missingList && !loadingData) {
    return <Navigate to="/movies" replace />
  }

  return (
    <>
      <title>{`${copy.pageTitle} · cajubinile.com`}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <PageFrame>
        {/* Which list you're looking at — the four boards used to be four
            header nav items. */}
        <ListPicker
          lists={store.lists}
          activeKey={key}
          onNew={openNewList}
          onEdit={openEditList}
        />

        <ControlBar
          left={
            <>
              <SegmentedControl
                value={mode}
                onChange={(value) => setMode(value as Mode)}
                data={[
                  { label: 'Board', value: 'board' },
                  { label: copy.listLabel, value: 'watchlist' },
                ]}
              />
              {mode === 'board' &&
                !loadingData &&
                (partner ? (
                  <SegmentedControl
                    value={viewer}
                    onChange={(value) => setViewer(value as 'you' | 'partner')}
                    data={[
                      { label: 'You', value: 'you' },
                      { label: partnerName, value: 'partner' },
                    ]}
                  />
                ) : (
                  // Third row at phone width — the board itself says as much.
                  <Text fz={text.small} c={colors.muted} visibleFrom="sm" style={{ fontFamily: fonts.sans }}>
                    Just your board for now — rankings are per person once your partner joins.
                  </Text>
                ))}
            </>
          }
          right={<Button onClick={openAdd}>+ Add {noun}</Button>}
        />

        {loadingData ? (
          <Splash text="Loading your space…" mih="40vh" />
        ) : (
          <>
            {/* Tag filter pills — only once something on this kind is tagged. */}
            {mode === 'board' && (
              <TagFilterPills
                tags={kindTags}
                allLabel={`All ${noun}s`}
                tagFilter={tagFilter}
                filterActive={filterActive}
                onToggle={toggleTag}
                onClear={clearTagFilter}
              />
            )}

            {mode === 'watchlist' ? (
              <>
                {listIsPersonal(key) && partner && (
                  <Text fz={text.small} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                    Your {copy.listLabel.toLowerCase()} — {partnerName} keeps their own.
                  </Text>
                )}
                <Watchlist
                  items={watchItems}
                  copy={copy}
                  doneDates={doneDates}
                  onCheck={(item) => {
                    void store.checkOffWatchlistItem(item)
                  }}
                  onUncheck={(id) => {
                    void store.uncheckWatchlistItem(id)
                  }}
                  onEdit={openEditWatch}
                  onDelete={(id) => {
                    void removeFromList(id)
                  }}
                  onMove={(id, position) => {
                    void store.moveWatchlistItem(id, position)
                  }}
                  onRenormalize={(orderedIds) => {
                    void store.renormalizeWatchlist(orderedIds)
                  }}
                />
              </>
            ) : showingPartner ? (
              <>
                <Text fz={text.small} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                  {partnerName}'s board — just for looking.
                </Text>
                <BoardView
                  board={board}
                  renderCard={(item) => <CardVisual key={item.id} item={item} emoji={copy.emoji} />}
                  shelfHint={`${partnerName} hasn't ranked everything yet.`}
                  unwatchedHint={`Nothing waiting to be ${copy.past}.`}
                  unwatchedLabel={copy.shelfLabel}
                />
              </>
            ) : filterActive ? (
              // Your board, filtered: hidden cards make drop positions ambiguous,
              // so this is the same read-only layout — cards still open the editor.
              <>
                <Text fz={text.small} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                  Filtered by tag — clear the filter to rearrange.
                </Text>
                <BoardView
                  board={board}
                  renderCard={(item) => (
                    <CardVisual key={item.id} item={item} emoji={copy.emoji} onClick={() => openEdit(item)} />
                  )}
                  shelfHint={`No unranked ${noun}s match this filter.`}
                  unwatchedHint={`No ${copy.shelfLabel.toLowerCase()} ${noun}s match this filter.`}
                  unwatchedLabel={copy.shelfLabel}
                />
              </>
            ) : (
              <TierBoard
                board={board}
                positions={positions}
                onPlace={(itemId: string, tier: Tier, position: number) => {
                  void store.placeItem(itemId, tier, position)
                }}
                onUnrank={(itemId: string) => {
                  void store.unplaceItem(itemId)
                }}
                onRenormalize={(tier: Tier, orderedIds: string[]) => {
                  void store.placeTier(tier, orderedIds)
                }}
                // Dragging out of the unwatched/unread shelf means "finished it"
                // → stamp today; dragging onto it clears the date. Movies/TV
                // write the shared watched date; books write YOUR read record.
                onMarkDone={(itemId: string) => {
                  void (personal ? store.setDoneOn(itemId, today()) : store.setSharedDoneOn(itemId, today()))
                }}
                onMarkUndone={(itemId: string) => {
                  void (personal ? store.setDoneOn(itemId, null) : store.setSharedDoneOn(itemId, null))
                }}
                onCardClick={openEdit}
                cardEmoji={copy.emoji}
                shelfHint={
                  board.unranked.length === 0 &&
                  board.unwatched.length === 0 &&
                  Object.values(board.tiers).every((t) => t.length === 0)
                    ? `No ${noun}s yet — add one, or check something off your ${copy.listLabel.toLowerCase()}.`
                    : 'Everything is ranked. Nice.'
                }
                unwatchedHint={`Drag a ${noun} here if you haven't actually ${copy.past} it yet.`}
                unwatchedLabel={copy.shelfLabel}
              />
            )}
          </>
        )}
      </PageFrame>

      <ListModal
        opened={listModalOpen}
        draft={listDraft}
        isEditing={editingList}
        onChange={(patch) => setListDraft((prev) => ({ ...prev, ...patch }))}
        saving={savingList}
        onSave={saveList}
        onDelete={deleteActiveList}
        onClose={() => setListModalOpen(false)}
      />

      <ItemModal
        opened={modalOpen}
        kind={key}
        copy={copy}
        draft={draft}
        isEditing={editingId !== null}
        variant={modalVariant}
        tagSuggestions={kindTags}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        saving={saving}
        onSave={saveItem}
        onDelete={deleteEditingItem}
        onClose={closeModal}
      />
    </>
  )
}
