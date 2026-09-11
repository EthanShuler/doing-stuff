import { lazy, Suspense, useMemo, useState } from 'react'
import { Button, SegmentedControl } from '@mantine/core'
import type { Spoon } from '../../types'
import { useBusy } from '../../lib/useBusy'
import { useConfirm } from '../../components/ConfirmModal'
import { ControlBar } from '../../components/ControlBar'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { Splash } from '../../components/Splash'
import { useSpoonStore } from './useSpoonStore'
import type { SpoonDraft } from './useSpoonStore'
import { sortSpoons, spoonMarkers } from './derive'
import { SpoonGrid } from './SpoonGrid'

// Leaflet only ships to whoever opens the map (module scope — see the note
// in DoingStuffPage).
const SpoonMap = lazy(() => import('./SpoonMap').then((m) => ({ default: m.SpoonMap })))
import { SpoonModal } from './SpoonModal'

type Screen = 'list' | 'map'

const emptyDraft = (): SpoonDraft => ({ name: '', imageUrl: '', place: '', acquiredOn: '', notes: '' })

/** Squabby's souvenir spoon collection: the list and the map of where each
 *  spoon came from. One route (/spoons) with an in-page screen toggle — the
 *  store (and its realtime channel) trivially survives the switch. */
export function SpoonsPage({ spaceId, configured }: { spaceId: string | null; configured: boolean }) {
  const store = useSpoonStore(spaceId)
  const confirm = useConfirm()
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
    if (!(await confirm({ title: 'Delete this spoon?', message: 'Its photo is removed too.' }))) return
    try {
      await store.deleteSpoon(editingId)
      closeModal()
    } catch {
      // Keep the modal open on failure.
    }
  }

  // Only the collection waits on the first load — the control bar stays put.
  const loadingData = configured && store.loading

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

      <PageFrame>
        <ControlBar
          left={
            <SegmentedControl
              value={screen}
              onChange={(value) => setScreen(value as Screen)}
              data={[
                { label: 'Collection', value: 'list' },
                { label: 'Map', value: 'map' },
              ]}
            />
          }
          right={<Button onClick={openAdd}>+ Add spoon</Button>}
        />

        {loadingData ? (
          <Splash text="Loading your space…" mih="40vh" />
        ) : screen === 'map' ? (
          <Suspense fallback={<Splash text="Loading the map…" mih="50vh" />}>
            <SpoonMap markers={markers} onEdit={openEdit} />
          </Suspense>
        ) : (
          <SpoonGrid spoons={sorted} onEdit={openEdit} />
        )}
      </PageFrame>

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
