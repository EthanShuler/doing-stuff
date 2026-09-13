import { describe, expect, it } from 'vitest'
import type { ListItem } from '../../types'
import {
  isDone,
  kindColumn,
  listIdOf,
  listIsPersonal,
  nextPosition,
  pruneListDef,
  refFor,
  refOf,
  sortListItems,
} from './derive'

// --- factory ------------------------------------------------------------------

let seq = 0
function row(over: Partial<ListItem> = {}): ListItem {
  seq += 1
  return {
    id: `w${seq}`,
    key: 'movie',
    title: `Row ${seq}`,
    imageUrl: '',
    creator: '',
    position: seq,
    tierItemId: null,
    doneOn: null,
    createdBy: 'u1',
    createdAt: `2026-07-0${(seq % 9) + 1}T00:00:00Z`,
    ...over,
  }
}

// --- refs ---------------------------------------------------------------------

describe('list refs', () => {
  it('round-trips a free-form list id', () => {
    const ref = refFor('g1')
    expect(ref).toBe('custom:g1')
    expect(listIdOf(ref)).toBe('g1')
    expect(refOf('custom', 'g1')).toBe(ref)
  })

  it('built-ins carry no list id', () => {
    expect(listIdOf('movie')).toBeNull()
    expect(listIdOf('tv')).toBeNull()
    expect(listIdOf('book')).toBeNull()
    expect(refOf('book', null)).toBe('book')
  })

  it('kindColumn writes the built-in kind, or custom for a list', () => {
    expect(kindColumn('movie')).toBe('movie')
    expect(kindColumn('book')).toBe('book')
    expect(kindColumn('custom:g1')).toBe('custom')
  })
})

describe('listIsPersonal', () => {
  it('only the reading list is per person', () => {
    expect(listIsPersonal('book')).toBe(true)
    expect(listIsPersonal('movie')).toBe(false)
    expect(listIsPersonal('tv')).toBe(false)
  })

  it('a free-form list is shared', () => {
    expect(listIsPersonal('custom:g1')).toBe(false)
  })
})

// --- done ---------------------------------------------------------------------

describe('isDone', () => {
  it('an open row has neither marker', () => {
    expect(isDone(row())).toBe(false)
  })

  it('a media row is done once it links to a tier item', () => {
    expect(isDone(row({ tierItemId: 't1' }))).toBe(true)
  })

  it('a free-form row is done once it has a date', () => {
    expect(isDone(row({ key: 'custom:g1', doneOn: '2026-09-12' }))).toBe(true)
  })

  it('clearing the link reopens a media row (the FK set-null path)', () => {
    expect(isDone(row({ tierItemId: null, doneOn: null }))).toBe(false)
  })
})

// --- ordering -----------------------------------------------------------------

describe('sortListItems', () => {
  it('orders open rows by position (top = next up)', () => {
    const second = row({ position: 2 })
    const first = row({ position: 1 })
    expect(sortListItems([second, first]).map((w) => w.id)).toEqual([first.id, second.id])
  })

  it('fractional positions land between their neighbors', () => {
    const a = row({ position: 1 })
    const b = row({ position: 2 })
    const between = row({ position: 1.5 })
    expect(sortListItems([a, b, between]).map((w) => w.id)).toEqual([a.id, between.id, b.id])
  })

  it('checked-off rows sink below open ones, keeping their queue order', () => {
    const doneLate = row({ position: 3, tierItemId: 'x' })
    const open = row({ position: 2 })
    const doneEarly = row({ position: 1, tierItemId: 'y' })
    expect(sortListItems([doneLate, open, doneEarly]).map((w) => w.id)).toEqual([
      open.id,
      doneEarly.id,
      doneLate.id,
    ])
  })

  it('a dated free-form row sinks the same way', () => {
    const done = row({ key: 'custom:g1', position: 1, doneOn: '2026-09-12' })
    const open = row({ key: 'custom:g1', position: 2 })
    expect(sortListItems([done, open]).map((w) => w.id)).toEqual([open.id, done.id])
  })

  it('ties (e.g. legacy rows all at 0) break by createdAt, oldest first', () => {
    const newer = row({ position: 0, createdAt: '2026-06-02T00:00:00Z' })
    const older = row({ position: 0, createdAt: '2026-06-01T00:00:00Z' })
    expect(sortListItems([newer, older]).map((w) => w.id)).toEqual([older.id, newer.id])
  })

  it('never mutates the input', () => {
    const input = [row({ position: 2 }), row({ position: 1 })]
    const ids = input.map((w) => w.id)
    sortListItems(input)
    expect(input.map((w) => w.id)).toEqual(ids)
  })
})

describe('nextPosition', () => {
  it('appends after the list’s highest position', () => {
    const items = [row({ position: 4 }), row({ position: 1.5 })]
    expect(nextPosition(items, 'movie')).toBe(5)
  })

  it('ignores other lists', () => {
    const items = [row({ key: 'tv', position: 9 }), row({ key: 'movie', position: 2 })]
    expect(nextPosition(items, 'movie')).toBe(3)
  })

  it('starts an empty list at 1', () => {
    expect(nextPosition([], 'movie')).toBe(1)
  })

  it('queues a free-form list separately from the built-ins', () => {
    const items = [row({ key: 'movie', position: 9 }), row({ key: 'custom:g1', position: 2 })]
    expect(nextPosition(items, 'custom:g1')).toBe(3)
  })
})

// --- deleting a list ----------------------------------------------------------

describe('pruneListDef', () => {
  it('removes only the deleted list’s rows', () => {
    const mine = row({ key: 'custom:g1' })
    const alsoMine = row({ key: 'custom:g1' })
    const other = row({ key: 'movie' })
    const another = row({ key: 'custom:g2' })
    expect(pruneListDef([mine, alsoMine, other, another], 'g1').map((w) => w.id)).toEqual([
      other.id,
      another.id,
    ])
  })

  it('leaves a snapshot with nothing on that list alone', () => {
    const keep = row({ key: 'custom:g2' })
    expect(pruneListDef([keep], 'g1')).toEqual([keep])
  })
})
