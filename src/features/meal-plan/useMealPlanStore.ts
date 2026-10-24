import { useCallback, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GroceryStaple, MealKind, MealPlanDay } from '../../types'
import { supabase } from '../../lib/supabase'
import { today } from '../../lib/format'
import { errorMessage, idFactory, removeById, syncTable, upsertById, useSpaceSync } from '../../data/spaceSync'
import { addDays, findGroceriesList, weekStart, withSent } from './derive'

// Data seam for the meal plan, mirroring the other stores' two modes:
//   • Supabase keys present → live: reads/writes `meal_plan_days` and
//     `grocery_staples` scoped to the space (shared data, uniform RLS), and
//     the grocery step writes straight into the Lists feature's tables
//     (`lists` / `list_items`) — the Lists page's own realtime channel picks
//     the new rows up, like the Lists store writing `tier_items`.
//   • No keys → in-memory seed. The grocery step there only records what was
//     sent (the Lists seed is a separate in-memory store).
//
// Recipes aren't fetched here: the page already holds the recipe store.

interface Snapshot {
  days: MealPlanDay[]
  staples: GroceryStaple[]
}

function seed(): Snapshot {
  const sunday = weekStart(today())
  const day = (offset: number, fields: Partial<MealPlanDay> & { id: string; kind: MealKind }): MealPlanDay => ({
    day: addDays(sunday, offset),
    recipeId: null,
    text: '',
    leftoversOf: null,
    groceriesSent: [],
    createdAt: '2026-10-01T09:00:00Z',
    ...fields,
  })
  return {
    days: [
      day(0, { id: 'mp1', kind: 'recipe', recipeId: 'r3' }),
      day(1, { id: 'mp2', kind: 'leftovers', leftoversOf: 'mp1' }),
      day(2, { id: 'mp3', kind: 'text', text: 'Tacos at Sam’s' }),
      day(3, { id: 'mp4', kind: 'recipe', recipeId: 'r1' }),
    ],
    staples: [
      { id: 'st1', name: 'salt' },
      { id: 'st2', name: 'black pepper' },
      { id: 'st3', name: 'olive oil' },
    ],
  }
}

// --- Row → app-type mappers (DB is snake_case) ---

type DayRow = {
  id: string
  day: string
  kind: string
  recipe_id: string | null
  text: string | null
  leftovers_of: string | null
  groceries_sent: string[] | null
  created_at: string
}

const toDay = (r: DayRow): MealPlanDay => ({
  id: r.id,
  day: r.day,
  kind: r.kind as MealKind,
  recipeId: r.recipe_id,
  text: r.text ?? '',
  leftoversOf: r.leftovers_of,
  groceriesSent: r.groceries_sent ?? [],
  createdAt: r.created_at,
})

type StapleRow = { id: string; name: string }
const toStaple = (r: StapleRow): GroceryStaple => ({ id: r.id, name: r.name })

const DAY_COLUMNS = 'id,day,kind,recipe_id,text,leftovers_of,groceries_sent,created_at'

/** A day is unique per date, so an optimistic row (temp id) and the
 *  server's echo (real id) are the same day — match on either. */
const upsertByDay = (set: Dispatch<SetStateAction<MealPlanDay[]>>, item: MealPlanDay) =>
  set((prev) =>
    prev.some((d) => d.id === item.id || d.day === item.day)
      ? prev.map((d) => (d.id === item.id || d.day === item.day ? item : d))
      : [...prev, item],
  )

/** What one day should hold. */
export type MealChoice =
  | { kind: 'recipe'; recipeId: string }
  | { kind: 'text'; text: string }
  | { kind: 'leftovers'; leftoversOf: string | null }

/** One recipe day's picked ingredient lines, for the grocery step. */
export interface GrocerySend {
  dayId: string
  /** The recipe title — the row's note on the Groceries list. */
  recipeTitle: string
  lines: string[]
}

