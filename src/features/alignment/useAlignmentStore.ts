import { useCallback, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { AlignmentChart, AlignmentKey } from '../../types'
import { supabase } from '../../lib/supabase'
import { SEED_SELF_ID, errorMessage, idFactory, syncTable, upsertById, useSpaceSync } from '../../data/spaceSync'
import { ALIGNMENT_KEYS, emptyCells, withCell } from './derive'

// Data seam for the alignment charts, with the same two modes as every other
// store:
//   • Supabase keys present → live: reads/writes `alignment_charts` scoped to
//     the space (shared data — uniform space-member RLS), streaming the
//     partner's edits over one channel.
//   • No keys → an in-memory seed so the UI can be worked on offline.
//
// Each square is its own column, so filling one in is a one-column UPDATE —
// two people editing different squares of the same chart never clobber each
// other.
//
// Error style follows the seasons store: modal actions (create / rename /
// delete) record the error AND throw so the modal stays open; the inline
// square edit is optimistic and resyncs on failure.

/** The keyless-mode charts (exported for the derive tests): one finished, one
 *  half-done so the blank-square state shows. */
export function seed(): AlignmentChart[] {
  return [
    {
      id: 'ac1',
      title: 'Sandwiches',
      cells: {
        lawful_good: 'BLT',
        neutral_good: 'Grilled cheese',
        chaotic_good: 'Peanut butter & pickle',
        lawful_neutral: 'Ham on rye',
        true_neutral: 'Turkey on white',
        chaotic_neutral: 'Hot dog',
        lawful_evil: 'Footlong from an airport',
        neutral_evil: 'Gas station egg salad',
        chaotic_evil: 'Pop-Tart',
      },
      createdBy: SEED_SELF_ID,
      createdAt: '2026-09-01T09:00:00Z',
    },
    {
      id: 'ac2',
      title: 'Halloween candy',
      cells: {
        ...emptyCells(),
        lawful_good: 'Reese’s cups',
        chaotic_good: 'Sour Patch Kids',
        true_neutral: 'Tootsie Roll',
        chaotic_neutral: 'Candy corn',
        chaotic_evil: 'A toothbrush',
      },
      createdBy: 'u2',
      createdAt: '2026-10-02T09:00:00Z',
    },
  ]
}

// --- Row → app-type mapper (DB is snake_case; the nine squares are columns) ---

type ChartRow = {
  id: string
  title: string
  created_by: string | null
  created_at: string
} & Record<AlignmentKey, string | null>

const toChart = (r: ChartRow): AlignmentChart => ({
  id: r.id,
  title: r.title,
  cells: Object.fromEntries(ALIGNMENT_KEYS.map((key) => [key, r[key] ?? ''])) as Record<AlignmentKey, string>,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const CHART_COLUMNS = ['id', 'title', ...ALIGNMENT_KEYS, 'created_by', 'created_at'].join(',')

// In-memory fallback only: stable client ids for seed-mode edits.
const nextId = idFactory('ac', 100)

function cleanTitle(title: string): string {
  const clean = title.trim()
  if (!clean) throw new Error('A chart needs a title.')
  return clean
}

export interface AlignmentStore {
  /** Every chart, in fetch order (sort with sortCharts for the picker). */
  charts: AlignmentChart[]
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Create a blank chart. Resolves the created row so the caller can
   *  navigate to it. Throws on failure (modal stays open). */
  addChart: (title: string) => Promise<AlignmentChart>
  /** Rename a chart. Throws on failure. */
  renameChart: (id: string, title: string) => Promise<void>
  /** Delete a chart. Throws on failure. */
  deleteChart: (id: string) => Promise<void>
  /** Write one square ('' clears it). Inline: optimistic, resync on failure. */
  setCell: (id: string, key: AlignmentKey, text: string) => Promise<void>
}

export function useAlignmentStore(spaceId: string | null, userId: string | null = null): AlignmentStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [charts, setCharts] = useState<AlignmentChart[]>(() => (supabase ? [] : seed()))
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  const selfId = supabase ? userId : SEED_SELF_ID

  const fetchAll = useCallback(async (): Promise<AlignmentChart[] | null> => {
    if (!supabase || !spaceId) return null
    const { data, error: err } = await supabase
      .from('alignment_charts')
      .select(CHART_COLUMNS)
      .eq('space_id', spaceId)
      .order('created_at')
    if (err) throw err
    return (data as unknown as ChartRow[]).map(toChart)
  }, [spaceId])

  const applySnapshot = useCallback((snap: AlignmentChart[]) => setCharts(snap), [])

  // Resync after a failed inline write: pull the truth back down.
  const resync = useCallback(() => {
    fetchAll()
      .then((snap) => {
        if (snap) applySnapshot(snap)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [fetchAll, applySnapshot])

  const wire = useCallback(
    (channel: RealtimeChannel, spaceFilter: string) =>
      syncTable(channel, spaceFilter, 'alignment_charts', toChart, setCharts),
    [],
  )

  useSpaceSync({
    spaceId,
    channelPrefix: 'alignment',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  // --- Chart actions (modal flows: record + throw) ---

  const addChart = useCallback(
    async (title: string): Promise<AlignmentChart> => {
      setError(null)
      let clean: string
      try {
        clean = cleanTitle(title)
      } catch (err) {
        setError(errorMessage(err))
        throw err
      }
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('alignment_charts')
          .insert({ space_id: spaceId, title: clean })
          .select(CHART_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const created = toChart(data as unknown as ChartRow)
        upsertById(setCharts, created)
        return created
      }
      const created: AlignmentChart = {
        id: nextId(),
        title: clean,
        cells: emptyCells(),
        createdBy: selfId,
        createdAt: new Date().toISOString(),
      }
      setCharts((prev) => [...prev, created])
      return created
    },
    [spaceId, selfId],
  )

  const renameChart = useCallback(
    async (id: string, title: string) => {
      setError(null)
      let clean: string
      try {
        clean = cleanTitle(title)
      } catch (err) {
        setError(errorMessage(err))
        throw err
      }
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('alignment_charts').update({ title: clean }).eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean } : c)))
    },
    [spaceId],
  )

  const deleteChart = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('alignment_charts').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setCharts((prev) => prev.filter((c) => c.id !== id))
    },
    [spaceId],
  )

  // --- Inline square edit: optimistic first, resync on failure ---

  const setCell = useCallback(
    async (id: string, key: AlignmentKey, text: string) => {
      setError(null)
      setCharts((prev) => prev.map((c) => (c.id === id ? withCell(c, key, text) : c)))
      if (!supabase || !spaceId) return
      // A computed key widens to an index signature; this names the one column.
      const patch = { [key]: text.trim() } as Partial<Record<AlignmentKey, string>>
      const { error: err } = await supabase.from('alignment_charts').update(patch).eq('id', id)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, resync],
  )

  return { charts, loading, error, clearError, addChart, renameChart, deleteChart, setCell }
}
