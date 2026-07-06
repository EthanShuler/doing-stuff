import { useMemo, useState } from 'react'
import { Box, Center } from '@mantine/core'
import { useNavigate } from 'react-router'
import type { EntryDraft, Screen, SortKey, ViewMode, WishlistItem } from '../../types'
import { useActivityStore } from './useActivityStore'
import { calendarDays, computeStats, filterAndSort, joinRows, mapMarkers, sortWishlist, wishMarkers } from './derive'
import { currentYearMonth, today } from '../../lib/format'
import type { YearMonth } from '../../lib/format'
import { colors, fonts } from '../../theme'
import { Dashboard } from './Dashboard'
import { EntryModal } from './EntryModal'
import { RepeatModal } from './RepeatModal'
import { ManageModal } from './ManageModal'
import { MapView } from './MapView'
import { CalendarView } from './CalendarView'
import { Wishlist } from './Wishlist'
import { HeaderActions } from './HeaderActions'

type Modal = 'entry' | 'manage' | 'repeat' | null

/** Each doing-stuff screen is its own route so the URL survives reloads. */
const SCREEN_PATHS: Record<Screen, string> = {
  log: '/',
  wishlist: '/wishlist',
  map: '/map',
  calendar: '/calendar',
}

function emptyDraft(): EntryDraft {
  return { categoryId: '', activityId: '', title: '', date: today(), description: '', rating: 0, address: '', hideFromMap: false }
}

interface DoingStuffPageProps {
  screen: Screen
  spaceId: string | null
  userId: string | null
  configured: boolean
}

/** The original activity tracker — Log / Wishlist / Map / Calendar. Owns the
 *  activity store, all modal state, and the derive wiring; the shell above it
 *  only provides chrome. All four routes render this same component, so the
 *  store (and its realtime channel) survives switching screens. */
