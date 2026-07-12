import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Group, SegmentedControl, Text } from '@mantine/core'
import type { Tier, TierItem, TierKind, WatchlistItem } from '../../types'
import { ACCENT, colors, fonts } from '../../theme'
import { today } from '../../lib/format'
import { displayNameFor } from '../../lib/profile'
import { Pill } from '../../components/Pill'
import { FloatingBanner } from '../../components/FloatingBanner'
import { Splash } from '../../components/Splash'
import { useTierListStore } from './useTierListStore'
import { datesArePersonal, deriveBoard, distinctTags, filterByTags, listIsPersonal } from './derive'
import { KIND_COPY } from './copy'
import { TierBoard } from './TierBoard'
import { BoardView } from './BoardView'
import { CardVisual } from './TierCard'
import { Watchlist } from './Watchlist'
import { ItemModal } from './ItemModal'
import type { ItemDraft } from './ItemModal'

type Mode = 'board' | 'watchlist'

// A board add is "just finished this" → default the date to today (the shared
// watched date, or your own read date for books). Watchlist items aren't
// started yet, so their draft leaves it blank (and hides the field).
const emptyDraft = (variant: Mode): ItemDraft => ({
  title: '',
  imageUrl: '',
  watchedOn: variant === 'board' ? today() : '',
  tags: [],
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

  // The watchlist for this kind: open items first, then checked-off ones.
  // Reading lists (books) are per person — show only the viewer's own rows;
  // the other lists are shared, so everyone's rows show.
  const watchItems = useMemo(() => {
    const mine = store.watchlist.filter(
      (w) => w.kind === kind && (!listIsPersonal(kind) || w.createdBy === store.selfId),
    )
    const rank = (w: WatchlistItem) => (w.tierItemId === null ? 0 : 1)
    return [...mine].sort((a, b) =>
      rank(a) !== rank(b) ? rank(a) - rank(b) : a.createdAt < b.createdAt ? -1 : 1,
    )
  }, [store.watchlist, kind, store.selfId])

  // Date per tier item id, for the checked-off watchlist rows (the wish itself
  // has no date — it's looked up via the tier item it produced). Movies/TV:
  // the shared watched date. Books: YOUR read date — a book the partner
  // checked off shows dateless until you read it too.
  const watchedDates = useMemo<Map<string, string | null>>(
    () =>
      personal
        ? new Map(store.reads.filter((r) => r.userId === store.selfId).map((r) => [r.itemId, r.readOn]))
        : new Map(store.items.filter((item) => item.kind === kind).map((item) => [item.id, item.watchedOn])),
    [personal, store.reads, store.selfId, store.items, kind],
  )

  // Tag filter: multi-select pills over the tags in use on this kind. While
  // any are selected the board shows only matching items — read-only, because
  // drops between visible neighbors would land at arbitrary positions relative
  // to the hidden cards.
  const [tagFilter, setTagFilter] = useState<string[]>([])
  useEffect(() => setTagFilter([]), [kind])
  const kindTags = useMemo(() => distinctTags(store.items, kind), [store.items, kind])
  const filterActive = tagFilter.length > 0
  const toggleTag = (tag: string) =>
    setTagFilter((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))

  const viewerId = showingPartner ? partner.id : store.selfId
  const board = useMemo(
    () => deriveBoard(filterByTags(store.items, tagFilter), store.placements, store.reads, viewerId, kind),
    [store.items, tagFilter, store.placements, store.reads, viewerId, kind],
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
      ? store.reads.find((r) => r.itemId === item.id && r.userId === store.selfId)?.readOn ?? ''
      : item.watchedOn ?? ''
    setDraft({ title: item.title, imageUrl: item.imageUrl, watchedOn: dateOn, tags: item.tags })
    setModalOpen(true)
  }

  const openEditWatch = (item: WatchlistItem) => {
    setModalVariant('watchlist')
    setEditingId(item.id)
    setDraft({ title: item.title, imageUrl: item.imageUrl, watchedOn: '', tags: [] })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const saveItem = async () => {
    if (!draft.title.trim()) return
    try {
      if (modalVariant === 'watchlist') {
        if (editingId) await store.updateWatchlistItem(editingId, draft.title, draft.imageUrl)
        else await store.addWatchlistItem(kind, draft.title, draft.imageUrl)
      } else {
        const dateOn = draft.watchedOn || null
        if (editingId) await store.updateItem(editingId, kind, draft.title, draft.imageUrl, dateOn, draft.tags)
        else await store.addItem(kind, draft.title, draft.imageUrl, dateOn, draft.tags)
      }
      closeModal()
    } catch {
      // Write failed — keep the modal open; store.error shows the reason.
    }
  }

  const deleteEditingItem = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    try {
      if (modalVariant === 'watchlist') {
        await store.deleteWatchlistItem(editingId)
      } else {
        if (!window.confirm(`Delete this ${noun} for both of you? Everyone's rankings of it are removed too.`)) return
        await store.deleteItem(editingId)
      }
      closeModal()
    } catch {
      // Keep the modal open on failure.
    }
  }

  // Gate on the first data load (live mode only; the space resolves in App).
  if (configured && store.loading) {
    return <Splash text="Loading your space…" mih="60vh" />
  }

  return (
    <>
      <title>{`${copy.pageTitle} · cajubinile.com`}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        <Box maw={1200} mx="auto">
          {/* Control bar, mirroring the doing-stuff HeaderActions chrome. */}
          <Group
            justify="space-between"
            align="center"
            gap={12}
            wrap="wrap"
            pb={18}
            style={{ borderBottom: `1px dotted ${colors.rule}` }}
          >
            <Group gap={12} align="center" wrap="wrap">
              <SegmentedControl
                value={mode}
                onChange={(value) => setMode(value as Mode)}
                data={[
                  { label: 'Board', value: 'board' },
                  { label: copy.listLabel, value: 'watchlist' },
                ]}
              />
              {mode === 'board' &&
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
                  <Text fz={13} c={colors.muted} style={{ fontFamily: fonts.sans }}>
                    Just your board for now — rankings are per person once your partner joins.
                  </Text>
                ))}
            </Group>
            <Button onClick={openAdd} radius={10}>
              + Add {noun}
            </Button>
          </Group>

          {/* Tag filter pills — only once something on this kind is tagged.
              Multi-select widens the filter (any selected tag matches). */}
          {mode === 'board' && kindTags.length > 0 && (
            <Group gap={8} mt={16} wrap="wrap">
              <Pill label={`All ${noun}s`} active={!filterActive} activeBg={ACCENT} onClick={() => setTagFilter([])} />
              {kindTags.map((tag) => (
                <Pill
                  key={tag.toLowerCase()}
                  label={tag}
                  active={tagFilter.includes(tag)}
                  activeBg={ACCENT}
                  onClick={() => toggleTag(tag)}
                />
              ))}
            </Group>
          )}

          {mode === 'watchlist' ? (
            <>
              {listIsPersonal(kind) && partner && (
                <Text fz={13} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                  Your {copy.listLabel.toLowerCase()} — {partnerName} keeps their own.
                </Text>
              )}
              <Watchlist
                items={watchItems}
                kind={kind}
                watchedDates={watchedDates}
                onCheck={(item) => {
                  void store.checkOffWatchlistItem(item)
                }}
                onUncheck={(id) => {
                  void store.uncheckWatchlistItem(id)
                }}
                onEdit={openEditWatch}
                onDelete={(id) => {
                  void store.deleteWatchlistItem(id)
                }}
              />
            </>
          ) : showingPartner ? (
            <>
              <Text fz={13} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
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
              <Text fz={13} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                Filtered by tag — clear the filter to rearrange.
              </Text>
              <BoardView
                board={board}
                renderCard={(item) => <CardVisual key={item.id} item={item} onClick={() => openEdit(item)} />}
                shelfHint={`No unranked ${noun}s match this tag.`}
                unwatchedHint={`No ${copy.shelfLabel.toLowerCase()} ${noun}s match this tag.`}
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
              onMarkWatched={(itemId: string) => {
                void (personal ? store.setReadOn(itemId, today()) : store.setWatchedOn(itemId, today()))
              }}
              onMarkUnwatched={(itemId: string) => {
                void (personal ? store.setReadOn(itemId, null) : store.setWatchedOn(itemId, null))
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
        </Box>
      </Box>

      <ItemModal
        opened={modalOpen}
        kind={kind}
        draft={draft}
        isEditing={editingId !== null}
        variant={modalVariant}
        tagSuggestions={kindTags}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onSave={saveItem}
        onDelete={deleteEditingItem}
        onClose={closeModal}
      />
    </>
  )
}
