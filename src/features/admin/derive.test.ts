import { describe, expect, it } from 'vitest'
import { FEATURES } from '../../layout/features'
import {
  ALL_FEATURE_KEYS,
  type AdminSpace,
  type AdminUser,
  featureDraft,
  featureSummary,
  featuresToSave,
  isValidEmail,
  lastSignInLabel,
  memberNames,
  membersLine,
  mergeMembership,
  sameIds,
  setPasswordLink,
  spaceNameError,
  spacesOfUser,
  toggleId,
  userLabel,
} from './derive'

const user = (over: Partial<AdminUser> & { id: string }): AdminUser => ({
  email: `${over.id}@example.com`,
  displayName: null,
  lastSignInAt: null,
  hasPassword: true,
  isAdmin: false,
  spaceIds: [],
  ...over,
})

const space = (over: Partial<AdminSpace> & { id: string }): AdminSpace => ({
  name: over.id,
  enabledFeatures: null,
  memberIds: [],
  ...over,
})

describe('userLabel', () => {
  it('prefers the display name, trimmed', () => {
    expect(userLabel({ displayName: '  Avery ', email: 'a@example.com' })).toBe('Avery')
  })
  it('falls back to the email local part for a missing or blank name', () => {
    expect(userLabel({ displayName: null, email: 'sam.lee@example.com' })).toBe('sam.lee')
    expect(userLabel({ displayName: '   ', email: 'sam@example.com' })).toBe('sam')
  })
})

describe('users ↔ spaces', () => {
  const spaces = [space({ id: 's1', name: 'Home' }), space({ id: 's2', name: 'Friends' })]
  const users = [
    user({ id: 'u1', displayName: 'Avery' }),
    user({ id: 'u2', displayName: null, email: 'jordan@example.com' }),
  ]

  it('lists a person’s spaces in their join order, skipping unknown ids', () => {
    const u = user({ id: 'u1', spaceIds: ['s2', 'gone', 's1'] })
    expect(spacesOfUser(u, spaces).map((s) => s.name)).toEqual(['Friends', 'Home'])
  })

  it('names a space’s members in join order', () => {
    const s = space({ id: 's1', memberIds: ['u2', 'u1', 'gone'] })
    expect(memberNames(s, users)).toEqual(['jordan', 'Avery'])
    expect(membersLine(s, users)).toBe('jordan, Avery')
  })

  it('says so when a space has nobody', () => {
    expect(membersLine(space({ id: 's1' }), users)).toBe('No members')
  })
})

describe('featureSummary', () => {
  it('reads null as every feature', () => {
    expect(featureSummary(null)).toBe('All features')
  })
  it('counts the features that still exist', () => {
    expect(featureSummary(['recipes', 'lists', 'seasons', 'parks'])).toBe('4 features')
    expect(featureSummary(['recipes', 'long-gone'])).toBe('1 feature')
    expect(featureSummary([])).toBe('No features')
  })
})

describe('lastSignInLabel', () => {
  it('says Never for a null timestamp', () => {
    expect(lastSignInLabel(null)).toBe('Never')
  })
  it('shows the local date with the year', () => {
    // Midday UTC, so the local date is the same day in any US/EU zone.
    expect(lastSignInLabel('2026-11-03T12:00:00Z')).toBe('Nov 3, 2026')
  })
})

describe('validation', () => {
  it('accepts a plausible email, trimmed', () => {
    expect(isValidEmail(' sam@example.com ')).toBe(true)
  })
  it('rejects malformed or overlong emails', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('sam')).toBe(false)
    expect(isValidEmail('sam@example')).toBe(false)
    expect(isValidEmail('sam @example.com')).toBe(false)
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
  it('requires a non-blank space name', () => {
    expect(spaceNameError('Book club')).toBeNull()
    expect(spaceNameError('   ')).toBe('A space needs a name.')
  })
})

describe('setPasswordLink', () => {
  it('puts the encoded token in the fragment of /set-password', () => {
    expect(setPasswordLink('https://cajubinile.com', 'abc+/=123')).toBe(
      'https://cajubinile.com/set-password#token_hash=abc%2B%2F%3D123',
    )
  })
})

describe('toggleId', () => {
  it('appends a new id once and removes one', () => {
    expect(toggleId(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleId(['a', 'b'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleId(['a', 'b'], 'a', false)).toEqual(['b'])
  })
})

describe('sameIds', () => {
  it('ignores order but not membership', () => {
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameIds(['a'], ['a', 'b'])).toBe(false)
    expect(sameIds(['a', 'c'], ['a', 'b'])).toBe(false)
    expect(sameIds([], [])).toBe(true)
  })
})

describe('mergeMembership', () => {
  it('applies only this modal’s changes on top of the fresh list', () => {
    // Opened with [a, b]; the admin removed b and added c. Meanwhile another
    // tab added d. d must survive, b must go, c must come.
    expect(mergeMembership(['a', 'b', 'd'], ['a', 'b'], ['a', 'c'])).toEqual(['a', 'd', 'c'])
  })
  it('doesn’t re-add something removed elsewhere that this modal left alone', () => {
    expect(mergeMembership(['a'], ['a', 'b'], ['a', 'b'])).toEqual(['a'])
  })
  it('doesn’t duplicate an id both sides added', () => {
    expect(mergeMembership(['a', 'c'], ['a'], ['a', 'c'])).toEqual(['a', 'c'])
  })
  it('is the desired list when nothing changed elsewhere', () => {
    expect(mergeMembership(['a', 'b'], ['a', 'b'], [])).toEqual([])
    expect(mergeMembership([], [], ['x', 'y'])).toEqual(['x', 'y'])
  })
})

describe('feature checkboxes', () => {
  it('covers every feature, in nav order', () => {
    expect(ALL_FEATURE_KEYS).toEqual(FEATURES.map((f) => f.key))
  })
  it('opens null as "All" with every box ticked', () => {
    expect(featureDraft(null)).toEqual({ all: true, keys: ALL_FEATURE_KEYS })
  })
  it('opens an allow-list in nav order, dropping unknown keys', () => {
    expect(featureDraft(['recipes', 'gone', 'lists'])).toEqual({ all: false, keys: ['lists', 'recipes'] })
  })
  it('saves "All" as null and a pick in nav order', () => {
    expect(featuresToSave(true, ['lists'])).toBeNull()
    expect(featuresToSave(false, ['seasons', 'recipes', 'lists'])).toEqual(['lists', 'recipes', 'seasons'])
    expect(featuresToSave(false, [])).toEqual([])
  })
})
