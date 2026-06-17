import { useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Box, Button, Center } from '@mantine/core'
import type { EntryDraft, Screen, SortKey, ViewMode, WishlistItem } from './types'
import { useActivityStore } from './data/useActivityStore'
import { useSession } from './data/useSession'
import { useSpace } from './data/useSpace'
import { computeStats, filterAndSort, joinRows, sortWishlist } from './data/derive'
import { today } from './lib/format'
import { supabase } from './lib/supabase'
import { colors, fonts } from './theme'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { EntryModal } from './components/EntryModal'
import { ManageModal } from './components/ManageModal'
import { Wishlist } from './components/Wishlist'

const APP_TITLE = 'Doing Stuff'
const APP_SUBTITLE = ""

type Modal = 'entry' | 'manage' | null

function emptyDraft(): EntryDraft {
  return { categoryId: '', activityId: '', title: '', date: today(), description: '', rating: 0 }
}

/** Full-screen centered message — used for loading and fatal errors. */
function Splash({ text }: { text: string }) {
  return (
    <Center mih="100vh" bg={colors.pageBg} c={colors.muted} p={24} ta="center" style={{ fontFamily: fonts.sans }}>
      {text}
    </Center>
  )
}

export default function App() {
  const { session, loading, configured } = useSession()

  // While the initial session resolves, hold the screen so we don't flash the
  // login form on a hard reload.
  if (configured && loading) {
    return <Splash text="Loading…" />
  }

  // No keys, or not logged in → show the auth screen. (Without keys, the
  // AuthScreen's calls are no-ops; configure .env.local to enable login.)
  if (configured && !session) {
    return <AuthScreen />
  }

  return <AppShell session={session} configured={configured} />
}

function AppShell({ session, configured }: { session: Session | null; configured: boolean }) {
  const { spaceId, loading: spaceLoading, error: spaceError } = useSpace(session)
  const userId = session?.user.id ?? null
  const store = useActivityStore(spaceId, userId)

  // View state (not persisted).
  const [screen, setScreen] = useState<Screen>('log')
  const [filterCategoryId, setFilterCategoryId] = useState('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [view, setView] = useState<ViewMode>('cards')

  // Modal state.
  const [modal, setModal] = useState<Modal>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft)
  // Set when the entry modal was opened by checking off a wishlist item; on a
  // successful save we link that item to the new entry (marking it done).
  const [pendingWishId, setPendingWishId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const joined = joinRows(store.entries, store.activities, store.categories, store.profiles, userId)
    return filterAndSort(joined, filterCategoryId, sort)
  }, [store.entries, store.activities, store.categories, store.profiles, filterCategoryId, sort, userId])

  const wishlistItems = useMemo(() => sortWishlist(store.wishlist), [store.wishlist])

  const stats = useMemo(() => computeStats(store.entries), [store.entries])

  const openAdd = () => {
    setEditingId(null)
    setPendingWishId(null)
    setDraft(emptyDraft())
    setModal('entry')
  }

  const openEdit = (id: string) => {
    const entry = store.entries.find((e) => e.id === id)
    if (!entry) return
    const activity = store.activities.find((a) => a.id === entry.activityId)
    setEditingId(id)
    setPendingWishId(null)
    setDraft({
      categoryId: activity ? activity.categoryId : '',
      activityId: entry.activityId,
      title: entry.title,
      date: entry.date,
      description: entry.description,
      rating: entry.rating,
    })
    setModal('entry')
  }

  // Checking off a wish opens a new-entry modal prefilled with the wish text;
  // saving will link the wish to the entry (see saveEntry).
  const checkWish = (item: WishlistItem) => {
    setEditingId(null)
    setPendingWishId(item.id)
    setDraft({ ...emptyDraft(), title: item.text })
    setModal('entry')
  }

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setPendingWishId(null)
  }

  const saveEntry = async () => {
    if (!draft.activityId || !draft.rating) return
    try {
      if (editingId) {
        await store.updateEntry(editingId, draft)
      } else {
        const newEntryId = await store.addEntry(draft)
        if (pendingWishId) await store.linkWishlistItem(pendingWishId, newEntryId)
      }
      closeModal()
    } catch {
      // Write failed — keep the modal open; store.error shows the reason.
    }
  }

  const deleteEditingEntry = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    try {
      await store.deleteEntry(editingId)
      closeModal()
    } catch {
      // Keep the modal open on failure.
    }
  }

  // Gate the dashboard on the space + first data load (live mode only).
  if (configured && spaceError) {
    return <Splash text={`Couldn't load your space: ${spaceError}`} />
  }
  if (configured && (spaceLoading || store.loading)) {
    return <Splash text="Loading your space…" />
  }

  return (
    <>
      {supabase && (
        <Button
          variant="white"
          onClick={() => supabase!.auth.signOut()}
          fz={12}
          fw={600}
          radius={9}
          px={12}
          py={7}
          c={colors.muted}
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, border: `1px solid ${colors.cardBorder}` }}
        >
          Sign out
        </Button>
      )}

      {store.error && (
        <Box
          c="oklch(0.45 0.14 25)"
          px={14}
          py={9}
          style={{
            position: 'fixed',
            top: 16,
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
          }}
        >
          {store.error}
        </Box>
      )}

      {screen === 'wishlist' ? (
        <Wishlist
          title={APP_TITLE}
          items={wishlistItems}
          screen={screen}
          onScreenChange={setScreen}
          onNewEntry={openAdd}
          onManage={() => setModal('manage')}
          onCheck={checkWish}
          onUncheck={store.unlinkWishlistItem}
          onAdd={store.addWishlistItem}
          onEdit={store.updateWishlistItem}
          onDelete={store.deleteWishlistItem}
        />
      ) : (
        <Dashboard
          title={APP_TITLE}
          subtitle={APP_SUBTITLE}
          stats={stats}
          categories={store.categories}
          rows={rows}
          screen={screen}
          onScreenChange={setScreen}
          filterCategoryId={filterCategoryId}
          sort={sort}
          view={view}
          onFilter={setFilterCategoryId}
          onSort={setSort}
          onView={setView}
          onAdd={openAdd}
          onManage={() => setModal('manage')}
          onEdit={openEdit}
          onDelete={store.deleteEntry}
        />
      )}

      <EntryModal
        opened={modal === 'entry'}
        draft={draft}
        isEditing={editingId !== null}
        categories={store.categories}
        activities={store.activities}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onSave={saveEntry}
        onDelete={deleteEditingEntry}
        onClose={closeModal}
      />

      <ManageModal
        opened={modal === 'manage'}
        categories={store.categories}
        activities={store.activities}
        onAddActivity={store.addActivity}
        onDeleteActivity={store.deleteActivity}
        onAddCategory={store.addCategory}
        onDeleteCategory={store.deleteCategory}
        onClose={closeModal}
      />
    </>
  )
}
