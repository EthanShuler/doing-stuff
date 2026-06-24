import { useCallback, useEffect, useRef, useState } from 'react'
import type { Activity, Category, Entry, EntryDraft, Home, Profile, Repeat, WishlistItem } from '../types'
import { supabase } from '../lib/supabase'
import { today } from '../lib/format'
import { geocode } from '../lib/geocode'

// The app's single source of domain data (categories / activities / entries).
//
// Two modes, one interface:
//   • Supabase keys present → live: fetches and mutates the database, scoped to
//     the caller's `spaceId`. Row Level Security enforces who can see what.
//   • No keys → falls back to an in-memory seed (the original Compass demo data)
//     so the UI can be developed without a backend. Edits are lost on reload.
//
// The action signatures are identical in both modes, so components never change.

interface SeedData {
  categories: Category[]
  activities: Activity[]
  entries: Entry[]
  repeats: Repeat[]
  profiles: Profile[]
  wishlist: WishlistItem[]
  home: Home
}

const EMPTY_HOME: Home = { address: '', lat: null, lng: null }

function seed(): SeedData {
  return {
    // A demo center + a few pre-geocoded pins so the map works in keyless mode.
    home: { address: 'Portland, OR', lat: 45.5152, lng: -122.6784 },
    profiles: [
      { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
      { id: 'u2', email: 'jordan@example.com', displayName: 'Jordan' },
    ],
    wishlist: [
      { id: 'w1', text: 'Sunrise hike up Eagle Ridge', entryId: null, createdBy: 'u1', createdAt: '2026-06-02T09:00:00Z' },
      { id: 'w2', text: 'Try the new ramen place downtown', entryId: null, createdBy: 'u2', createdAt: '2026-06-05T09:00:00Z' },
      { id: 'w3', text: 'Visit the botanical garden', entryId: null, createdBy: 'u1', createdAt: '2026-06-09T09:00:00Z' },
    ],
    categories: [
      { id: 'c1', name: 'Outdoor', colorIndex: 0 },
      { id: 'c2', name: 'City', colorIndex: 1 },
      { id: 'c3', name: 'Brain', colorIndex: 2 },
    ],
    activities: [
      { id: 'a1', categoryId: 'c1', name: 'Park', emoji: '🌳' },
      { id: 'a2', categoryId: 'c1', name: 'Swimming', emoji: '🏊' },
      { id: 'a3', categoryId: 'c1', name: 'Backpacking', emoji: '🎒' },
      { id: 'a4', categoryId: 'c2', name: 'Movie', emoji: '🎬' },
      { id: 'a5', categoryId: 'c2', name: 'Restaurant', emoji: '🍝' },
      { id: 'a6', categoryId: 'c2', name: 'Book store', emoji: '📚' },
      { id: 'a7', categoryId: 'c3', name: 'ASL learning', emoji: '🤟' },
      { id: 'a8', categoryId: 'c3', name: 'Piano lesson', emoji: '🎹' },
    ],
    entries: [
      { id: 'i1', activityId: 'a1', title: 'Riverside picnic', date: '2026-06-12', description: 'Golden hour picnic and a long walk by the water.', rating: 5, createdBy: 'u1', address: 'Tom McCall Waterfront Park, Portland, OR', lat: 45.5176, lng: -122.6708, hideFromMap: false },
      { id: 'i2', activityId: 'a5', title: 'Dinner at Tabella', date: '2026-06-08', description: 'Shared the cacio e pepe. Cozy corner table.', rating: 4, createdBy: 'u2', address: '', lat: null, lng: null, hideFromMap: false },
      { id: 'i3', activityId: 'a7', title: 'ASL — Lesson 4', date: '2026-06-03', description: 'Finally got the alphabet down. Practiced over coffee.', rating: 4, createdBy: 'u1', address: '', lat: null, lng: null, hideFromMap: false },
      { id: 'i4', activityId: 'a3', title: 'Pine Ridge overnight', date: '2026-05-30', description: 'Overnight on the trail. Tough climb, worth it.', rating: 5, createdBy: 'u2', address: 'Forest Park, Portland, OR', lat: 45.5786, lng: -122.7565, hideFromMap: false },
      { id: 'i5', activityId: 'a4', title: 'Sci-fi at the Roxy', date: '2026-06-10', description: 'Saw the new release. Split a popcorn.', rating: 3, createdBy: 'u1', address: '', lat: null, lng: null, hideFromMap: false },
      { id: 'i6', activityId: 'a2', title: 'Morning laps', date: '2026-06-14', description: 'Early swim at the community pool.', rating: 4, createdBy: 'u2', address: '', lat: null, lng: null, hideFromMap: false },
      { id: 'i7', activityId: 'a8', title: 'Clair de Lune, pt. 1', date: '2026-05-22', description: 'Learned the first half of the piece.', rating: 4, createdBy: 'u1', address: '', lat: null, lng: null, hideFromMap: false },
      { id: 'i8', activityId: 'a6', title: 'Vellum & Vine browse', date: '2026-06-01', description: 'Browsed an hour. Found a poetry collection.', rating: 5, createdBy: 'u2', address: 'Powell\'s City of Books, Portland, OR', lat: 45.5232, lng: -122.6819, hideFromMap: false },
    ],
    // A couple of repeats so the repeated-entry UI shows in keyless dev mode.
    repeats: [
      { id: 'r1', entryId: 'i1', date: '2026-06-18', createdBy: 'u2' },
      { id: 'r2', entryId: 'i1', date: '2026-06-21', createdBy: 'u1' },
      { id: 'r3', entryId: 'i3', date: '2026-06-15', createdBy: 'u1' },
    ],
  }
}

// --- Row → app-type mappers (DB is snake_case; entry_date/color_index differ) ---

type CategoryRow = { id: string; name: string; color_index: number }
type ActivityRow = { id: string; category_id: string; name: string; emoji: string | null }
type EntryRow = {
  id: string
  activity_id: string
  title: string
  entry_date: string
  description: string
  rating: number
  created_by: string | null
  address: string | null
  lat: number | null
  lng: number | null
  hide_from_map: boolean | null
}
type SpaceHomeRow = { home_address: string | null; home_lat: number | null; home_lng: number | null }
type ProfileRow = { id: string; email: string | null; display_name: string | null }
type WishlistRow = {
  id: string
  text: string
  entry_id: string | null
  created_by: string | null
  created_at: string
}
type RepeatRow = {
  id: string
  entry_id: string
  repeat_date: string
  created_by: string | null
}

const toCategory = (r: CategoryRow): Category => ({ id: r.id, name: r.name, colorIndex: r.color_index })
const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  emoji: r.emoji ?? '',
})
const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  activityId: r.activity_id,
  title: r.title,
  date: r.entry_date,
  description: r.description,
  rating: r.rating,
  createdBy: r.created_by,
  address: r.address ?? '',
  lat: r.lat,
  lng: r.lng,
  hideFromMap: r.hide_from_map ?? false,
})
const toHome = (r: SpaceHomeRow | null): Home =>
  r ? { address: r.home_address ?? '', lat: r.home_lat, lng: r.home_lng } : EMPTY_HOME
