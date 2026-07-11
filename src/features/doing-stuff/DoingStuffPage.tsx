import { useMemo, useState } from 'react'
import { Box } from '@mantine/core'
import { useNavigate } from 'react-router'
import type { EntryDraft, Screen, SortKey, ViewMode, WishlistItem } from '../../types'
import { useActivityStore } from './useActivityStore'
import { calendarDays, computeStats, filterAndSort, joinRows, mapMarkers, sortWishlist, wishMarkers } from './derive'
import { currentYearMonth, today } from '../../lib/format'
import type { YearMonth } from '../../lib/format'
import { colors, fonts } from '../../theme'
import { FloatingBanner } from '../../components/FloatingBanner'
import { Splash } from '../../components/Splash'
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

/** Browser-tab titles (React 19 hoists a rendered <title> into <head>). */
const SCREEN_TITLES: Record<Screen, string> = {
  log: 'Doing Stuff',
  wishlist: 'Wishlist',
  map: 'Map',
  calendar: 'Calendar',
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
  const [rawFilterCategoryId, setFilterCategoryId] = useState('all')
  // Deleting a category (locally or via a partner's realtime delete) can leave
  // the filter pointing at nothing — fall back to 'all', not an empty view.
  const filterCategoryId =
    rawFilterCategoryId === 'all' || store.categories.some((c) => c.id === rawFilterCategoryId)
      ? rawFilterCategoryId
      : 'all'
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

  // The entry behind the open repeat modal, and its display title.
  const repeatEntry = (repeatEntryId && store.entries.find((e) => e.id === repeatEntryId)) || null
  const repeatTitle = repeatEntry
    ? repeatEntry.title || store.activities.find((a) => a.id === repeatEntry.activityId)?.name || 'this outing'
    : ''

  // Gate on the first data load (live mode only; the space resolves in App).
  if (configured && store.loading) {
    return <Splash text="Loading your space…" mih="60vh" />
  }

  return (
    <>
      <title>{`${SCREEN_TITLES[screen]} · cajubinile.com`}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />
      <FloatingBanner
        message={store.notice}
        tone="notice"
        top={store.error ? 116 : 68}
        onDismiss={store.clearNotice}
      />

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        {/* The control bar keeps a constant width so the nav doesn't shift
            between screens; only the content below may widen (the map). */}
        <Box maw={1200} mx="auto">
          <HeaderActions
            screen={screen}
            onScreenChange={setScreen}
            onManage={() => setModal('manage')}
            onAdd={() => openAdd()}
          />
        </Box>

        <Box maw={screen === 'map' ? 1600 : 1200} mx="auto">
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

      <RepeatModal
        opened={modal === 'repeat'}
        entryTitle={repeatTitle}
        firstDate={repeatEntry ? repeatEntry.date : today()}
        repeats={repeatEntry ? store.repeats.filter((r) => r.entryId === repeatEntry.id) : []}
        onAdd={(date) => repeatEntry && store.addRepeat(repeatEntry.id, date).catch(() => {})}
        onRemove={(repeatId) => store.deleteRepeat(repeatId).catch(() => {})}
        onClose={closeModal}
      />

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
