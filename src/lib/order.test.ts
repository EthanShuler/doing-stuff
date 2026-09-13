import { describe, expect, it } from 'vitest'
import { positionBetween, renormalizedPositions } from './order'

describe('positionBetween', () => {
  it('starts an empty tier at 1', () => {
    expect(positionBetween(null, null)).toBe(1)
  })

  it('prepends below the first position', () => {
    expect(positionBetween(null, 5)).toBe(4)
  })

  it('appends above the last position', () => {
    expect(positionBetween(5, null)).toBe(6)
  })

  it('splits the gap between neighbors', () => {
    expect(positionBetween(1, 2)).toBe(1.5)
  })

  it('returns null when float precision is exhausted', () => {
    expect(positionBetween(1, 1 + Number.EPSILON)).toBeNull()
    expect(positionBetween(1, 1)).toBeNull()
  })
})

describe('renormalizedPositions', () => {
  it('rewrites an ordering at integer steps', () => {
    expect(renormalizedPositions(['x', 'y', 'z'])).toEqual([
      { itemId: 'x', position: 1 },
      { itemId: 'y', position: 2 },
      { itemId: 'z', position: 3 },
    ])
  })
})
