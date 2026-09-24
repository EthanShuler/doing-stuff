import { useCallback, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Spoon } from '../../types'
import { supabase } from '../../lib/supabase'
import { resolveCoordsWithNotice } from '../../lib/geocode'
import { syncTable, useSpaceSync } from '../../data/spaceSync'
import { usePhotoRows } from '../../data/usePhotoRows'
import { removeSpoonPhoto, uploadSpoonPhoto } from './photos'

// Data seam for the spoon collection, mirroring the other stores' two modes:
//   • Supabase keys present → live: reads/writes the `spoons` table scoped to
//     the space (shared data — uniform space-member RLS).
//   • No keys → in-memory seed so the UI can be developed offline.
//
// Photos ride along as public-bucket URLs (see photos.ts); the writes —
// upload, add/edit, delete-with-photo — are the shared usePhotoRows, with the
// place geocoded here first. Replaced/abandoned photos are the page's call,
// not this store's — see src/lib/photoSession.ts.

interface Snapshot {
  spoons: Spoon[]
}

function seed(): Snapshot {
  // Pre-geocoded pins so the map works offline. The two Paris spoons share
  // coords deliberately — they exercise the same-place fan-out.
  return {
    spoons: [
      { id: 's1', name: 'Eiffel Tower', imageUrl: '', place: 'Paris, France', lat: 48.8566, lng: 2.3522, acquiredOn: '2026-05-04', notes: 'From the honeymoon.', createdBy: 'u1', createdAt: '2026-05-04T09:00:00Z' },
      { id: 's2', name: 'Little gold Louvre', imageUrl: '', place: 'Paris, France', lat: 48.8566, lng: 2.3522, acquiredOn: '2026-05-06', notes: '', createdBy: 'u2', createdAt: '2026-05-06T09:00:00Z' },
      { id: 's3', name: 'Golden Gate Bridge', imageUrl: '', place: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, acquiredOn: '2026-03-15', notes: 'Fog-shaped handle.', createdBy: 'u1', createdAt: '2026-03-15T09:00:00Z' },
      { id: 's4', name: 'Banff moose', imageUrl: '', place: 'Banff, Alberta', lat: 51.1784, lng: -115.5708, acquiredOn: null, notes: 'Gift from Meg — trip date unknown.', createdBy: 'u2', createdAt: '2026-04-02T09:00:00Z' },
      { id: 's5', name: 'Mystery spoon', imageUrl: '', place: '', lat: null, lng: null, acquiredOn: null, notes: 'No idea where this one came from.', createdBy: 'u1', createdAt: '2026-04-20T09:00:00Z' },
    ],
  }
}

// --- Row → app-type mapper (DB is snake_case) ---

