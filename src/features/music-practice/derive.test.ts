import { describe, expect, it } from 'vitest'
import { KEYS, SCALES_CHORDS, randomPractice } from './derive'

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
