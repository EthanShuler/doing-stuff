import { useMemo, useState } from 'react'
import { Box, Button, Group, SegmentedControl } from '@mantine/core'
import type { Spoon } from '../../types'
import { colors, fonts } from '../../theme'
import { useBusy } from '../../lib/useBusy'
import { FloatingBanner } from '../../components/FloatingBanner'
import { Splash } from '../../components/Splash'
import { useSpoonStore } from './useSpoonStore'
import type { SpoonDraft } from './useSpoonStore'
import { sortSpoons, spoonMarkers } from './derive'
import { SpoonGrid } from './SpoonGrid'
import { SpoonMap } from './SpoonMap'
import { SpoonModal } from './SpoonModal'

type Screen = 'list' | 'map'

const emptyDraft = (): SpoonDraft => ({ name: '', imageUrl: '', place: '', acquiredOn: '', notes: '' })

/** Squabby's souvenir spoon collection: the list and the map of where each
 *  spoon came from. One route (/spoons) with an in-page screen toggle — the
 *  store (and its realtime channel) trivially survives the switch. */
export function SpoonsPage({ spaceId, configured }: { spaceId: string | null; configured: boolean }) {
  const store = useSpoonStore(spaceId)
  const [screen, setScreen] = useState<Screen>('list')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SpoonDraft>(emptyDraft)

  const sorted = useMemo(() => sortSpoons(store.spoons), [store.spoons])
  const markers = useMemo(() => spoonMarkers(store.spoons), [store.spoons])

  const openAdd = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setModalOpen(true)
  }

  const openEdit = (spoon: Spoon) => {
    setEditingId(spoon.id)
    setDraft({
      name: spoon.name,
      imageUrl: spoon.imageUrl,
      place: spoon.place,
      acquiredOn: spoon.acquiredOn ?? '',
      notes: spoon.notes,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  // addSpoon awaits a geocode before inserting, so an unguarded double-click
  // has a wide window to create duplicate spoons.
  const { busy: saving, run: runSave } = useBusy()
  const saveSpoon = () =>
    runSave(async () => {
      if (!draft.name.trim()) return
      try {
        if (editingId) await store.updateSpoon(editingId, draft)
        else await store.addSpoon(draft)
        closeModal()
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const deleteEditingSpoon = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    if (!window.confirm('Delete this spoon? Its photo is removed too.')) return
    try {
      await store.deleteSpoon(editingId)
      closeModal()
    } catch {
      // Keep the modal open on failure.
    }
  }

  if (configured && store.loading) {
    return <Splash text="Loading your space…" mih="60vh" />
  }

  return (
    <>
      <title>Spoons · cajubinile.com</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />
      <FloatingBanner
        message={store.notice}
        tone="notice"
        top={store.error ? 116 : 68}
        onDismiss={store.clearNotice}
      />

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        <Box maw={1200} mx="auto">
          <Group
            justify="space-between"
            align="center"
            gap={12}
            wrap="wrap"
            pb={18}
            style={{ borderBottom: `1px dotted ${colors.rule}` }}
          >
            <SegmentedControl
              value={screen}
              onChange={(value) => setScreen(value as Screen)}
              data={[
                { label: 'Collection', value: 'list' },
                { label: 'Map', value: 'map' },
              ]}
            />
            <Button onClick={openAdd} radius={10}>
              + Add spoon
            </Button>
          </Group>

          {screen === 'map' ? (
            <SpoonMap markers={markers} onEdit={openEdit} />
          ) : (
            <SpoonGrid spoons={sorted} onEdit={openEdit} />
          )}
        </Box>
      </Box>

      <SpoonModal
        opened={modalOpen}
        draft={draft}
        isEditing={editingId !== null}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onUpload={store.uploadPhoto}
        saving={saving}
        onSave={() => void saveSpoon()}
        onDelete={() => void deleteEditingSpoon()}
        onClose={closeModal}
      />
    </>
  )
}