const toProfile = (r: ProfileRow): Profile => ({ id: r.id, email: r.email, displayName: r.display_name })
const toWishlistItem = (r: WishlistRow): WishlistItem => ({
  id: r.id,
  text: r.text,
  entryId: r.entry_id,
  createdBy: r.created_by,
  createdAt: r.created_at,
})
const toRepeat = (r: RepeatRow): Repeat => ({
  id: r.id,
  entryId: r.entry_id,
  date: r.repeat_date,
  createdBy: r.created_by,
})

const ACTIVITY_COLUMNS = 'id,category_id,name,emoji'
const ENTRY_COLUMNS = 'id,activity_id,title,entry_date,description,rating,created_by,address,lat,lng,hide_from_map'
const WISHLIST_COLUMNS = 'id,text,entry_id,created_by,created_at'
const REPEAT_COLUMNS = 'id,entry_id,repeat_date,created_by'
const SPACE_HOME_COLUMNS = 'home_address,home_lat,home_lng'

const message = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'

// In-memory fallback only: stable client ids for seed-mode edits.
let idCounter = 100
function nextId(): string {
  idCounter += 1
  return `x${idCounter}`
}

// Keep just the first grapheme so a pin shows one icon — grapheme-aware so it
// doesn't split emoji ZWJ sequences (e.g. 👨‍👩‍👧) or surrogate pairs.
function firstGrapheme(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const first = new Intl.Segmenter().segment(trimmed)[Symbol.iterator]().next().value
    return first ? first.segment : trimmed
  }
  return [...trimmed][0] ?? trimmed
}

