import type { AlignmentChart, AlignmentKey } from '../../types'

// Pure data shaping for the alignment charts: the fixed nine squares, their
// labels, and the picker order. No React, no Supabase.

/** The nine squares in reading order — rows Good → Neutral → Evil, columns
 *  Lawful → Neutral → Chaotic — which is also the grid's render order. */
export const ALIGNMENT_KEYS: readonly AlignmentKey[] = [
  'lawful_good',
  'neutral_good',
  'chaotic_good',
  'lawful_neutral',
  'true_neutral',
  'chaotic_neutral',
  'lawful_evil',
  'neutral_evil',
  'chaotic_evil',
]

const LABELS: Record<AlignmentKey, string> = {
  lawful_good: 'Lawful Good',
  neutral_good: 'Neutral Good',
  chaotic_good: 'Chaotic Good',
  lawful_neutral: 'Lawful Neutral',
  true_neutral: 'True Neutral',
  chaotic_neutral: 'Chaotic Neutral',
  lawful_evil: 'Lawful Evil',
  neutral_evil: 'Neutral Evil',
  chaotic_evil: 'Chaotic Evil',
}

/** A square's printed name: "Lawful Good", "True Neutral". */
export const alignmentLabel = (key: AlignmentKey): string => LABELS[key]

/** All nine squares blank — a new chart. */
export function emptyCells(): Record<AlignmentKey, string> {
  return Object.fromEntries(ALIGNMENT_KEYS.map((key) => [key, ''])) as Record<AlignmentKey, string>
}

/** Picker order: oldest first, so a new chart lands at the end of the row and
 *  the pills never reshuffle under you. */
export function sortCharts(charts: AlignmentChart[]): AlignmentChart[] {
  return [...charts].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

/** Where `/alignment` on its own forwards: the first chart, or null (empty state). */
export function defaultChart(charts: AlignmentChart[]): AlignmentChart | null {
  return sortCharts(charts)[0] ?? null
}

/** How many of the nine squares have something in them. */
export function filledCount(chart: AlignmentChart): number {
  return ALIGNMENT_KEYS.filter((key) => chart.cells[key].trim() !== '').length
}

/** A chart with one square changed (trimmed) — the store's optimistic write. */
export function withCell(chart: AlignmentChart, key: AlignmentKey, text: string): AlignmentChart {
  return { ...chart, cells: { ...chart.cells, [key]: text.trim() } }
}
