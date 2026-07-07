import { useMemo, useState } from 'react'
import { Box, Button, Center, Group, SegmentedControl, Text } from '@mantine/core'
import type { Tier, TierItem, TierKind, WatchlistItem } from '../../types'
import { colors, fonts } from '../../theme'
import { today } from '../../lib/format'
import { useTierListStore } from './useTierListStore'
import { deriveBoard } from './derive'
import { TierBoard } from './TierBoard'
import { BoardView } from './BoardView'
import { CardVisual } from './TierCard'
import { Watchlist } from './Watchlist'
import { ItemModal } from './ItemModal'
import type { ItemDraft } from './ItemModal'

type Mode = 'board' | 'watchlist'

const KIND_NOUN: Record<TierKind, string> = { movie: 'movie', tv: 'show' }

// A board add is "we just watched this" → default the date to today. Watchlist
// items aren't watched yet, so their draft leaves it blank (and hides the field).
const emptyDraft = (variant: Mode): ItemDraft => ({
  title: '',
  imageUrl: '',
  watchedOn: variant === 'board' ? today() : '',
})

const segmentedStyles = {
  root: { background: colors.chip, border: '1px solid rgba(120,100,80,0.12)', padding: 3 },
  label: { fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: colors.muted },
} as const

interface TierListPageProps {
  kind: TierKind
  spaceId: string | null
  userId: string | null
  configured: boolean
}

/** The movie/TV tier lists. Both routes render this same component (same tree
 *  position), so the store — and its realtime channel — survives switching
 *  between Movies and TV; only the `kind` prop changes and the board re-derives. */
export function TierListPage({ kind, spaceId, userId, configured }: TierListPageProps) {
  const store = useTierListStore(spaceId, userId)
  const noun = KIND_NOUN[kind]

  // Board (tier ranking) vs. Watchlist (things we want to watch). Both live in
  // the same tab; the store survives the switch just like Movies ↔ TV.
  const [mode, setMode] = useState<Mode>('board')

  // Whose board is showing. Yours is drag-and-drop; the partner's renders the
  // same layout read-only (their placements are also read-only under RLS).
  const [viewer, setViewer] = useState<'you' | 'partner'>('you')
  const partner = store.profiles.find((p) => p.id !== store.selfId && p.id !== null) ?? null
  const partnerName = partner?.displayName || (partner?.email ? partner.email.split('@')[0] : 'Partner')
  const showingPartner = viewer === 'partner' && partner !== null

  // Modal state. `variant` selects the save path: a board add/edit writes to the
  // tier pool; a watchlist add/edit writes to `watchlist_items`.
  const [modalOpen, setModalOpen] = useState(false)
  const [modalVariant, setModalVariant] = useState<Mode>('board')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft>(() => emptyDraft('board'))

  // The watchlist for this kind: open items first, then checked-off ones.
  const watchItems = useMemo(() => {
    const mine = store.watchlist.filter((w) => w.kind === kind)
    const rank = (w: WatchlistItem) => (w.tierItemId === null ? 0 : 1)
    return [...mine].sort((a, b) =>
      rank(a) !== rank(b) ? rank(a) - rank(b) : a.createdAt < b.createdAt ? -1 : 1,
    )
  }, [store.watchlist, kind])

  // Watched date per tier item id, for the checked-off watchlist rows (the
  // wish itself has no date — the tier item it produced carries it).
  const watchedDates = useMemo(
    () => new Map(store.items.map((item) => [item.id, item.watchedOn])),
    [store.items],
  )

  const viewerId = showingPartner ? partner.id : store.selfId
  const board = useMemo(
    () => deriveBoard(store.items, store.placements, viewerId, kind),
    [store.items, store.placements, viewerId, kind],
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
    setDraft({ title: item.title, imageUrl: item.imageUrl, watchedOn: item.watchedOn ?? '' })
    setModalOpen(true)
  }

  const openEditWatch = (item: WatchlistItem) => {
    setModalVariant('watchlist')
    setEditingId(item.id)
    setDraft({ title: item.title, imageUrl: item.imageUrl, watchedOn: '' })
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
        const watchedOn = draft.watchedOn || null
        if (editingId) await store.updateItem(editingId, draft.title, draft.imageUrl, watchedOn)
        else await store.addItem(kind, draft.title, draft.imageUrl, watchedOn)
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
    return (
      <Center mih="60vh" c={colors.muted} p={24} ta="center" style={{ fontFamily: fonts.sans }}>
        Loading your space…
      </Center>
    )
  }

  return (
    <>
      {store.error && (
        <Box
          c="oklch(0.45 0.14 25)"
          px={14}
          py={9}
          onClick={store.clearError}
          style={{
            position: 'fixed',
            top: 68,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            maxWidth: 'min(92vw, 520px)',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 9,
            background: 'oklch(0.96 0.04 25)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: fonts.sans,
            boxShadow: '0 8px 24px rgba(40,30,20,0.14)',
            cursor: 'pointer',
          }}
        >
          {store.error}
          <span style={{ marginLeft: 10, color: colors.faint }}>✕</span>
        </Box>
      )}

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        <Box maw={960} mx="auto">
          {/* Control bar, mirroring the doing-stuff HeaderActions chrome. */}
          <Group
            justify="space-between"
            align="center"
            gap={12}
            wrap="wrap"
            pb={18}
            style={{ borderBottom: '1px dotted rgba(120,100,80,0.4)' }}
          >
            <Group gap={12} align="center" wrap="wrap">
              <SegmentedControl
                value={mode}
                onChange={(value) => setMode(value as Mode)}
                data={[
                  { label: 'Board', value: 'board' },
                  { label: 'Watchlist', value: 'watchlist' },
                ]}
                radius={9}
                styles={segmentedStyles}
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
                    radius={9}
                    styles={segmentedStyles}
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

          {mode === 'watchlist' ? (
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
          ) : showingPartner ? (
            <>
              <Text fz={13} c={colors.faint} mt={16} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                {partnerName}'s board — just for looking.
              </Text>
              <BoardView
                board={board}
                renderCard={(item) => <CardVisual key={item.id} item={item} />}
                shelfHint={`${partnerName} hasn't ranked everything yet.`}
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
              onCardClick={openEdit}
              shelfHint={
                board.unranked.length === 0 &&
                Object.values(board.tiers).every((t) => t.length === 0)
                  ? `No ${noun}s yet — add one, or check something off your watchlist.`
                  : 'Everything is ranked. Nice.'
              }
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
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onSave={saveItem}
        onDelete={deleteEditingItem}
        onClose={closeModal}
      />
    </>
  )
}
