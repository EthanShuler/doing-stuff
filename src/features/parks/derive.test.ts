import { describe, expect, it } from 'vitest'
import type { ParkVisit } from '../../types'
import { PARKS, PARK_REGIONS, parkByCode } from './parks'
import {
  MEMBER_COLORS,
  buildMembers,
  filterParks,
  groupByRegion,
  memberColor,
  parkPin,
  parkStats,
  parkStatuses,
  sortVisits,
} from './derive'
import { pinVariant, separateVariant, togetherVariant } from './StatusDot'

const MEMBERS = ['u1', 'u2']

const visit = (over: Partial<ParkVisit>): ParkVisit => ({
  id: 'v1',
  parkCode: 'yose',
  date: '2024-01-01',
  notes: '',
  attendeeIds: ['u1'],
  separate: false,
  createdBy: 'u1',
  createdAt: '2024-01-02T09:00:00Z',
  ...over,
})

describe('the static dataset', () => {
  it('has exactly the 63 parks with unique codes', () => {
    expect(PARKS).toHaveLength(63)
    expect(new Set(PARKS.map((p) => p.code)).size).toBe(63)
  })

  it('only uses known regions and resolves codes', () => {
    for (const park of PARKS) {
      expect(PARK_REGIONS).toContain(park.region)
      expect(parkByCode(park.code)).toBe(park)
    }
    expect(parkByCode('nope')).toBeUndefined()
  })
})

