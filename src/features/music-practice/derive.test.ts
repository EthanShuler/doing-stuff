import { describe, expect, it } from 'vitest'
import type { PracticeDay } from '../../types'
import {
  CIRCLE,
  KEYS,
  SCALES_CHORDS,
  isCirclePos,
  keyForDate,
  mostRecentDay,
  previousDay,
  randomPractice,
} from './derive'

let counter = 0
function day(date: string, position: number): PracticeDay {
  counter += 1
  return { id: `p${counter}`, date, position, createdBy: 'u1', createdAt: `${date}T09:00:00Z` }
}

describe('randomPractice', () => {
  it('maps rng 0 to the first key and scale', () => {
    const zero = () => 0
    expect(randomPractice(zero)).toEqual({ keyIndex: 0, scaleIndex: 0 })
  })

  it('never runs off the end when rng approaches 1', () => {
    const almostOne = () => 0.999999
    const { keyIndex, scaleIndex } = randomPractice(almostOne)
    expect(keyIndex).toBe(KEYS.length - 1)
    expect(scaleIndex).toBe(SCALES_CHORDS.length - 1)
  })

  it('always draws in-range indices', () => {
    for (let i = 0; i < 100; i += 1) {
      const { keyIndex, scaleIndex } = randomPractice()
      expect(keyIndex).toBeGreaterThanOrEqual(0)
      expect(keyIndex).toBeLessThan(KEYS.length)
      expect(scaleIndex).toBeGreaterThanOrEqual(0)
      expect(scaleIndex).toBeLessThan(SCALES_CHORDS.length)
    }
  })
})

describe('CIRCLE', () => {
  it('has 12 slots indexed by position, starting at C', () => {
    expect(CIRCLE).toHaveLength(12)
    CIRCLE.forEach((k, i) => expect(k.pos).toBe(i))
    expect(CIRCLE[0].major).toBe('C')
    expect(CIRCLE[0].minor).toBe('Am')
    expect(CIRCLE[6].major).toContain('/') // the enharmonic slot carries both spellings
  })

  it('isCirclePos accepts 0–11 and rejects everything else', () => {
    expect(isCirclePos(0)).toBe(true)
    expect(isCirclePos(11)).toBe(true)
    expect(isCirclePos(12)).toBe(false)
    expect(isCirclePos(-1)).toBe(false)
    expect(isCirclePos(2.5)).toBe(false)
  })
})

describe('daily-key helpers', () => {
  const days = [day('2026-07-15', 0), day('2026-07-18', 5), day('2026-07-20', 2)]

  it('keyForDate returns the position for a logged day, null otherwise', () => {
    expect(keyForDate(days, '2026-07-18')).toBe(5)
    expect(keyForDate(days, '2026-07-19')).toBeNull()
    expect(keyForDate([], '2026-07-20')).toBeNull()
  })

  it('mostRecentDay picks the latest row on or before a date', () => {
    expect(mostRecentDay(days, '2026-07-20')?.position).toBe(2)
    expect(mostRecentDay(days, '2026-07-19')?.position).toBe(5) // 07-18, not future 07-20
    expect(mostRecentDay(days, '2026-07-14')).toBeNull()
  })

  it('previousDay is the latest row strictly before a date (carry-forward source)', () => {
    // On a fresh day with no row yet, carry forward the last practiced key.
    expect(previousDay(days, '2026-07-21')?.position).toBe(2)
    // On a day that IS logged, previousDay skips it to the one before.
    expect(previousDay(days, '2026-07-20')?.position).toBe(5)
    expect(previousDay(days, '2026-07-15')).toBeNull()
  })
})
