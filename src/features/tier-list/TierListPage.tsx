import { useMemo, useState } from 'react'
import { Box, Button, Center, Group, SegmentedControl, Text } from '@mantine/core'
import type { Tier, TierItem, TierKind } from '../../types'
import { colors, fonts } from '../../theme'
import { useTierListStore } from './useTierListStore'
import { deriveBoard } from './derive'
import { TierBoard } from './TierBoard'
import { BoardView } from './BoardView'
import { CardVisual } from './TierCard'
import { ItemModal } from './ItemModal'
import type { ItemDraft } from './ItemModal'

const KIND_NOUN: Record<TierKind, string> = { movie: 'movie', tv: 'show' }

const emptyDraft = (): ItemDraft => ({ title: '', imageUrl: '' })

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

  // Whose board is showing. Yours is drag-and-drop; the partner's renders the
  // same layout read-only (their placements are also read-only under RLS).
  const [viewer, setViewer] = useState<'you' | 'partner'>('you')
  const partner = store.profiles.find((p) => p.id !== store.selfId && p.id !== null) ?? null
  const partnerName = partner?.displayName || (partner?.email ? partner.email.split('@')[0] : 'Partner')
  const showingPartner = viewer === 'partner' && partner !== null

  // Modal state.
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft)

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

  const openAdd = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setModalOpen(true)
  }

  const openEdit = (item: TierItem) => {
    setEditingId(item.id)
    setDraft({ title: item.title, imageUrl: item.imageUrl })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const saveItem = async () => {
    if (!draft.title.trim()) return
    try {
      if (editingId) await store.updateItem(editingId, draft.title, draft.imageUrl)
      else await store.addItem(kind, draft.title, draft.imageUrl)
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
    if (!window.confirm(`Delete this ${noun} for both of you? Everyone's rankings of it are removed too.`)) return
    try {
      await store.deleteItem(editingId)
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
            {partner ? (
              <SegmentedControl
                value={viewer}
                onChange={(value) => setViewer(value as 'you' | 'partner')}
                data={[
                  { label: 'You', value: 'you' },
                  { label: partnerName, value: 'partner' },
                ]}
                radius={9}
                styles={{
                  root: { background: colors.chip, border: '1px solid rgba(120,100,80,0.12)', padding: 3 },
                  label: { fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: colors.muted },
                }}
              />
            ) : (
              <Text fz={13} c={colors.muted} style={{ fontFamily: fonts.sans }}>
                Just your board for now — rankings are per person once your partner joins.
              </Text>
            )}
            <Button onClick={openAdd} radius={10}>
              + Add {noun}
            </Button>
          </Group>

          {showingPartner ? (
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
                  ? `No ${noun}s yet — add your first with the button above.`
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
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onSave={saveItem}
        onDelete={deleteEditingItem}
        onClose={closeModal}
      />
    </>
  )
}