export interface ActivityStore {
  categories: Category[]
  activities: Activity[]
  entries: Entry[]
  /** Additional repeats, keyed to their entry via `entryId`. */
  repeats: Repeat[]
  profiles: Profile[]
  wishlist: WishlistItem[]
  /** The space's shared map center. */
  home: Home
  loading: boolean
  error: string | null
  /** Non-fatal warning (e.g. an address that couldn't be geocoded). Dismiss with clearNotice. */
  notice: string | null
  clearNotice: () => void

  /** Resolves to the new entry's id, so a wishlist check-off can link to it. */
  addEntry: (draft: EntryDraft) => Promise<string>
  updateEntry: (id: string, draft: EntryDraft) => Promise<void>
  deleteEntry: (id: string) => Promise<void>

  /** Log a repeat of an entry. Throws on failure (the modal stays open). */
  addRepeat: (entryId: string, date: string) => Promise<void>
  /** Remove a single repeat. Throws on failure. */
  deleteRepeat: (repeatId: string) => Promise<void>

  addActivity: (categoryId: string, name: string) => Promise<void>
  deleteActivity: (id: string) => Promise<void>
  /** Set (or clear) an activity's map-pin emoji. */
  setActivityEmoji: (id: string, emoji: string) => Promise<void>

  addCategory: (name: string, colorIndex: number) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  /** Set the shared home address; geocodes it for the map center. */
  setHome: (address: string) => Promise<void>

  addWishlistItem: (text: string) => Promise<void>
  updateWishlistItem: (id: string, text: string) => Promise<void>
  deleteWishlistItem: (id: string) => Promise<void>
  /** Mark an item done by linking it to the entry it produced. */
  linkWishlistItem: (id: string, entryId: string) => Promise<void>
  /** Reopen a done item (clear its entry link); the entry itself is kept. */
  unlinkWishlistItem: (id: string) => Promise<void>
}

