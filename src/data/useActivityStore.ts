import { useCallback, useState } from 'react'
import type { Activity, Category, Entry, EntryDraft } from '../types'
import { today } from '../lib/format'

// Local, in-memory store that mirrors the original Compass logic. It owns the
// domain data (categories / activities / entries) and exposes typed actions.
//
// This is the seam where Supabase will plug in: the action signatures are the
// same shape we'll want from the database layer, so swapping the bodies for
// `supabase.from(...)` calls (plus loading state) won't change the components.

interface SeedData {
  categories: Category[]
  activities: Activity[]
  entries: Entry[]
}

function seed(): SeedData {
  return {
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
      { id: 'i1', activityId: 'a1', title: 'Riverside picnic', date: '2026-06-12', description: 'Golden hour picnic and a long walk by the water.', rating: 5 },
      { id: 'i2', activityId: 'a5', title: 'Dinner at Tabella', date: '2026-06-08', description: 'Shared the cacio e pepe. Cozy corner table.', rating: 4 },
      { id: 'i3', activityId: 'a7', title: 'ASL — Lesson 4', date: '2026-06-03', description: 'Finally got the alphabet down. Practiced over coffee.', rating: 4 },
      { id: 'i4', activityId: 'a3', title: 'Pine Ridge overnight', date: '2026-05-30', description: 'Overnight on the trail. Tough climb, worth it.', rating: 5 },
      { id: 'i5', activityId: 'a4', title: 'Sci-fi at the Roxy', date: '2026-06-10', description: 'Saw the new release. Split a popcorn.', rating: 3 },
      { id: 'i6', activityId: 'a2', title: 'Morning laps', date: '2026-06-14', description: 'Early swim at the community pool.', rating: 4 },
      { id: 'i7', activityId: 'a8', title: 'Clair de Lune, pt. 1', date: '2026-05-22', description: 'Learned the first half of the piece.', rating: 4 },
      { id: 'i8', activityId: 'a6', title: 'Vellum & Vine browse', date: '2026-06-01', description: 'Browsed an hour. Found a poetry collection.', rating: 5 },
    ],
  }
}

let idCounter = 100
function nextId(): string {
  idCounter += 1
  return `x${idCounter}`
}

export interface ActivityStore {
  categories: Category[]
  activities: Activity[]
  entries: Entry[]

  addEntry: (draft: EntryDraft) => void
  updateEntry: (id: string, draft: EntryDraft) => void
  deleteEntry: (id: string) => void

  addActivity: (categoryId: string, name: string) => void
  deleteActivity: (id: string) => void

  addCategory: (name: string, colorIndex: number) => void
  deleteCategory: (id: string) => void
}

export function useActivityStore(): ActivityStore {
  const initial = seed()
  const [categories, setCategories] = useState<Category[]>(initial.categories)
  const [activities, setActivities] = useState<Activity[]>(initial.activities)
  const [entries, setEntries] = useState<Entry[]>(initial.entries)

  const addEntry = useCallback((draft: EntryDraft) => {
    setEntries((prev) => [
      ...prev,
      {
        id: nextId(),
        activityId: draft.activityId,
        title: draft.title,
        date: draft.date || today(),
        description: draft.description,
        rating: draft.rating,
      },
    ])
  }, [])

  const updateEntry = useCallback((id: string, draft: EntryDraft) => {
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
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const addActivity = useCallback((categoryId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setActivities((prev) => [...prev, { id: nextId(), categoryId, name: trimmed }])
  }, [])

  const deleteActivity = useCallback((id: string) => {
    setActivities((prev) => prev.filter((activity) => activity.id !== id))
    // Cascade: drop entries that referenced the removed activity.
    setEntries((prev) => prev.filter((entry) => entry.activityId !== id))
  }, [])

  const addCategory = useCallback((name: string, colorIndex: number) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCategories((prev) => [...prev, { id: nextId(), name: trimmed, colorIndex }])
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setActivities((prevActivities) => {
      const removedActivityIds = new Set(
        prevActivities.filter((a) => a.categoryId === id).map((a) => a.id),
      )
      // Cascade entries belonging to the category's activities.
      setEntries((prevEntries) =>
        prevEntries.filter((entry) => !removedActivityIds.has(entry.activityId)),
      )
      return prevActivities.filter((a) => a.categoryId !== id)
    })
    setCategories((prev) => prev.filter((category) => category.id !== id))
  }, [])

  return {
    categories,
    activities,
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    addActivity,
    deleteActivity,
    addCategory,
    deleteCategory,
  }
}
