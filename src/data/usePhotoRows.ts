import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Database } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import { SEED_SELF_ID, errorMessage, idFactory, upsertById } from './spaceSync'

// The write half shared by the photo-carrying collections (spoons, recipes,
// little guys): upload a photo, insert / update / delete one row, and take the
// row's photo with it on delete. Each store keeps what's actually its own —
// state, snapshot + realtime (useSpaceSync), draft cleanup, and anything
// extra like the spoons' geocode — and hands this hook its table plumbing.
//
// Both modes live here, like every store: with Supabase keys the writes hit
// the table (errors → setError + throw, so the modal stays open); without
// them the rows change in memory only. Replaced / abandoned photos are the
// page's photo session's call (src/lib/photoSession.ts), not this hook's.

type PhotoTable = 'spoons' | 'recipes' | 'little_guys'
type Tables = Database['public']['Tables']

type PhotoItem = { id: string; imageUrl: string }

/** `F` is the cleaned-up draft: the app-side fields a save writes (a subset of `T`). */
export interface PhotoRowsConfig<K extends PhotoTable, Row, T extends PhotoItem, F extends Partial<T>> {
  spaceId: string | null
  table: K
  /** The select list, returned by insert so the new row can be mapped. */
  columns: string
  toItem: (row: Row) => T
  /** App-side fields → DB columns (everything but `space_id`). */
  toColumns: (fields: F) => Omit<Tables[K]['Insert'], 'space_id'>
  /** Seed-mode id prefix (idFactory). */
  seedIdPrefix: string
  /** The feature's bucket helpers (its photos.ts). */
  uploadPhoto: (spaceId: string | null, file: File) => Promise<string>
  removePhoto: (url: string) => void
  items: T[]
  setItems: Dispatch<SetStateAction<T[]>>
  setError: (message: string | null) => void
}

export function usePhotoRows<K extends PhotoTable, Row, T extends PhotoItem, F extends Partial<T>>(
  config: PhotoRowsConfig<K, Row, T, F>,
) {
  const { spaceId, table, columns, toItem, toColumns, seedIdPrefix, uploadPhoto, removePhoto, items, setItems, setError } =
    config

  // Seed-mode id source for this collection (reset along with the seed).
  const [nextId] = useState(() => idFactory(seedIdPrefix, 100))

  // Latest rows, for lookups inside the actions (delete's photo, spoons'
  // prior place) without re-creating the callbacks on every change. Synced
  // after commit rather than during render, which the React Compiler requires.
  const itemsRef = useRef(items)
  useLayoutEffect(() => {
    itemsRef.current = items
  }, [items])
  const find = useCallback((id: string) => itemsRef.current.find((item) => item.id === id), [])

  // supabase-js can't resolve `.eq('id', …)` over a generic table name, so the
  // query builder is typed as one of the three (they all key on `id` and
  // scope on `space_id`); the payload types stay per-table via toColumns.
  const from = useCallback(() => supabase!.from(table as 'spoons'), [table])

  const upload = useCallback(
    async (file: File) => {
      setError(null)
      try {
        return await uploadPhoto(spaceId, file)
      } catch (err) {
        setError(errorMessage(err))
        throw err
      }
    },
    [spaceId, uploadPhoto, setError],
  )

  /** Insert one row. Seed mode fills in what the DB would (id, createdBy/At). */
  const insert = useCallback(
    async (fields: F) => {
      setError(null)
      if (supabase && spaceId) {
        const { data, error } = await from()
          .insert({ space_id: spaceId, ...toColumns(fields) } as never)
          .select(columns)
          .single()
        if (error) {
          setError(error.message)
          throw error
        }
        upsertById(setItems, toItem(data as Row))
        return
      }
      const created = { id: nextId(), ...fields, createdBy: SEED_SELF_ID, createdAt: new Date().toISOString() }
      setItems((prev) => [...prev, created as unknown as T])
    },
    [spaceId, from, columns, toItem, toColumns, nextId, setItems, setError],
  )

  /** Update one row's fields (the photo swap is the photo session's job). */
  const update = useCallback(
    async (id: string, fields: F) => {
      setError(null)
      if (supabase && spaceId) {
        const { error } = await from()
          .update(toColumns(fields) as never)
          .eq('id', id)
        if (error) {
          setError(error.message)
          throw error
        }
      }
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...fields } : item)))
    },
    [spaceId, from, toColumns, setItems, setError],
  )

  /** Delete one row, then best-effort its uploaded photo. */
  const remove = useCallback(
    async (id: string) => {
      setError(null)
      const prior = find(id)
      if (supabase && spaceId) {
        const { error } = await from().delete().eq('id', id)
        if (error) {
          setError(error.message)
          throw error
        }
      }
      if (prior?.imageUrl) removePhoto(prior.imageUrl)
      setItems((prev) => prev.filter((item) => item.id !== id))
    },
    [spaceId, from, find, removePhoto, setItems, setError],
  )

  return { find, uploadPhoto: upload, insert, update, remove }
}
