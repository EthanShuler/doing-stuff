import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Box } from '@mantine/core'
import { useNavigate } from 'react-router'
import type { EntryDraft, Screen, SortKey, ViewMode, WishlistItem } from '../../types'
import { useActivityStore } from './useActivityStore'
import { calendarDays, computeStats, filterAndSort, joinRows, mapMarkers, sortWishlist, wishMarkers } from './derive'
import { currentYearMonth, formatDate, today } from '../../lib/format'
import { useBusy } from '../../lib/useBusy'
import type { YearMonth } from '../../lib/format'
import { useConfirm } from '../../components/ConfirmModal'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame, PAGE_MAX_WIDTH } from '../../components/PageFrame'
import { Splash } from '../../components/Splash'
import { Dashboard } from './Dashboard'
import { EntryModal } from './EntryModal'
import { RepeatModal } from './RepeatModal'
import { ManageModal } from './ManageModal'

// Leaflet (JS + its stylesheet) is a big dependency only the map screen
// needs, so it loads on demand. Module scope: a lazy() per render would
// remount the map — and refit its bounds — on every state change.
const MapView = lazy(() => import('./MapView').then((m) => ({ default: m.MapView })))
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
  const confirm = useConfirm()
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
  // The entry a check-off already created when its link write then failed:
  // a retry updates that entry and re-links instead of logging a duplicate.
  // Cleared whenever the modal closes.
  const checkOffEntry = useRef<{ wishId: string; entryId: string } | null>(null)
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
    checkOffEntry.current = null
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
    checkOffEntry.current = null
  }

  // addEntry awaits a geocode before inserting, so an unguarded double-click
  // has a wide window to create duplicate entries.
  const { busy: saving, run: runSave } = useBusy()
  const saveEntry = () =>
    runSave(async () => {
      if (!draft.activityId || !draft.rating) return
      try {
        if (editingId) {
          await store.updateEntry(editingId, draft)
        } else if (pendingWishId) {
          // Reuse this attempt's entry if it's still around (a partner could
          // have deleted it in the meantime).
          const prior = checkOffEntry.current
          let entryId: string
          if (prior && prior.wishId === pendingWishId && store.entries.some((e) => e.id === prior.entryId)) {
            entryId = prior.entryId
            await store.updateEntry(entryId, draft)
          } else {
            entryId = await store.addEntry(draft)
            checkOffEntry.current = { wishId: pendingWishId, entryId }
          }
          await store.linkWishlistItem(pendingWishId, entryId)
        } else {
          await store.addEntry(draft)
        }
        closeModal()
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const confirmDeleteEntry = () =>
    confirm({ title: 'Delete this entry?', message: 'Any repeats logged on it are deleted too.' })

  const deleteRow = async (id: string) => {
    if (!(await confirmDeleteEntry())) return
    store.deleteEntry(id).catch(() => {
      // Failure surfaces via the store.error banner.
    })
  }

  // Wishes are shared data and a wish is easy to mis-tap next to the 📍
  // button, so removing one asks first — same as entries.
  const deleteWish = async (id: string) => {
    const wish = store.wishlist.find((w) => w.id === id)
    if (!(await confirm({ title: 'Remove this wish?', message: wish ? `"${wish.text}" comes off the list for both of you.` : undefined })))
      return
    store.deleteWishlistItem(id)
  }

  // A repeat is logged shared data behind a small "Remove" link, so it asks
  // first like every other delete.
  const deleteRepeat = async (repeatId: string) => {
    const repeat = store.repeats.find((r) => r.id === repeatId)
    const message = repeat ? `The ${formatDate(repeat.date)} visit comes off this entry for both of you.` : undefined
    if (!(await confirm({ title: 'Remove this repeat?', message }))) return
    store.deleteRepeat(repeatId).catch(() => {
      // Failure surfaces via the store.error banner.
    })
  }

  const deleteEditingEntry = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    if (!(await confirmDeleteEntry())) return
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
  // The control bar below renders either way — only the content waits.
  const loadingData = configured && store.loading

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

      {/* The map screen is the only one allowed to outgrow the reading
          column; its control bar stays at PAGE_MAX_WIDTH so the chrome
          doesn't shift when you switch screens. */}
      <PageFrame maw={screen === 'map' ? 1600 : PAGE_MAX_WIDTH}>
        <Box maw={PAGE_MAX_WIDTH} mx="auto">
          <HeaderActions
            screen={screen}
            onScreenChange={setScreen}
            onManage={() => setModal('manage')}
            onAdd={() => openAdd()}
          />
        </Box>

        {loadingData ? (
          <Splash text="Loading your space…" mih="40vh" />
        ) : (
          <>
            {screen === 'wishlist' ? (
              <Wishlist
                items={wishlistItems}
                onCheck={checkWish}
                onUncheck={store.unlinkWishlistItem}
                onAdd={store.addWishlistItem}
                onEdit={store.updateWishlistItem}
                onSetAddress={store.setWishlistAddress}
                onDelete={deleteWish}
              />
            ) : screen === 'map' ? (
              <Suspense fallback={<Splash text="Loading the map…" mih="50vh" />}>
                <MapView
                  home={store.home}
                  categories={store.categories}
                  markers={markers}
                  onEditEntry={openEdit}
                />
              </Suspense>
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
                onDelete={(id) => void deleteRow(id)}
                onRepeat={openRepeat}
              />
            )}
          </>
        )}
      </PageFrame>

      <EntryModal
        opened={modal === 'entry'}
        draft={draft}
        isEditing={editingId !== null}
        categories={store.categories}
        activities={store.activities}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        saving={saving}
        onSave={saveEntry}
        onDelete={deleteEditingEntry}
        onClose={closeModal}
      />

      <RepeatModal
        opened={modal === 'repeat'}
        entryTitle={repeatTitle}
        firstDate={repeatEntry ? repeatEntry.date : today()}
        repeats={repeatEntry ? store.repeats.filter((r) => r.entryId === repeatEntry.id) : []}
        onAdd={(date) => (repeatEntry ? store.addRepeat(repeatEntry.id, date) : Promise.resolve())}
        onRemove={(repeatId) => void deleteRepeat(repeatId)}
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
