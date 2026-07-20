// Pure data + logic for the music-practice feature: the scale/chord and key
// reference tables plus the practice-prompt randomizer. No React in here —
// covered by derive.test.ts.

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