export function useActivityStore(spaceId: string | null, userId: string | null = null): ActivityStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [categories, setCategories] = useState<Category[]>(() => (supabase ? [] : seed().categories))
  const [activities, setActivities] = useState<Activity[]>(() => (supabase ? [] : seed().activities))
  const [entries, setEntries] = useState<Entry[]>(() => (supabase ? [] : seed().entries))
  const [repeats, setRepeats] = useState<Repeat[]>(() => (supabase ? [] : seed().repeats))
  const [profiles, setProfiles] = useState<Profile[]>(() => (supabase ? [] : seed().profiles))
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => (supabase ? [] : seed().wishlist))
  const [home, setHomeState] = useState<Home>(() => (supabase ? EMPTY_HOME : seed().home))
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const clearNotice = useCallback(() => setNotice(null), [])

  // Latest entries, read by updateEntry to compare the prior address without
  // re-creating the callback on every entries change.
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  // Geocode an address for a save: returns coords (or null) and posts a
  // non-blocking notice when a non-empty address can't be located.
  const resolveCoords = useCallback(async (address: string) => {
    const trimmed = address.trim()
    if (!trimmed) return null
    const point = await geocode(trimmed)
    if (!point) {
      setNotice(`Couldn't locate "${trimmed}" — saved, but it won't appear on the map.`)
    }
    return point
  }, [])

  const NO_COORDS = { lat: null as number | null, lng: null as number | null }

  // Initial load (live mode only; waits for the space to resolve).
  useEffect(() => {
    if (!supabase || !spaceId) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [cats, acts, ents, reps, profs, wishes, space] = await Promise.all([
          supabase.from('categories').select('id,name,color_index').eq('space_id', spaceId).order('created_at'),
          supabase.from('activities').select(ACTIVITY_COLUMNS).eq('space_id', spaceId).order('created_at'),
          supabase.from('entries').select(ENTRY_COLUMNS).eq('space_id', spaceId).order('entry_date', { ascending: false }),
          supabase.from('entry_repeats').select(REPEAT_COLUMNS).eq('space_id', spaceId).order('repeat_date'),
          // RLS scopes this to the current user + anyone they share a space with.
          supabase.from('profiles').select('id,email,display_name'),
          supabase.from('wishlist_items').select(WISHLIST_COLUMNS).eq('space_id', spaceId).order('created_at'),
          supabase.from('spaces').select(SPACE_HOME_COLUMNS).eq('id', spaceId).single(),
        ])
        if (cats.error) throw cats.error
        if (acts.error) throw acts.error
        if (ents.error) throw ents.error
        if (reps.error) throw reps.error
        if (profs.error) throw profs.error
        if (wishes.error) throw wishes.error
        if (space.error) throw space.error
        if (cancelled) return
        setCategories((cats.data as CategoryRow[]).map(toCategory))
        setActivities((acts.data as ActivityRow[]).map(toActivity))
        setEntries((ents.data as EntryRow[]).map(toEntry))
        setRepeats((reps.data as RepeatRow[]).map(toRepeat))
        setProfiles((profs.data as ProfileRow[]).map(toProfile))
        setWishlist((wishes.data as WishlistRow[]).map(toWishlistItem))
        setHomeState(toHome(space.data as SpaceHomeRow))
      } catch (err) {
        if (!cancelled) setError(message(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [spaceId])

  // --- Entry actions. These throw on failure so the modal can stay open. ---

  const addEntry = useCallback(
    async (draft: EntryDraft) => {
      setNotice(null)
      const address = draft.address.trim()
      // Geocode before persisting so the row carries coords (or stays off-map).
      const point = await resolveCoords(address)
      const coords = point ?? NO_COORDS
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('entries')
          .insert({
            space_id: spaceId,
            activity_id: draft.activityId,
            title: draft.title,
            entry_date: draft.date || today(),
            description: draft.description,
            rating: draft.rating,
            address,
            lat: coords.lat,
            lng: coords.lng,
            hide_from_map: draft.hideFromMap,
            // created_by defaults to auth.uid() server-side; the inserted row is
            // read back below, so the UI gets the resolved creator id.
          })
          .select(ENTRY_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const entry = toEntry(data as EntryRow)
        setEntries((prev) => [...prev, entry])
        return entry.id
      }
      const id = nextId()
      setEntries((prev) => [
        ...prev,
        {
          id,
          activityId: draft.activityId,
          title: draft.title,
          date: draft.date || today(),
          description: draft.description,
          rating: draft.rating,
          createdBy: userId,
          address,
          lat: coords.lat,
          lng: coords.lng,
          hideFromMap: draft.hideFromMap,
        },
      ])
      return id
    },
    [spaceId, userId, resolveCoords],
  )

  const updateEntry = useCallback(
    async (id: string, draft: EntryDraft) => {
      setNotice(null)
      const address = draft.address.trim()
      const existing = entriesRef.current.find((e) => e.id === id)
      // Re-geocode only when the address text actually changed; otherwise keep
      // the coords already on the row (respects Nominatim's rate policy).
      let coords: { lat: number | null; lng: number | null }
      if (existing && existing.address.trim() === address) {
        coords = { lat: existing.lat, lng: existing.lng }
      } else {
        coords = (await resolveCoords(address)) ?? NO_COORDS
      }
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('entries')
          .update({
            activity_id: draft.activityId,
            title: draft.title,
            entry_date: draft.date || today(),
            description: draft.description,
            rating: draft.rating,
            address,
            lat: coords.lat,
            lng: coords.lng,
            hide_from_map: draft.hideFromMap,
          })
          .eq('id', id)
          .select(ENTRY_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        setEntries((prev) => prev.map((e) => (e.id === id ? toEntry(data as EntryRow) : e)))
        return
      }
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                activityId: draft.activityId,
                title: draft.title,
                date: draft.date,
                description: draft.description,
                rating: draft.rating,
                address,
                lat: coords.lat,
                lng: coords.lng,
                hideFromMap: draft.hideFromMap,
              }
            : entry,
        ),
      )
    },
    [spaceId, resolveCoords],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('entries').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setEntries((prev) => prev.filter((entry) => entry.id !== id))
      // The DB cascades this entry's repeats; mirror it locally.
      setRepeats((prev) => prev.filter((repeat) => repeat.entryId !== id))
      // The DB's ON DELETE SET NULL reopens any wishlist item linked to this
      // entry; mirror that locally so a checked-off wish un-checks itself.
      setWishlist((prev) =>
        prev.map((item) => (item.entryId === id ? { ...item, entryId: null } : item)),
      )
    },
    [spaceId],
  )

  const addRepeat = useCallback(
    async (entryId: string, date: string) => {
      const repeatDate = date || today()
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('entry_repeats')
          .insert({ space_id: spaceId, entry_id: entryId, repeat_date: repeatDate })
          .select(REPEAT_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        setRepeats((prev) => [...prev, toRepeat(data as RepeatRow)])
        return
      }
      setRepeats((prev) => [...prev, { id: nextId(), entryId, date: repeatDate, createdBy: userId }])
    },
    [spaceId, userId],
  )

  const deleteRepeat = useCallback(
    async (repeatId: string) => {
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('entry_repeats').delete().eq('id', repeatId)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setRepeats((prev) => prev.filter((repeat) => repeat.id !== repeatId))
    },
    [spaceId],
  )

  // --- Activity / category actions. These record errors but don't throw,
  //     since they're wired straight to UI handlers. ---

  const addActivity = useCallback(
    async (categoryId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('activities')
          .insert({ space_id: spaceId, category_id: categoryId, name: trimmed })
          .select(ACTIVITY_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          return
        }
        setActivities((prev) => [...prev, toActivity(data as ActivityRow)])
        return
      }
      setActivities((prev) => [...prev, { id: nextId(), categoryId, name: trimmed, emoji: '' }])
    },
    [spaceId],
  )

  const setActivityEmoji = useCallback(
    async (id: string, emoji: string) => {
      const next = firstGrapheme(emoji)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('activities').update({ emoji: next }).eq('id', id)
        if (err) {
          setError(err.message)
          return
        }
      }
      setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, emoji: next } : a)))
    },
    [spaceId],
  )

  const deleteActivity = useCallback(
    async (id: string) => {
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('activities').delete().eq('id', id)
        if (err) {
          setError(err.message)
          return
        }
      }
      // DB cascades entries server-side; mirror it locally to stay in sync.
      setActivities((prev) => prev.filter((activity) => activity.id !== id))
      setEntries((prev) => prev.filter((entry) => entry.activityId !== id))
    },
    [spaceId],
  )

  const addCategory = useCallback(
    async (name: string, colorIndex: number) => {
      const trimmed = name.trim()
      if (!trimmed) return
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('categories')
          .insert({ space_id: spaceId, name: trimmed, color_index: colorIndex })
          .select('id,name,color_index')
          .single()
        if (err) {
          setError(err.message)
          return
        }
        setCategories((prev) => [...prev, toCategory(data as CategoryRow)])
        return
      }
      setCategories((prev) => [...prev, { id: nextId(), name: trimmed, colorIndex }])
    },
    [spaceId],
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('categories').delete().eq('id', id)
        if (err) {
          setError(err.message)
          return
        }
      }
      // DB cascades activities + their entries; mirror it locally. The nested
      // updates read fresh state to find which activities/entries to drop.
      setActivities((prevActivities) => {
        const removedActivityIds = new Set(
          prevActivities.filter((a) => a.categoryId === id).map((a) => a.id),
        )
        setEntries((prevEntries) =>
          prevEntries.filter((entry) => !removedActivityIds.has(entry.activityId)),
        )
        return prevActivities.filter((a) => a.categoryId !== id)
      })
      setCategories((prev) => prev.filter((category) => category.id !== id))
    },
    [spaceId],
  )

  // --- Home (map center). Lives on the space row; geocoded on save. ---

  const setHome = useCallback(
    async (address: string) => {
      setNotice(null)
      const trimmed = address.trim()
      const point = await resolveCoords(trimmed)
      const coords = point ?? NO_COORDS
      const next: Home = { address: trimmed, lat: coords.lat, lng: coords.lng }
      if (supabase && spaceId) {
        const { error: err } = await supabase
          .from('spaces')
          .update({ home_address: trimmed, home_lat: coords.lat, home_lng: coords.lng })
          .eq('id', spaceId)
        if (err) {
          setError(err.message)
          return
        }
      }
      setHomeState(next)
    },
    [spaceId, resolveCoords],
  )

  // --- Wishlist actions. Like category/activity actions, these record errors
  //     but don't throw, since they're wired straight to UI handlers. ---

  const addWishlistItem = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('wishlist_items')
          .insert({ space_id: spaceId, text: trimmed })
          .select(WISHLIST_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          return
        }
        setWishlist((prev) => [...prev, toWishlistItem(data as WishlistRow)])
        return
      }
      setWishlist((prev) => [
        ...prev,
        { id: nextId(), text: trimmed, entryId: null, createdBy: userId, createdAt: today() },
      ])
    },
    [spaceId, userId],
  )

  const updateWishlistItem = useCallback(
    async (id: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('wishlist_items').update({ text: trimmed }).eq('id', id)
        if (err) {
          setError(err.message)
          return
        }
      }
      setWishlist((prev) => prev.map((item) => (item.id === id ? { ...item, text: trimmed } : item)))
    },
    [spaceId],
  )

  const deleteWishlistItem = useCallback(
    async (id: string) => {
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('wishlist_items').delete().eq('id', id)
        if (err) {
          setError(err.message)
          return
        }
      }
      setWishlist((prev) => prev.filter((item) => item.id !== id))
    },
    [spaceId],
  )

  const linkWishlistItem = useCallback(
    async (id: string, entryId: string) => {
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('wishlist_items').update({ entry_id: entryId }).eq('id', id)
        if (err) {
          setError(err.message)
          return
        }
      }
      setWishlist((prev) => prev.map((item) => (item.id === id ? { ...item, entryId } : item)))
    },
    [spaceId],
  )

  const unlinkWishlistItem = useCallback(
    async (id: string) => {
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('wishlist_items').update({ entry_id: null }).eq('id', id)
        if (err) {
          setError(err.message)
          return
        }
      }
      setWishlist((prev) => prev.map((item) => (item.id === id ? { ...item, entryId: null } : item)))
    },
    [spaceId],
  )

  return {
    categories,
    activities,
    entries,
    repeats,
    profiles,
    wishlist,
    home,
    loading,
    error,
    notice,
    clearNotice,
    addEntry,
    updateEntry,
    deleteEntry,
    addRepeat,
    deleteRepeat,
    addActivity,
    deleteActivity,
    setActivityEmoji,
    addCategory,
    deleteCategory,
    setHome,
    addWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    linkWishlistItem,
    unlinkWishlistItem,
  }
}
