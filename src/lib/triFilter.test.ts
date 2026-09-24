import { describe, expect, it } from 'vitest'
import { cycleTri, keysIn, pickKeys, triMatcher } from './triFilter'

describe('cycleTri', () => {
  it('cycles off → include → exclude → off on click', () => {
    let s = cycleTri({}, 'a', 'forward')
    expect(s).toEqual({ a: 'include' })
    s = cycleTri(s, 'a', 'forward')
    expect(s).toEqual({ a: 'exclude' })
    expect(cycleTri(s, 'a', 'forward')).toEqual({})
  })

  it('runs the cycle backwards on right-click', () => {
    let s = cycleTri({}, 'a', 'back')
    expect(s).toEqual({ a: 'exclude' })
    s = cycleTri(s, 'a', 'back')
    expect(s).toEqual({ a: 'include' })
    expect(cycleTri(s, 'a', 'back')).toEqual({})
  })

  it('leaves other keys and the input alone', () => {
    const before = { b: 'exclude' } as const
    expect(cycleTri(before, 'a', 'forward')).toEqual({ a: 'include', b: 'exclude' })
    expect(before).toEqual({ b: 'exclude' })
  })
})

describe('keysIn / pickKeys', () => {
  it('lists keys by state and drops keys that no longer exist', () => {
    const s = { a: 'include', b: 'exclude', c: 'include' } as const
    expect(keysIn(s, 'include')).toEqual(['a', 'c'])
    expect(pickKeys(s, ['b', 'c', 'z'])).toEqual({ b: 'exclude', c: 'include' })
  })
})

describe('triMatcher', () => {
  it('ORs includes, vetoes excludes, and matches everything when empty', () => {
    expect(triMatcher({})([])).toBe(true)
    const m = triMatcher({ a: 'include', b: 'include', x: 'exclude' })
    expect(m(['a'])).toBe(true)
    expect(m(['b', 'c'])).toBe(true)
    expect(m(['a', 'x'])).toBe(false)
    expect(m(['c'])).toBe(false)
    expect(m([])).toBe(false)
  })

  it('keeps keyless rows under an exclude-only filter', () => {
    expect(triMatcher({ x: 'exclude' })([])).toBe(true)
  })
})
