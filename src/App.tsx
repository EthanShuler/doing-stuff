import { useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { EntryDraft, SortKey, ViewMode } from './types'
import { useActivityStore } from './data/useActivityStore'
import { useSession } from './data/useSession'
import { useSpace } from './data/useSpace'
import { computeStats, filterAndSort, joinRows } from './data/derive'
import { today } from './lib/format'
import { supabase } from './lib/supabase'
import { colors, fonts } from './theme'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { EntryModal } from './components/EntryModal'
import { ManageModal } from './components/ManageModal'

const APP_TITLE = 'Doing Stuff'
const APP_SUBTITLE = "Things we've done together"

type Modal = 'entry' | 'manage' | null

function emptyDraft(): EntryDraft {
  return { categoryId: '', activityId: '', title: '', date: today(), description: '', rating: 0 }
}

/** Full-screen centered message — used for loading and fatal errors. */
function Splash({ text }: { text: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.pageBg,
        fontFamily: fonts.sans,
        color: colors.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
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
  const store = useActivityStore(spaceId)

  // View state (not persisted).
  const [filterCategoryId, setFilterCategoryId] = useState('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [view, setView] = useState<ViewMode>('cards')

  // Modal state.
  const [modal, setModal] = useState<Modal>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft)

  const rows = useMemo(() => {
    const joined = joinRows(store.entries, store.activities, store.categories)
    return filterAndSort(joined, filterCategoryId, sort)
  }, [store.entries, store.activities, store.categories, filterCategoryId, sort])

  const stats = useMemo(() => computeStats(store.entries), [store.entries])

  const openAdd = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setModal('entry')
  }

  const openEdit = (id: string) => {
    const entry = store.entries.find((e) => e.id === id)
    if (!entry) return
    const activity = store.activities.find((a) => a.id === entry.activityId)
    setEditingId(id)
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

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
  }

  const saveEntry = async () => {
    if (!draft.activityId || !draft.rating) return
    try {
      if (editingId) {
        await store.updateEntry(editingId, draft)
      } else {
        await store.addEntry(draft)
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
        <button
          type="button"
          onClick={() => supabase!.auth.signOut()}
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 50,
            padding: '7px 12px',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 9,
            background: '#fff',
            color: colors.muted,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: fonts.sans,
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      )}

      {store.error && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            maxWidth: 'min(92vw, 520px)',
            padding: '9px 14px',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 9,
            background: 'oklch(0.96 0.04 25)',
            color: 'oklch(0.45 0.14 25)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: fonts.sans,
            boxShadow: '0 8px 24px rgba(40,30,20,0.14)',
          }}
        >
          {store.error}
        </div>
      )}

      <Dashboard
        title={APP_TITLE}
        subtitle={APP_SUBTITLE}
        stats={stats}
        categories={store.categories}
        rows={rows}
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

      {modal === 'entry' && (
        <EntryModal
          draft={draft}
          isEditing={editingId !== null}
          categories={store.categories}
          activities={store.activities}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          onSave={saveEntry}
          onDelete={deleteEditingEntry}
          onClose={closeModal}
        />
      )}

      {modal === 'manage' && (
        <ManageModal
          categories={store.categories}
          activities={store.activities}
          onAddActivity={store.addActivity}
          onDeleteActivity={store.deleteActivity}
          onAddCategory={store.addCategory}
          onDeleteCategory={store.deleteCategory}
          onClose={closeModal}
        />
      )}
    </>
  )
}
