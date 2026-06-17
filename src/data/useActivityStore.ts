import { useCallback, useEffect, useState } from 'react'
import type { Activity, Category, Entry, EntryDraft, Profile, WishlistItem } from '../types'
import { supabase } from '../lib/supabase'
import { today } from '../lib/format'

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
  profiles: Profile[]
  wishlist: WishlistItem[]
}

function seed(): SeedData {
  return {
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
      { id: 'a1', categoryId: 'c1', name: 'Park' },
      { id: 'a2', categoryId: 'c1', name: 'Swimming' },
      { id: 'a3', categoryId: 'c1', name: 'Backpacking' },
      { id: 'a4', categoryId: 'c2', name: 'Movie' },
      { id: 'a5', categoryId: 'c2', name: 'Restaurant' },
      { id: 'a6', categoryId: 'c2', name: 'Book store' },
      { id: 'a7', categoryId: 'c3', name: 'ASL learning' },
      { id: 'a8', categoryId: 'c3', name: 'Piano lesson' },
    ],
    entries: [
      { id: 'i1', activityId: 'a1', title: 'Riverside picnic', date: '2026-06-12', description: 'Golden hour picnic and a long walk by the water.', rating: 5, createdBy: 'u1' },
      { id: 'i2', activityId: 'a5', title: 'Dinner at Tabella', date: '2026-06-08', description: 'Shared the cacio e pepe. Cozy corner table.', rating: 4, createdBy: 'u2' },
      { id: 'i3', activityId: 'a7', title: 'ASL — Lesson 4', date: '2026-06-03', description: 'Finally got the alphabet down. Practiced over coffee.', rating: 4, createdBy: 'u1' },
      { id: 'i4', activityId: 'a3', title: 'Pine Ridge overnight', date: '2026-05-30', description: 'Overnight on the trail. Tough climb, worth it.', rating: 5, createdBy: 'u2' },
      { id: 'i5', activityId: 'a4', title: 'Sci-fi at the Roxy', date: '2026-06-10', description: 'Saw the new release. Split a popcorn.', rating: 3, createdBy: 'u1' },
      { id: 'i6', activityId: 'a2', title: 'Morning laps', date: '2026-06-14', description: 'Early swim at the community pool.', rating: 4, createdBy: 'u2' },
      { id: 'i7', activityId: 'a8', title: 'Clair de Lune, pt. 1', date: '2026-05-22', description: 'Learned the first half of the piece.', rating: 4, createdBy: 'u1' },
      { id: 'i8', activityId: 'a6', title: 'Vellum & Vine browse', date: '2026-06-01', description: 'Browsed an hour. Found a poetry collection.', rating: 5, createdBy: 'u2' },
    ],
  }
}

// --- Row → app-type mappers (DB is snake_case; entry_date/color_index differ) ---

type CategoryRow = { id: string; name: string; color_index: number }
type ActivityRow = { id: string; category_id: string; name: string }
type EntryRow = {
  id: string
  activity_id: string
  title: string
  entry_date: string
  description: string
  rating: number
  created_by: string | null
}
type ProfileRow = { id: string; email: string | null; display_name: string | null }
type WishlistRow = {
  id: string
  text: string
  entry_id: string | null
  created_by: string | null
  created_at: string
}

const toCategory = (r: CategoryRow): Category => ({ id: r.id, name: r.name, colorIndex: r.color_index })
const toActivity = (r: ActivityRow): Activity => ({ id: r.id, categoryId: r.category_id, name: r.name })
const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  activityId: r.activity_id,
  title: r.title,
  date: r.entry_date,
  description: r.description,
  rating: r.rating,
  createdBy: r.created_by,
})
const toProfile = (r: ProfileRow): Profile => ({ id: r.id, email: r.email, displayName: r.display_name })
const toWishlistItem = (r: WishlistRow): WishlistItem => ({
  id: r.id,
  text: r.text,
  entryId: r.entry_id,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const ENTRY_COLUMNS = 'id,activity_id,title,entry_date,description,rating,created_by'
const WISHLIST_COLUMNS = 'id,text,entry_id,created_by,created_at'

const message = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'

// In-memory fallback only: stable client ids for seed-mode edits.
let idCounter = 100
function nextId(): string {
  idCounter += 1
  return `x${idCounter}`
}

export interface ActivityStore {
  categories: Category[]
  activities: Activity[]
  entries: Entry[]
  profiles: Profile[]
  wishlist: WishlistItem[]
  loading: boolean
  error: string | null

  /** Resolves to the new entry's id, so a wishlist check-off can link to it. */
  addEntry: (draft: EntryDraft) => Promise<string>
  updateEntry: (id: string, draft: EntryDraft) => Promise<void>
  deleteEntry: (id: string) => Promise<void>

  addActivity: (categoryId: string, name: string) => Promise<void>
  deleteActivity: (id: string) => Promise<void>

  addCategory: (name: string, colorIndex: number) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

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
  const [profiles, setProfiles] = useState<Profile[]>(() => (supabase ? [] : seed().profiles))
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => (supabase ? [] : seed().wishlist))
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  // Initial load (live mode only; waits for the space to resolve).
  useEffect(() => {
    if (!supabase || !spaceId) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [cats, acts, ents, profs, wishes] = await Promise.all([
          supabase.from('categories').select('id,name,color_index').eq('space_id', spaceId).order('created_at'),
          supabase.from('activities').select('id,category_id,name').eq('space_id', spaceId).order('created_at'),
          supabase.from('entries').select(ENTRY_COLUMNS).eq('space_id', spaceId).order('entry_date', { ascending: false }),
          // RLS scopes this to the current user + anyone they share a space with.
          supabase.from('profiles').select('id,email,display_name'),
          supabase.from('wishlist_items').select(WISHLIST_COLUMNS).eq('space_id', spaceId).order('created_at'),
        ])
        if (cats.error) throw cats.error
        if (acts.error) throw acts.error
        if (ents.error) throw ents.error
        if (profs.error) throw profs.error
        if (wishes.error) throw wishes.error
        if (cancelled) return
        setCategories((cats.data as CategoryRow[]).map(toCategory))
        setActivities((acts.data as ActivityRow[]).map(toActivity))
        setEntries((ents.data as EntryRow[]).map(toEntry))
        setProfiles((profs.data as ProfileRow[]).map(toProfile))
        setWishlist((wishes.data as WishlistRow[]).map(toWishlistItem))
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
        },
      ])
      return id
    },
    [spaceId, userId],
  )

  const updateEntry = useCallback(
    async (id: string, draft: EntryDraft) => {
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('entries')
          .update({
            activity_id: draft.activityId,
            title: draft.title,
            entry_date: draft.date || today(),
            description: draft.description,
            rating: draft.rating,
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
              }
            : entry,
        ),
      )
    },
    [spaceId],
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
      // The DB's ON DELETE SET NULL reopens any wishlist item linked to this
      // entry; mirror that locally so a checked-off wish un-checks itself.
      setWishlist((prev) =>
        prev.map((item) => (item.entryId === id ? { ...item, entryId: null } : item)),
      )
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
          .select('id,category_id,name')
          .single()
        if (err) {
          setError(err.message)
          return
        }
        setActivities((prev) => [...prev, toActivity(data as ActivityRow)])
        return
      }
      setActivities((prev) => [...prev, { id: nextId(), categoryId, name: trimmed }])
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
    profiles,
    wishlist,
    loading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    addActivity,
    deleteActivity,
    addCategory,
    deleteCategory,
    addWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    linkWishlistItem,
    unlinkWishlistItem,
  }
}