export interface MealPlanStore {
  days: MealPlanDay[]
  staples: GroceryStaple[]
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Plan a day (replacing whatever it held). Optimistic; a failure
   *  resyncs and records the error. */
  setDay: (date: string, choice: MealChoice) => Promise<void>
  /** Empty a day. Leftovers of it become plain leftovers (the DB's
   *  on delete set null, mirrored here). */
  clearDay: (date: string) => Promise<void>
  /** Put the picked lines + extras on the space's "Groceries" list (created
   *  on first use) and remember them on each day. Resolves to the list's id
   *  (null in seed mode). Throws on failure (the modal stays open). */
  sendGroceries: (sends: GrocerySend[], extras: string[]) => Promise<string | null>
  addStaple: (name: string) => Promise<void>
  removeStaple: (id: string) => Promise<void>
}

const seedId = idFactory('mpx', 0)

export function useMealPlanStore(spaceId: string | null): MealPlanStore {
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [days, setDays] = useState<MealPlanDay[]>(initial?.days ?? [])
  const [staples, setStaples] = useState<GroceryStaple[]>(initial?.staples ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  // Actions read the latest rows without re-binding on every change.
  const daysRef = useRef(days)
  daysRef.current = days

  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [dayRows, stapleRows] = await Promise.all([
      supabase.from('meal_plan_days').select(DAY_COLUMNS).eq('space_id', spaceId).order('day'),
      supabase.from('grocery_staples').select('id,name').eq('space_id', spaceId).order('created_at'),
    ])
    if (dayRows.error) throw dayRows.error
    if (stapleRows.error) throw stapleRows.error
    return {
      days: (dayRows.data as DayRow[]).map(toDay),
      staples: (stapleRows.data as StapleRow[]).map(toStaple),
    }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setDays(snap.days)
    setStaples(snap.staples)
  }, [])

  const wire = useCallback((channel: RealtimeChannel, spaceFilter: string) => {
    syncTable(channel, spaceFilter, 'meal_plan_days', toDay, setDays, upsertByDay)
    return syncTable(channel, spaceFilter, 'grocery_staples', toStaple, setStaples)
  }, [])

  useSpaceSync({
    spaceId,
    channelPrefix: 'meal-plan',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  /** After a failed optimistic write: record why and pull the truth back. */
  const resync = useCallback(
    async (err: unknown) => {
      setError(errorMessage(err))
      try {
        const snap = await fetchAll()
        if (snap) applySnapshot(snap)
      } catch {
        // The original error is the one worth showing.
      }
    },
    [fetchAll, applySnapshot],
  )

  const setDay = useCallback(
    async (date: string, choice: MealChoice) => {
      setError(null)
      const prior = daysRef.current.find((d) => d.day === date)
      // A different recipe means a different shopping list: forget what the
      // old one sent. Same recipe again keeps it.
      const keepSent = choice.kind === 'recipe' && prior?.kind === 'recipe' && prior.recipeId === choice.recipeId
      const next: MealPlanDay = {
        id: prior?.id ?? seedId(),
        day: date,
        kind: choice.kind,
        recipeId: choice.kind === 'recipe' ? choice.recipeId : null,
        text: choice.kind === 'text' ? choice.text.trim() : '',
        leftoversOf: choice.kind === 'leftovers' ? choice.leftoversOf : null,
        groceriesSent: keepSent ? prior.groceriesSent : [],
        createdAt: prior?.createdAt ?? new Date().toISOString(),
      }
      upsertByDay(setDays, next)
      if (!supabase || !spaceId) return
      const { data, error } = await supabase
        .from('meal_plan_days')
        .upsert(
          {
            space_id: spaceId,
            day: date,
            kind: next.kind,
            recipe_id: next.recipeId,
            text: next.text,
            leftovers_of: next.leftoversOf,
            groceries_sent: next.groceriesSent,
          },
          { onConflict: 'space_id,day' },
        )
        .select(DAY_COLUMNS)
        .single()
      if (error) await resync(error)
      else upsertByDay(setDays, toDay(data as DayRow))
    },
    [spaceId, resync],
  )

  const clearDay = useCallback(
    async (date: string) => {
      setError(null)
      const prior = daysRef.current.find((d) => d.day === date)
      if (!prior) return
      // Mirror `leftovers_of ... on delete set null`.
      setDays((prev) =>
        prev
          .filter((d) => d.id !== prior.id)
          .map((d) => (d.leftoversOf === prior.id ? { ...d, leftoversOf: null } : d)),
      )
      if (!supabase || !spaceId) return
      const { error } = await supabase.from('meal_plan_days').delete().eq('id', prior.id)
      if (error) await resync(error)
    },
    [spaceId, resync],
  )

  const markSent = useCallback((sends: GrocerySend[]) => {
    const byDay = new Map(sends.map((s) => [s.dayId, s.lines]))
    setDays((prev) =>
      prev.map((d) => (byDay.has(d.id) ? { ...d, groceriesSent: withSent(d.groceriesSent, byDay.get(d.id)!) } : d)),
    )
  }, [])

  const sendGroceries = useCallback(
    async (sends: GrocerySend[], extras: string[]): Promise<string | null> => {
      setError(null)
      const picked = sends.filter((s) => s.lines.length > 0)
      if (!supabase || !spaceId) {
        markSent(picked)
        return null
      }
      const client = supabase
      try {
        // The Groceries list: find it, or make it on first use.
        const lists = await client.from('lists').select('id,name,created_at').eq('space_id', spaceId)
        if (lists.error) throw lists.error
        let listId = findGroceriesList(lists.data.map((l) => ({ ...l, createdAt: l.created_at })))?.id ?? null
        if (!listId) {
          const made = await client
            .from('lists')
            .insert({ space_id: spaceId, name: 'Groceries', emoji: '🛒' })
            .select('id')
            .single()
          if (made.error) throw made.error
          listId = made.data.id
        }

        // Append below whatever's already on it.
        const last = await client
          .from('list_items')
          .select('position')
          .eq('list_id', listId)
          .order('position', { ascending: false })
          .limit(1)
        if (last.error) throw last.error
        let position = last.data[0]?.position ?? 0
        const rows = [
          ...picked.flatMap((s) => s.lines.map((title) => ({ title, creator: s.recipeTitle }))),
          ...extras.map((title) => ({ title, creator: '' })),
        ].map((row) => ({ space_id: spaceId, kind: 'custom', list_id: listId, ...row, position: (position += 1) }))
        if (rows.length > 0) {
          const inserted = await client.from('list_items').insert(rows)
          if (inserted.error) throw inserted.error
        }

        // Remember what each day sent, so a re-run offers only what's new.
        const prior = daysRef.current
        const results = await Promise.all(
          picked.map((s) => {
            const day = prior.find((d) => d.id === s.dayId)
            return client
              .from('meal_plan_days')
              .update({ groceries_sent: withSent(day?.groceriesSent ?? [], s.lines) })
              .eq('id', s.dayId)
          }),
        )
        markSent(picked)
        const failed = results.find((r) => r.error)
        if (failed?.error) throw failed.error
        return listId
      } catch (err) {
        setError(errorMessage(err))
        throw err
      }
    },
    [spaceId, markSent],
  )

  const addStaple = useCallback(
    async (name: string) => {
      setError(null)
      const trimmed = name.trim()
      if (!trimmed) return
      const temp: GroceryStaple = { id: seedId(), name: trimmed }
      upsertById(setStaples, temp)
      if (!supabase || !spaceId) return
      const { data, error } = await supabase
        .from('grocery_staples')
        .insert({ space_id: spaceId, name: trimmed })
        .select('id,name')
        .single()
      removeById(setStaples, temp.id)
      if (error) await resync(error)
      else upsertById(setStaples, toStaple(data))
    },
    [spaceId, resync],
  )

  const removeStaple = useCallback(
    async (id: string) => {
      setError(null)
      removeById(setStaples, id)
      if (!supabase || !spaceId) return
      const { error } = await supabase.from('grocery_staples').delete().eq('id', id)
      if (error) await resync(error)
    },
    [spaceId, resync],
  )

  return { days, staples, loading, error, clearError, setDay, clearDay, sendGroceries, addStaple, removeStaple }
}
