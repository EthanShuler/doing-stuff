import { describe, expect, it } from 'vitest'
import type { Profile } from '../types'
import { withSpaceNames } from './spaceSync'

const profiles: Profile[] = [
  { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
  { id: 'u2', email: 'jordan@example.com', displayName: null },
  { id: 'x9', email: 'other@example.com', displayName: 'Outsider' },
]

describe('withSpaceNames', () => {
  it('swaps in a member’s name for this space', () => {
    const named = withSpaceNames(profiles, [
      { user_id: 'u1', display_name: 'Ave' },
      { user_id: 'u2', display_name: ' Jo ' },
    ])
    expect(named.map((p) => p.displayName)).toEqual(['Ave', 'Jo', 'Outsider'])
  })

  it('keeps the profile name when the space has none', () => {
    const named = withSpaceNames(profiles, [
      { user_id: 'u1', display_name: null },
      { user_id: 'u2', display_name: '   ' },
    ])
    expect(named).toEqual(profiles)
  })

  it('never mutates the profiles it was given', () => {
    withSpaceNames(profiles, [{ user_id: 'u1', display_name: 'Ave' }])
    expect(profiles[0].displayName).toBe('Avery')
  })
})