export function DoingStuffPage({ screen, spaceId, userId, configured }: DoingStuffPageProps) {
  const store = useActivityStore(spaceId, userId)
  const navigate = useNavigate()
  const setScreen = (next: Screen) => navigate(SCREEN_PATHS[next])

  // View state (not persisted).
  const [filterCategoryId, setFilterCategoryId] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [view, setView] = useState<ViewMode>('cards')
  const [calendarMonth, setCalendarMonth] = useState<YearMonth>(currentYearMonth)

  // Modal state.
  const [modal, setModal] = useState<Modal>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft)
  // Set when the entry modal was opened by checking off a wishlist item; on a
  // successful save we link that item to the new entry (marking it done).
  const [pendingWishId, setPendingWishId] = useState<string | null>(null)
  // Entry whose repeat modal is open.
  const [repeatEntryId, setRepeatEntryId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const joined = joinRows(store.entries, store.activities, store.categories, store.profiles, userId, store.repeats)
    return filterAndSort(joined, filterCategoryId, sort, search)
  }, [store.entries, store.activities, store.categories, store.profiles, store.repeats, filterCategoryId, sort, search, userId])

  const wishlistItems = useMemo(() => sortWishlist(store.wishlist), [store.wishlist])

  const stats = useMemo(() => computeStats(store.entries, store.repeats), [store.entries, store.repeats])

  // Logged-entry pins plus open-wish ⭐ pins, drawn on the same map.
  const markers = useMemo(
    () => [
      ...mapMarkers(store.entries, store.activities, store.categories),
      ...wishMarkers(store.wishlist),
    ],
    [store.entries, store.activities, store.categories, store.wishlist],
  )

  const calendarGrid = useMemo(
    () => calendarDays(calendarMonth, store.entries, store.repeats, store.activities, store.categories, filterCategoryId),
    [calendarMonth, store.entries, store.repeats, store.activities, store.categories, filterCategoryId],
  )

  const openAdd = (date?: string) => {
    setEditingId(null)
    setPendingWishId(null)
    setDraft(date ? { ...emptyDraft(), date } : emptyDraft())
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
      address: entry.address,
      hideFromMap: entry.hideFromMap,
    })
    setModal('entry')
  }

  // Checking off a wish opens a new-entry modal prefilled with the wish text;
  // saving will link the wish to the entry (see saveEntry).
  const checkWish = (item: WishlistItem) => {
    setEditingId(null)
    setPendingWishId(item.id)
    // Carry the wish's place into the entry; it re-geocodes on save.
    setDraft({ ...emptyDraft(), title: item.text, address: item.address })
    setModal('entry')
  }

  const openRepeat = (id: string) => {
    setRepeatEntryId(id)
    setModal('repeat')
  }

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setPendingWishId(null)
    setRepeatEntryId(null)
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

  const confirmDeleteEntry = () =>
    window.confirm('Delete this entry? Any repeats logged on it are deleted too.')

  const deleteRow = (id: string) => {
    if (!confirmDeleteEntry()) return
    store.deleteEntry(id).catch(() => {
      // Failure surfaces via the store.error banner.
    })
  }

  const deleteEditingEntry = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    if (!confirmDeleteEntry()) return
    try {
      await store.deleteEntry(editingId)
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

      {store.notice && (
        <Box
          c="oklch(0.42 0.07 75)"
          px={14}
          py={9}
          onClick={store.clearNotice}
          style={{
            position: 'fixed',
            top: store.error ? 116 : 68,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            maxWidth: 'min(92vw, 520px)',
            border: '1px solid rgba(160,120,40,0.35)',
            borderRadius: 9,
            background: 'oklch(0.96 0.05 85)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: fonts.sans,
            boxShadow: '0 8px 24px rgba(40,30,20,0.14)',
            cursor: 'pointer',
          }}
        >
          {store.notice}
          <span style={{ marginLeft: 10, color: colors.faint }}>✕</span>
        </Box>
      )}

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        {/* The control bar keeps a constant width so the nav doesn't shift
            between screens; only the content below may widen (the map). */}
        <Box maw={960} mx="auto">
          <HeaderActions
            screen={screen}
            onScreenChange={setScreen}
            onManage={() => setModal('manage')}
            onAdd={() => openAdd()}
          />
        </Box>

        <Box maw={screen === 'map' ? 1100 : 960} mx="auto">
          {screen === 'wishlist' ? (
            <Wishlist
              items={wishlistItems}
              onCheck={checkWish}
              onUncheck={store.unlinkWishlistItem}
              onAdd={store.addWishlistItem}
              onEdit={store.updateWishlistItem}
              onSetAddress={store.setWishlistAddress}
              onDelete={store.deleteWishlistItem}
            />
          ) : screen === 'map' ? (
            <MapView
              home={store.home}
              categories={store.categories}
              markers={markers}
              onEditEntry={openEdit}
            />
          ) : screen === 'calendar' ? (
            <CalendarView
              categories={store.categories}
              filterCategoryId={filterCategoryId}
              onFilter={setFilterCategoryId}
              days={calendarGrid}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onToday={() => setCalendarMonth(currentYearMonth())}
              onNewEntry={openAdd}
              onEditEntry={openEdit}
            />
          ) : (
            <Dashboard
              stats={stats}
              categories={store.categories}
              rows={rows}
              filterCategoryId={filterCategoryId}
              search={search}
              sort={sort}
              view={view}
              onFilter={setFilterCategoryId}
              onSearch={setSearch}
              onSort={setSort}
              onView={setView}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={deleteRow}
              onRepeat={openRepeat}
            />
          )}
        </Box>
      </Box>

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

      {(() => {
        const entry = repeatEntryId ? store.entries.find((e) => e.id === repeatEntryId) : null
        const title = entry ? entry.title || store.activities.find((a) => a.id === entry.activityId)?.name || 'this outing' : ''
        return (
          <RepeatModal
            opened={modal === 'repeat'}
            entryTitle={title}
            firstDate={entry ? entry.date : today()}
            repeats={entry ? store.repeats.filter((r) => r.entryId === entry.id) : []}
            onAdd={(date) => entry && store.addRepeat(entry.id, date).catch(() => {})}
            onRemove={(repeatId) => store.deleteRepeat(repeatId).catch(() => {})}
            onClose={closeModal}
          />
        )
      })()}

      <ManageModal
        opened={modal === 'manage'}
        categories={store.categories}
        activities={store.activities}
        home={store.home}
        onAddActivity={store.addActivity}
        onDeleteActivity={store.deleteActivity}
        onSetActivityEmoji={store.setActivityEmoji}
        onAddCategory={store.addCategory}
        onDeleteCategory={store.deleteCategory}
        onSetHome={store.setHome}
        onClose={closeModal}
      />
    </>
  )
}