type SpoonRow = {
  id: string
  name: string
  image_url: string | null
  place: string | null
  lat: number | null
  lng: number | null
  acquired_on: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

const toSpoon = (r: SpoonRow): Spoon => ({
  id: r.id,
  name: r.name,
  imageUrl: r.image_url ?? '',
  place: r.place ?? '',
  lat: r.lat,
  lng: r.lng,
  acquiredOn: r.acquired_on,
  notes: r.notes ?? '',
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const SPOON_COLUMNS = 'id,name,image_url,place,lat,lng,acquired_on,notes,created_by,created_at'

/** The fields the add/edit modal writes. `acquiredOn` is '' for "unknown". */
export interface SpoonDraft {
  name: string
  imageUrl: string
  place: string
  acquiredOn: string
  notes: string
}

export interface SpoonStore {
  spoons: Spoon[]
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  /** Non-fatal warning (an un-geocodable place). Dismiss via clearNotice. */
  notice: string | null
  clearError: () => void
  clearNotice: () => void

  /** Downscale + upload a photo, returning its public URL for the draft.
   *  Throws on failure (the modal shows the reason and keeps its old image). */
  uploadPhoto: (file: File) => Promise<string>
  /** Add a spoon; geocodes the place on save. Throws on failure (modal stays open). */
  addSpoon: (draft: SpoonDraft) => Promise<void>
  /** Edit a spoon; re-geocodes only when the place text changed. Throws on
   *  failure. Leaves the replaced photo to the page's photo session. */
  updateSpoon: (id: string, draft: SpoonDraft) => Promise<void>
  /** Delete a spoon (and best-effort its uploaded photo). Throws on failure. */
  deleteSpoon: (id: string) => Promise<void>
}

/** A save's fields: the cleaned-up draft plus the resolved coords. */
type SpoonFields = Pick<Spoon, 'name' | 'imageUrl' | 'place' | 'lat' | 'lng' | 'acquiredOn' | 'notes'>

/** Spoon fields → `spoons` columns (insert and update write the same set). */
const spoonColumns = (fields: SpoonFields) => ({
  name: fields.name,
  image_url: fields.imageUrl,
  place: fields.place,
  lat: fields.lat,
  lng: fields.lng,
  acquired_on: fields.acquiredOn,
  notes: fields.notes,
})

export function useSpoonStore(spaceId: string | null): SpoonStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [spoons, setSpoons] = useState<Spoon[]>(initial?.spoons ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])
  const clearNotice = useCallback(() => setNotice(null), [])

  // Geocode a place for a save: coords or null, with a non-blocking notice
  // when a non-empty place can't be located.
  const resolveCoords = useCallback(
    (place: string) => resolveCoordsWithNotice(place, setNotice),
    [],
  )

  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const { data, error: err } = await supabase
      .from('spoons')
      .select(SPOON_COLUMNS)
      .eq('space_id', spaceId)
      .order('created_at')
    if (err) throw err
    return { spoons: (data as SpoonRow[]).map(toSpoon) }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setSpoons(snap.spoons)
  }, [])

  const wire = useCallback(
    (channel: RealtimeChannel, spaceFilter: string) =>
      syncTable(channel, spaceFilter, 'spoons', toSpoon, setSpoons),
    [],
  )

  useSpaceSync({
    spaceId,
    channelPrefix: 'spoons',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  const rows = usePhotoRows({
    spaceId,
    table: 'spoons',
    columns: SPOON_COLUMNS,
    toItem: toSpoon,
    toColumns: spoonColumns,
    seedIdPrefix: 'sx',
    uploadPhoto: uploadSpoonPhoto,
    removePhoto: removeSpoonPhoto,
    items: spoons,
    setItems: setSpoons,
    setError,
  })
  const { find, insert, update } = rows

  const addSpoon = useCallback(
    async (draft: SpoonDraft) => {
      const name = draft.name.trim()
      if (!name) return
      setError(null)
      const place = draft.place.trim()
      const point = await resolveCoords(place)
      await insert({
        name,
        imageUrl: draft.imageUrl.trim(),
        place,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        acquiredOn: draft.acquiredOn || null,
        notes: draft.notes.trim(),
      })
    },
    [resolveCoords, insert],
  )

  const updateSpoon = useCallback(
    async (id: string, draft: SpoonDraft) => {
      const name = draft.name.trim()
      if (!name) return
      setError(null)
      const prior = find(id)
      const place = draft.place.trim()
      // Re-geocode only when the place text actually changed; otherwise keep
      // the stored coords (Nominatim rate policy — and the fan-out is stable).
      const changedPlace = place !== (prior?.place ?? '')
      const point = changedPlace ? await resolveCoords(place) : null
      await update(id, {
        name,
        imageUrl: draft.imageUrl.trim(),
        place,
        lat: changedPlace ? point?.lat ?? null : prior?.lat ?? null,
        lng: changedPlace ? point?.lng ?? null : prior?.lng ?? null,
        acquiredOn: draft.acquiredOn || null,
        notes: draft.notes.trim(),
      })
    },
    [resolveCoords, find, update],
  )

  return {
    spoons,
    loading,
    error,
    notice,
    clearError,
    clearNotice,
    uploadPhoto: rows.uploadPhoto,
    addSpoon,
    updateSpoon,
    deleteSpoon: rows.remove,
  }
}