describe('sortVisits', () => {
  it('orders dated trips newest first with undated ones after', () => {
    const sorted = sortVisits([
      visit({ id: 'a', date: null, createdAt: '2024-05-01T00:00:00Z' }),
      visit({ id: 'b', date: '2019-06-01' }),
      visit({ id: 'c', date: '2023-08-14' }),
      visit({ id: 'd', date: null, createdAt: '2024-06-01T00:00:00Z' }),
    ])
    expect(sorted.map((v) => v.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})

describe('parkStatuses', () => {
  it('derives visitors in member join order and groups by park', () => {
    const statuses = parkStatuses(
      [
        visit({ id: 'a', parkCode: 'yose', attendeeIds: ['u2'] }),
        visit({ id: 'b', parkCode: 'yose', date: '2019-06-01', attendeeIds: ['u1'] }),
        visit({ id: 'c', parkCode: 'zion', attendeeIds: ['u1'] }),
      ],
      MEMBERS,
    )
    expect(statuses.get('yose')?.visitorIds).toEqual(['u1', 'u2'])
    expect(statuses.get('zion')?.visitorIds).toEqual(['u1'])
    expect(statuses.get('acad')).toBeUndefined()
  })

  it('counts together only when one trip carried every member', () => {
    const statuses = parkStatuses(
      [
        // Both have been to yose — but never on the same trip.
        visit({ id: 'a', parkCode: 'yose', attendeeIds: ['u1'] }),
        visit({ id: 'b', parkCode: 'yose', date: '2019-06-01', attendeeIds: ['u2'] }),
        visit({ id: 'c', parkCode: 'zion', attendeeIds: ['u1', 'u2'] }),
      ],
      MEMBERS,
    )
    expect(statuses.get('yose')?.together).toBe(false)
    expect(statuses.get('zion')?.together).toBe(true)
  })

  it('never counts a separate-flagged row as together', () => {
    const statuses = parkStatuses(
      [visit({ attendeeIds: ['u1', 'u2'], separate: true })],
      MEMBERS,
    )
    expect(statuses.get('yose')?.together).toBe(false)
    expect(statuses.get('yose')?.visitorIds).toEqual(['u1', 'u2'])
  })

  it('never marks together in a one-member space', () => {
    const statuses = parkStatuses([visit({ attendeeIds: ['u1'] })], ['u1'])
    expect(statuses.get('yose')?.together).toBe(false)
    expect(statuses.get('yose')?.visitorIds).toEqual(['u1'])
  })

  it('ignores attendee ids that are not members', () => {
    const statuses = parkStatuses([visit({ attendeeIds: ['ghost'] })], MEMBERS)
    expect(statuses.get('yose')?.visitorIds).toEqual([])
    expect(statuses.get('yose')?.together).toBe(false)
  })
})

describe('parkStats', () => {
  it('counts parks per member plus shared trips', () => {
    const statuses = parkStatuses(
      [
        visit({ id: 'a', parkCode: 'yose', attendeeIds: ['u1', 'u2'] }),
        visit({ id: 'b', parkCode: 'yose', date: '2019-06-01', attendeeIds: ['u1'] }),
        visit({ id: 'c', parkCode: 'zion', attendeeIds: ['u1'] }),
        visit({ id: 'd', parkCode: 'acad', attendeeIds: ['u2'] }),
      ],
      MEMBERS,
    )
    const stats = parkStats(statuses, MEMBERS, 63)
    expect(stats.perMember).toEqual({ u1: 2, u2: 2 })
    expect(stats.together).toBe(1)
    expect(stats.total).toBe(63)
  })
})

describe('filterParks', () => {
  const statuses = parkStatuses(
    [
      visit({ id: 'a', parkCode: 'yose', attendeeIds: ['u1', 'u2'] }),
      visit({ id: 'b', parkCode: 'zion', attendeeIds: ['u1'] }),
    ],
    MEMBERS,
  )

  it('passes everything through for all', () => {
    expect(filterParks(PARKS, statuses, 'all')).toHaveLength(63)
  })

  it('keeps only untouched parks for unvisited', () => {
    const codes = filterParks(PARKS, statuses, 'unvisited').map((p) => p.code)
    expect(codes).toHaveLength(61)
    expect(codes).not.toContain('yose')
    expect(codes).not.toContain('zion')
  })

  it('keeps shared trips for together and per-member parks for a member', () => {
    expect(filterParks(PARKS, statuses, 'together').map((p) => p.code)).toEqual(['yose'])
    expect(filterParks(PARKS, statuses, { memberId: 'u1' }).map((p) => p.code).sort()).toEqual([
      'yose',
      'zion',
    ])
    expect(filterParks(PARKS, statuses, { memberId: 'u2' }).map((p) => p.code)).toEqual(['yose'])
  })
})

describe('groupByRegion', () => {
  it('sections the full list in canonical region order', () => {
    const groups = groupByRegion(PARKS)
    expect(groups.map((g) => g.region)).toEqual([...PARK_REGIONS])
    expect(groups.reduce((n, g) => n + g.parks.length, 0)).toBe(63)
  })

  it('drops regions a filter emptied', () => {
    const alaskaOnly = PARKS.filter((p) => p.region === 'Alaska')
    expect(groupByRegion(alaskaOnly)).toEqual([{ region: 'Alaska', parks: alaskaOnly }])
  })
})

describe('pins and members', () => {
  const members = buildMembers(MEMBERS, [
    { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
    { id: 'u2', email: 'jordan@example.com', displayName: null },
  ])

  it('assigns person-fixed colors by join order with profile names', () => {
    expect(members).toEqual([
      { id: 'u1', name: 'Avery', color: MEMBER_COLORS[0] },
      { id: 'u2', name: 'jordan', color: MEMBER_COLORS[1] },
    ])
  })

  it('encodes pin state from a park status', () => {
    const statuses = parkStatuses(
      [
        visit({ id: 'a', parkCode: 'yose', attendeeIds: ['u1', 'u2'] }),
        visit({ id: 'b', parkCode: 'zion', attendeeIds: ['u2'] }),
        // Everyone has been to grca — via a flagged shorthand row.
        visit({ id: 'c', parkCode: 'grca', attendeeIds: ['u1', 'u2'], separate: true }),
        // …and to romo — via one solo row per person. Same derived state.
        visit({ id: 'd', parkCode: 'romo', attendeeIds: ['u1'] }),
        visit({ id: 'e', parkCode: 'romo', date: '2019-06-01', attendeeIds: ['u2'] }),
      ],
      MEMBERS,
    )
    expect(parkPin(statuses.get('yose'), MEMBERS)).toBe('together')
    expect(parkPin(statuses.get('zion'), MEMBERS)).toEqual({ memberId: 'u2' })
    expect(parkPin(statuses.get('grca'), MEMBERS)).toBe('separate')
    expect(parkPin(statuses.get('romo'), MEMBERS)).toBe('separate')
    expect(parkPin(statuses.get('acad'), MEMBERS)).toBe('none')
    // A one-member space can't be 'separate' — it's just that member's pin.
    const solo = parkStatuses([visit({ attendeeIds: ['u1'] })], ['u1'])
    expect(parkPin(solo.get('yose'), ['u1'])).toEqual({ memberId: 'u1' })
  })

  it('resolves member colors with a fallback for unknown ids', () => {
    expect(memberColor('u2', members)).toBe(MEMBER_COLORS[1])
    expect(memberColor('ghost', members)).toBe(MEMBER_COLORS[0])
  })

  it('renders combined states as shapes, not new hues', () => {
    // Colorblind-safe: together is a ring of the two member colors,
    // separately a split of them — no third color to distinguish by hue.
    expect(pinVariant('none', members)).toEqual({ kind: 'faint' })
    expect(pinVariant({ memberId: 'u1' }, members)).toEqual({ kind: 'solid', color: MEMBER_COLORS[0] })
    expect(pinVariant('together', members)).toEqual(togetherVariant(members))
    expect(togetherVariant(members)).toEqual({ kind: 'ring', outer: MEMBER_COLORS[0], inner: MEMBER_COLORS[1] })
    expect(separateVariant(members)).toEqual({ kind: 'split', left: MEMBER_COLORS[0], right: MEMBER_COLORS[1] })
  })
})
