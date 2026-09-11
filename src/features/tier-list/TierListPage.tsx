import { useEffect, useMemo, useState } from 'react'
import { Button, SegmentedControl, Text } from '@mantine/core'
import type { Tier, TierItem, TierKind, WatchlistItem } from '../../types'
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
import { datesArePersonal, deriveBoard, distinctTags, filterByTags, listIsPersonal, sortWatchlist } from './derive'
import { KIND_COPY } from './copy'
import { TierBoard } from './TierBoard'
import { BoardView } from './BoardView'
import { CardVisual } from './TierCard'
import { Watchlist } from './Watchlist'
import { ItemModal } from './ItemModal'
import type { ItemDraft } from './ItemModal'
import { ListPicker } from './ListPicker'

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
  kind: TierKind
  spaceId: string | null
  userId: string | null
  configured: boolean
}

/** The movie/TV/book tier lists. All three routes render this same component
 *  (same tree position), so the store — and its realtime channel — survives
 *  switching kinds; only the `kind` prop changes and the board re-derives. */
export function TierListPage({ kind, spaceId, userId, configured }: TierListPageProps) {
  const store = useTierListStore(spaceId, userId)
  const confirm = useConfirm()
  const copy = KIND_COPY[kind]
  const noun = copy.noun
  // Books track "have I read it" per person; movies/TV share one watched date.
  const personal = datesArePersonal(kind)

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

  // The watchlist for this kind: the open queue first (position order — drag
  // to reorder, top = next up), then checked-off ones. Reading lists (books)
  // are per person — show only the viewer's own rows; the other lists are
  // shared, so everyone's rows show.
  const watchItems = useMemo(
    () =>
      sortWatchlist(
        store.watchlist.filter(
          (w) => w.kind === kind && (!listIsPersonal(kind) || w.createdBy === store.selfId),
        ),
      ),
    [store.watchlist, kind, store.selfId],
  )

  // Date per tier item id, for the checked-off watchlist rows (the wish itself
  // has no date — it's looked up via the tier item it produced). Movies/TV:
  // the shared watched date. Books: YOUR read date — a book the partner
  // checked off shows dateless until you read it too.
  const doneDates = useMemo<Map<string, string | null>>(
    () =>
      personal
        ? new Map(store.completions.filter((r) => r.userId === store.selfId).map((r) => [r.itemId, r.doneOn]))
        : new Map(store.items.filter((item) => item.kind === kind).map((item) => [item.id, item.doneOn])),
    [personal, store.completions, store.selfId, store.items, kind],
  )

  // Tag filter (shared tri-state pills — see src/lib/useTagFilter). While any
  // state is set the board shows only matching items — read-only, because
  // drops between visible neighbors would land at arbitrary positions
  // relative to the hidden cards.
  const { tagFilter, includedTags, excludedTags, filterActive, toggleTag, clearTagFilter } = useTagFilter()
  useEffect(() => clearTagFilter(), [kind])
  // All four routes render this same component, so a kind switch (browser
  // back/forward — the header nav is behind the overlay) must drop an open
  // modal: saving a movie draft onto /tv would file it under the wrong kind,
  // and a book edit saved on a movie route would flip its date semantics.
  useEffect(() => {
    setModalOpen(false)
    setEditingId(null)
  }, [kind])
  const kindTags = useMemo(() => distinctTags(store.items, kind), [store.items, kind])

  const viewerId = showingPartner ? partner.id : store.selfId
  const board = useMemo(
    () => deriveBoard(filterByTags(store.items, includedTags, excludedTags), store.placements, store.completions, viewerId, kind),
    [store.items, tagFilter, store.placements, store.completions, viewerId, kind],
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
          else await store.addWatchlistItem(kind, draft.title, draft.imageUrl, draft.creator)
        } else {
          const dateOn = draft.doneOn || null
          if (editingId) await store.updateItem(editingId, kind, draft.title, draft.imageUrl, draft.creator, dateOn, draft.tags)
          else await store.addItem(kind, draft.title, draft.imageUrl, draft.creator, dateOn, draft.tags)
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

  // Gate on the first data load (live mode only; the space resolves in App).
  // The picker and control bar stay put; only the board waits.
  const loadingData = configured && store.loading

  return (
    <>
      <title>{`${copy.pageTitle} · cajubinile.com`}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <PageFrame>
        {/* Which list you're looking at — the four boards used to be four
            header nav items. */}
        <ListPicker activeKey={kind} />

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
                {listIsPersonal(kind) && partner && (
                  <Text fz={text.small} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                    Your {copy.listLabel.toLowerCase()} — {partnerName} keeps their own.
                  </Text>
                )}
                <Watchlist
                  items={watchItems}
                  kind={kind}
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
                  renderCard={(item) => <CardVisual key={item.id} item={item} />}
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
                  renderCard={(item) => <CardVisual key={item.id} item={item} onClick={() => openEdit(item)} />}
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

      <ItemModal
        opened={modalOpen}
        kind={kind}
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
