import { useMemo, useState } from 'react'
import type { EntryDraft, SortKey, ViewMode } from './types'
import { useActivityStore } from './data/useActivityStore'
import { useSession } from './data/useSession'
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

export default function App() {
  const { session, loading, configured } = useSession()

  // While the initial session resolves, hold the screen so we don't flash the
  // login form on a hard reload.
  if (configured && loading) {
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
        }}
      >
        Loading…
      </div>
    )
  }

  // No keys, or not logged in → show the auth screen. (Without keys, the
  // AuthScreen's calls are no-ops; configure .env.local to enable login.)
  if (configured && !session) {
    return <AuthScreen />
  }

  return <AppShell />
}

function AppShell() {
  const store = useActivityStore()

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

  const saveEntry = () => {
    if (!draft.activityId || !draft.rating) return
    if (editingId) {
      store.updateEntry(editingId, draft)
    } else {
      store.addEntry(draft)
    }
    closeModal()
  }

  const deleteEditingEntry = () => {
    if (editingId) store.deleteEntry(editingId)
    closeModal()
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
