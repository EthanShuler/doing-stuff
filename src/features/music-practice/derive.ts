// Pure data + logic for the music-practice feature: the scale/chord and key
// reference tables, the practice-prompt randomizer (Piano), and the
// circle-of-fifths wheel data + daily-key helpers (Bassoon). No React in
// here — covered by derive.test.ts.

import type { PracticeDay } from '../../types'

/** A scale paired with the chord symbol it voices over. */
export type ScaleChord = { scale: string; chord: string }

/** The scales/chords cycled through on the Piano practice screen. */
export const SCALES_CHORDS: readonly ScaleChord[] = [
  { scale: 'Major/Ionian', chord: 'Δ7' },
  { scale: 'Dorian', chord: '–7' },
  { scale: 'Phrygian', chord: 'phryg' },
  { scale: 'Lydian', chord: 'Δ+4' },
  { scale: 'Mixolydian', chord: '7' },
  { scale: 'Mixolydian', chord: 'sus' },
  { scale: 'Natural Minor/Aeolian', chord: '-6' },
  { scale: 'Locrian', chord: 'ø7 (-7♭5)' },
  { scale: 'Melodic Minor', chord: '-Δ' },
  { scale: 'Lydian Augmented', chord: 'Δ+5' },
  { scale: 'Lydian Dominant', chord: '7+11' },
  { scale: 'half-diminished (locrian ♯2)', chord: 'ø7 (-7♭5)' },
  { scale: 'Altered', chord: 'alt' },
  { scale: 'Diminished (half-whole)', chord: '7♭9' },
]

/** The twelve keys, spelled the way we practice them. */
export const KEYS: readonly string[] = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

/** A drawn practice prompt: indices into KEYS and SCALES_CHORDS. */
export type Practice = { keyIndex: number; scaleIndex: number }

/**
 * Draw a random key + scale/chord to practice. `rng` defaults to Math.random
 * and is injectable so the draw stays testable (rng is the only impure bit).
 */
export function randomPractice(rng: () => number = Math.random): Practice {
  return {
    keyIndex: Math.floor(rng() * KEYS.length),
    scaleIndex: Math.floor(rng() * SCALES_CHORDS.length),
  }
}

// --- Bassoon: the circle of fifths ------------------------------------------

/** One slot on the circle of fifths. `pos` is the clockwise index (0 = C) and
 *  is exactly what a practice day stores in `position`. */
export type CircleKey = {
  pos: number
  /** Major key — the primary label (outer ring). */
  major: string
  /** Relative minor — reference only (inner ring). */
  minor: string
  /** Key signature label, e.g. '2♯', '3♭', '0'. */
  keySig: string
}

/** The twelve slots, clockwise from C. The 6-o'clock slot is enharmonic
 *  (G♭ = F♯), so it carries both spellings. Index === `pos` === the stored
 *  `position`, so callers can index CIRCLE directly. */
export const CIRCLE: readonly CircleKey[] = [
  { pos: 0, major: 'C', minor: 'Am', keySig: '0' },
  { pos: 1, major: 'G', minor: 'Em', keySig: '1♯' },
  { pos: 2, major: 'D', minor: 'Bm', keySig: '2♯' },
  { pos: 3, major: 'A', minor: 'F♯m', keySig: '3♯' },
  { pos: 4, major: 'E', minor: 'C♯m', keySig: '4♯' },
  { pos: 5, major: 'B', minor: 'G♯m', keySig: '5♯' },
  { pos: 6, major: 'G♭/F♯', minor: 'E♭m/D♯m', keySig: '6♭/6♯' },
  { pos: 7, major: 'D♭', minor: 'B♭m', keySig: '5♭' },
  { pos: 8, major: 'A♭', minor: 'Fm', keySig: '4♭' },
  { pos: 9, major: 'E♭', minor: 'Cm', keySig: '3♭' },
  { pos: 10, major: 'B♭', minor: 'Gm', keySig: '2♭' },
  { pos: 11, major: 'F', minor: 'Dm', keySig: '1♭' },
]

/** True if `pos` is a real circle slot (guards a value read from the DB). */
export function isCirclePos(pos: number): boolean {
  return Number.isInteger(pos) && pos >= 0 && pos < CIRCLE.length
}

/** The position chosen on `date`, or null if that day has no row. */
export function keyForDate(days: PracticeDay[], date: string): number | null {
  const row = days.find((d) => d.date === date)
  return row ? row.position : null
}

/** The most recent logged day on or before `onOrBefore` (null if none). ISO
 *  date strings compare lexicographically, so no Date math is needed. */
export function mostRecentDay(days: PracticeDay[], onOrBefore: string): PracticeDay | null {
  let best: PracticeDay | null = null
  for (const d of days) {
    if (d.date <= onOrBefore && (!best || d.date > best.date)) best = d
  }
  return best
}

/** The most recent logged day strictly before `date` (null if none) — powers
 *  both the carry-forward pre-highlight and the "last practiced" line. */
export function previousDay(days: PracticeDay[], date: string): PracticeDay | null {
  return mostRecentDay(days.filter((d) => d.date !== date), date)
}

/** Logged days newest-first — the order the Bassoon history list renders in.
 *  ISO date strings sort lexicographically, so no Date math is needed. */
export function daysDescending(days: PracticeDay[]): PracticeDay[] {
  return [...days].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
