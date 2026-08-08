import { describe, expect, it } from 'vitest'
import type { LittleGuy, Profile } from '../../types'
import {
  buildMembers,
  countLine,
  filterLittleGuys,
  memberLabel,
  OWNER_ALL,
  OWNER_UNASSIGNED,
  ownerLabel,
  ownerOptions,
  sortLittleGuys,
} from './derive'

const guy = (overrides: Partial<LittleGuy>): LittleGuy => ({
  id: 'g1',
  name: 'Guy',
  imageUrl: '',
  source: '',
  ownerId: null,
  personality: '',
  description: '',
  createdBy: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const profiles: Profile[] = [
  { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
  { id: 'u2', email: 'jordan@example.com', displayName: null },
]

describe('buildMembers', () => {
  it('keeps join order and names members from their profiles', () => {
    expect(buildMembers(['u1', 'u2'], profiles)).toEqual([
      { id: 'u1', name: 'Avery' },
      // No display name → the local part of the email.
      { id: 'u2', name: 'jordan' },
    ])
  })

  it('leaves the name blank when the profile has not loaded', () => {
    expect(buildMembers(['u9'], profiles)).toEqual([{ id: 'u9', name: '' }])
    expect(memberLabel(buildMembers(['u9'], profiles)[0])).toBe('Member')
  })
})

describe('ownerLabel', () => {
  const members = buildMembers(['u1', 'u2'], profiles)

  it('names the owning member', () => {
    expect(ownerLabel(guy({ ownerId: 'u1' }), members)).toBe('Avery')
  })

  it('reads as nobody in particular with no owner', () => {
    expect(ownerLabel(guy({ ownerId: null }), members)).toBe('Nobody in particular')
  })

  it('falls back for an owner who is no longer a member', () => {
    expect(ownerLabel(guy({ ownerId: 'u7' }), members)).toBe('Someone else')
  })
})

describe('sortLittleGuys', () => {
  it('sorts A–Z ignoring case', () => {
    const guys = [guy({ id: 'a', name: 'peeker' }), guy({ id: 'b', name: 'Bartholomew' })]
    expect(sortLittleGuys(guys).map((g) => g.id)).toEqual(['b', 'a'])
  })

  it('breaks same-name ties by createdAt, oldest first', () => {
    const guys = [
      guy({ id: 'new', name: 'Steve', createdAt: '2026-05-01T00:00:00Z' }),
      guy({ id: 'old', name: 'Steve', createdAt: '2026-01-01T00:00:00Z' }),
    ]
    expect(sortLittleGuys(guys).map((g) => g.id)).toEqual(['old', 'new'])
  })

  it('does not mutate its input', () => {
    const guys = [guy({ id: 'z', name: 'Zed' }), guy({ id: 'a', name: 'Ann' })]
    sortLittleGuys(guys)
    expect(guys.map((g) => g.id)).toEqual(['z', 'a'])
  })
})

describe('filterLittleGuys', () => {
  const guys = [
    guy({ id: 'g1', name: 'Peeker', ownerId: 'u1' }),
    guy({ id: 'g2', name: 'Sleepy Steve', ownerId: 'u1' }),
    guy({ id: 'g3', name: 'Bartholomew', ownerId: 'u2' }),
    guy({ id: 'g4', name: 'Desk Guy', ownerId: null }),
  ]

  it('returns everything with no search and the All pill', () => {
    expect(filterLittleGuys(guys, '', OWNER_ALL)).toHaveLength(4)
  })

  it('fuzzy-matches names', () => {
    expect(filterLittleGuys(guys, 'stv', OWNER_ALL).map((g) => g.id)).toEqual(['g2'])
  })

  it('filters to one member’s guys', () => {
    expect(filterLittleGuys(guys, '', 'u1').map((g) => g.id)).toEqual(['g1', 'g2'])
  })

  it('filters to the ownerless ones', () => {
    expect(filterLittleGuys(guys, '', OWNER_UNASSIGNED).map((g) => g.id)).toEqual(['g4'])
  })

  it('applies search and owner together', () => {
    expect(filterLittleGuys(guys, 'peek', 'u2')).toEqual([])
    expect(filterLittleGuys(guys, 'peek', 'u1').map((g) => g.id)).toEqual(['g1'])
  })

  it('ignores whitespace-only searches', () => {
    expect(filterLittleGuys(guys, '   ', OWNER_ALL)).toHaveLength(4)
  })
})

describe('ownerOptions', () => {
  const members = buildMembers(['u1', 'u2'], profiles)

  it('counts All plus each member in join order', () => {
    const guys = [guy({ id: 'g1', ownerId: 'u1' }), guy({ id: 'g2', ownerId: 'u1' }), guy({ id: 'g3', ownerId: 'u2' })]
    expect(ownerOptions(guys, members)).toEqual([
      { value: OWNER_ALL, label: 'All', count: 3 },
      { value: 'u1', label: 'Avery', count: 2 },
      { value: 'u2', label: 'jordan', count: 1 },
    ])
  })

  it('adds the ownerless pill only when some guy has no owner', () => {
    const guys = [guy({ id: 'g1', ownerId: 'u1' }), guy({ id: 'g2', ownerId: null })]
    expect(ownerOptions(guys, members).at(-1)).toEqual({
      value: OWNER_UNASSIGNED,
      label: 'Nobody in particular',
      count: 1,
    })
  })

  it('is just the All pill for an empty collection with no members yet', () => {
    expect(ownerOptions([], [])).toEqual([{ value: OWNER_ALL, label: 'All', count: 0 }])
  })
})

describe('countLine', () => {
  it('pluralizes and stays blank when empty', () => {
    expect(countLine([])).toBe('')
    expect(countLine([guy({})])).toBe('1 little guy')
    expect(countLine([guy({ id: 'a' }), guy({ id: 'b' })])).toBe('2 little guys')
  })
})
