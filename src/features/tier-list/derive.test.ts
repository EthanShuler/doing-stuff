import { describe, expect, it } from 'vitest'
import type { TierItem, TierPlacement, TierRead } from '../../types'
import {
  TIERS,
  datesArePersonal,
  deriveBoard,
  distinctTags,
  filterByTags,
  findContainer,
  listIsPersonal,
  moveItem,
  normalizeTags,
  positionBetween,
  renormalizedPositions,
  tierSwatch,
} from './derive'
import { palette } from '../../theme'

// --- factories ---------------------------------------------------------------

let seq = 0
function item(over: Partial<TierItem> = {}): TierItem {
  seq += 1
  return {
    id: `i${seq}`,
    kind: 'movie',
    title: `Item ${seq}`,
    imageUrl: '',
    // Watched by default — a null watchedOn diverts unplaced items to the
    // unwatched shelf, which the shelf-split tests exercise explicitly.
    watchedOn: '2026-06-15',
    tags: [],
    creator: '',
    createdBy: 'u1',
    createdAt: `2026-07-0${(seq % 9) + 1}T00:00:00Z`,
    ...over,
  }
}

function placement(over: Partial<TierPlacement> = {}): TierPlacement {
  seq += 1
  return { id: `p${seq}`, itemId: 'i1', userId: 'u1', tier: 'A', position: 1, ...over }
}

function read(over: Partial<TierRead> = {}): TierRead {
  seq += 1
  return { id: `r${seq}`, itemId: 'i1', userId: 'u1', readOn: '2026-06-20', ...over }
}

// --- deriveBoard ---------------------------------------------------------------

describe('deriveBoard', () => {
  it('filters items by kind', () => {
    const movie = item({ kind: 'movie' })
    const show = item({ kind: 'tv' })
    const board = deriveBoard([movie, show], [], [], 'u1', 'movie')
    expect(board.unranked).toEqual([movie])
  })

  it('only applies the viewer own placements', () => {
    const a = item()
    const mine = placement({ itemId: a.id, userId: 'u1', tier: 'S' })
    const theirs = placement({ itemId: a.id, userId: 'u2', tier: 'F' })
    const board = deriveBoard([a], [mine, theirs], [], 'u1', 'movie')
    expect(board.tiers.S).toEqual([a])
    expect(board.tiers.F).toEqual([])
  })

  it('an item placed only by the partner stays unranked for me', () => {
    const a = item()
    const theirs = placement({ itemId: a.id, userId: 'u2', tier: 'S' })
    const board = deriveBoard([a], [theirs], [], 'u1', 'movie')
    expect(board.unranked).toEqual([a])
    expect(board.tiers.S).toEqual([])
  })

  it('sorts a tier by position with createdAt tiebreak', () => {
    const first = item({ createdAt: '2026-01-01T00:00:00Z' })
    const second = item({ createdAt: '2026-01-02T00:00:00Z' })
    const third = item({ createdAt: '2026-01-03T00:00:00Z' })
    const board = deriveBoard(
      [third, first, second],
      [
        placement({ itemId: second.id, tier: 'B', position: 2 }),
        placement({ itemId: first.id, tier: 'B', position: 1 }),
        // Same position as `first` — createdAt breaks the tie.
        placement({ itemId: third.id, tier: 'B', position: 1 }),
      ],
      [],
      'u1',
      'movie',
    )
    expect(board.tiers.B.map((i) => i.id)).toEqual([first.id, third.id, second.id])
  })

  it('sorts the unranked shelf by createdAt (oldest first)', () => {
    const newer = item({ createdAt: '2026-06-02T00:00:00Z' })
    const older = item({ createdAt: '2026-06-01T00:00:00Z' })
    const board = deriveBoard([newer, older], [], [], 'u1', 'movie')
    expect(board.unranked.map((i) => i.id)).toEqual([older.id, newer.id])
  })

  it('splits unplaced items between the shelves by watched date', () => {
    const watched = item({ watchedOn: '2026-06-01' })
    const undated = item({ watchedOn: null })
    const board = deriveBoard([watched, undated], [], [], 'u1', 'movie')
    expect(board.unranked).toEqual([watched])
    expect(board.unwatched).toEqual([undated])
  })

  it('a placement wins over a missing watched date', () => {
    const a = item({ watchedOn: null })
    const board = deriveBoard([a], [placement({ itemId: a.id, tier: 'B' })], [], 'u1', 'movie')
    expect(board.tiers.B).toEqual([a])
    expect(board.unwatched).toEqual([])
  })

  it('sorts the unwatched shelf by createdAt (oldest first)', () => {
    const newer = item({ watchedOn: null, createdAt: '2026-06-02T00:00:00Z' })
    const older = item({ watchedOn: null, createdAt: '2026-06-01T00:00:00Z' })
    const board = deriveBoard([newer, older], [], [], 'u1', 'movie')
    expect(board.unwatched.map((i) => i.id)).toEqual([older.id, newer.id])
  })

  it('ignores placements whose item is gone', () => {
    const board = deriveBoard([], [placement({ itemId: 'ghost', tier: 'S' })], [], 'u1', 'movie')
    expect(board.tiers.S).toEqual([])
  })

  it('handles a null viewer (everything unranked)', () => {
    const a = item()
    const board = deriveBoard([a], [placement({ itemId: a.id })], [], null, 'movie')
    expect(board.unranked).toEqual([a])
  })
})

// --- deriveBoard: books (per-person read state) ---------------------------------

describe('deriveBoard for books', () => {
  it('a book with no read record for the viewer sits on the unread shelf', () => {
    const a = item({ kind: 'book', watchedOn: null })
    const board = deriveBoard([a], [], [], 'u1', 'book')
    expect(board.unwatched).toEqual([a])
    expect(board.unranked).toEqual([])
  })

  it("the partner's read record does not mark it read for me", () => {
    const a = item({ kind: 'book', watchedOn: null })
    const board = deriveBoard([a], [], [read({ itemId: a.id, userId: 'u2' })], 'u1', 'book')
    expect(board.unwatched).toEqual([a])
    expect(board.unranked).toEqual([])
  })

  it('my own read record moves it to my unranked shelf', () => {
    const a = item({ kind: 'book', watchedOn: null })
    const board = deriveBoard([a], [], [read({ itemId: a.id, userId: 'u1' })], 'u1', 'book')
    expect(board.unranked).toEqual([a])
    expect(board.unwatched).toEqual([])
  })

  it('each viewer splits the same pool by their own reads', () => {
    const a = item({ kind: 'book', watchedOn: null })
    const reads = [read({ itemId: a.id, userId: 'u2' })]
    expect(deriveBoard([a], [], reads, 'u2', 'book').unranked).toEqual([a])
    expect(deriveBoard([a], [], reads, 'u1', 'book').unwatched).toEqual([a])
  })

  it('ignores the shared watched date for books', () => {
    const a = item({ kind: 'book', watchedOn: '2026-06-01' })
    const board = deriveBoard([a], [], [], 'u1', 'book')
    expect(board.unwatched).toEqual([a])
  })

  it('a placement wins over a missing read record', () => {
    const a = item({ kind: 'book', watchedOn: null })
    const board = deriveBoard([a], [placement({ itemId: a.id, tier: 'B' })], [], 'u1', 'book')
    expect(board.tiers.B).toEqual([a])
    expect(board.unwatched).toEqual([])
  })

  it('movies ignore read records — the shared watched date still rules', () => {
    const a = item({ kind: 'movie', watchedOn: null })
    const board = deriveBoard([a], [], [read({ itemId: a.id, userId: 'u1' })], 'u1', 'movie')
    expect(board.unwatched).toEqual([a])
  })
})

// --- deriveBoard: ice cream (shared tried state, no visible dates) --------------

describe('deriveBoard for ice cream', () => {
  it('an untried flavor (null watchedOn) sits on the Not tried shelf', () => {
    const a = item({ kind: 'ice-cream', watchedOn: null })
    const board = deriveBoard([a], [], [], 'u1', 'ice-cream')
    expect(board.unwatched).toEqual([a])
    expect(board.unranked).toEqual([])
  })

  it('the tried marker is shared — both viewers see it off the shelf', () => {
    const a = item({ kind: 'ice-cream', watchedOn: '2026-06-07' })
    expect(deriveBoard([a], [], [], 'u1', 'ice-cream').unranked).toEqual([a])
    expect(deriveBoard([a], [], [], 'u2', 'ice-cream').unranked).toEqual([a])
  })

  it('ignores read records — only the shared marker rules', () => {
    const a = item({ kind: 'ice-cream', watchedOn: null })
    const board = deriveBoard([a], [], [read({ itemId: a.id, userId: 'u1' })], 'u1', 'ice-cream')
    expect(board.unwatched).toEqual([a])
  })

  it('a placement wins over a missing tried marker', () => {
    const a = item({ kind: 'ice-cream', watchedOn: null })
    const board = deriveBoard([a], [placement({ itemId: a.id, tier: 'S' })], [], 'u1', 'ice-cream')
    expect(board.tiers.S).toEqual([a])
    expect(board.unwatched).toEqual([])
  })
})

describe('datesArePersonal', () => {
  it('is true only for books', () => {
    expect(datesArePersonal('book')).toBe(true)
    expect(datesArePersonal('movie')).toBe(false)
    expect(datesArePersonal('tv')).toBe(false)
    expect(datesArePersonal('ice-cream')).toBe(false)
  })
})

describe('listIsPersonal', () => {
  it('is true only for books — reading lists are per person', () => {
    expect(listIsPersonal('book')).toBe(true)
    expect(listIsPersonal('movie')).toBe(false)
    expect(listIsPersonal('tv')).toBe(false)
    expect(listIsPersonal('ice-cream')).toBe(false)
  })
})

// --- tags ------------------------------------------------------------------------

describe('normalizeTags', () => {
  it('trims, drops blanks, and dedupes case-insensitively (first spelling wins)', () => {
    expect(normalizeTags([' Disney ', 'disney', '', '  ', 'fantasy'])).toEqual(['Disney', 'fantasy'])
  })
})

describe('distinctTags', () => {
  it('collects one kind’s tags, deduped and sorted', () => {
    const items = [
      item({ kind: 'movie', tags: ['fantasy', 'Disney'] }),
      item({ kind: 'movie', tags: ['disney', 'comfort'] }),
      item({ kind: 'tv', tags: ['sitcom'] }),
    ]
    expect(distinctTags(items, 'movie')).toEqual(['comfort', 'Disney', 'fantasy'])
  })

  it('is empty when nothing is tagged', () => {
    expect(distinctTags([item(), item()], 'movie')).toEqual([])
  })
})

describe('filterByTags', () => {
  const disney = item({ tags: ['Disney'] })
  const fantasy = item({ tags: ['fantasy'] })
  const untagged = item()

  it('an empty selection filters nothing', () => {
    expect(filterByTags([disney, fantasy, untagged], [])).toEqual([disney, fantasy, untagged])
  })

  it('keeps items matching ANY selected tag (case-insensitive)', () => {
    expect(filterByTags([disney, fantasy, untagged], ['disney', 'fantasy'])).toEqual([disney, fantasy])
  })

  it('drops untagged items when a filter is on', () => {
    expect(filterByTags([disney, untagged], ['disney'])).toEqual([disney])
  })
})

// --- findContainer / moveItem --------------------------------------------------

describe('findContainer', () => {
  const a = item()
  const b = item()
  const c = item({ watchedOn: null })
  const board = deriveBoard([a, b, c], [placement({ itemId: a.id, tier: 'C' })], [], 'u1', 'movie')

  it('resolves container ids to themselves', () => {
    expect(findContainer(board, 'C')).toBe('C')
    expect(findContainer(board, 'unranked')).toBe('unranked')
    expect(findContainer(board, 'unwatched')).toBe('unwatched')
  })

  it('resolves a card id to its container', () => {
    expect(findContainer(board, a.id)).toBe('C')
    expect(findContainer(board, b.id)).toBe('unranked')
    expect(findContainer(board, c.id)).toBe('unwatched')
  })

  it('returns undefined for unknown ids', () => {
    expect(findContainer(board, 'nope')).toBeUndefined()
  })
})

describe('moveItem', () => {
  const a = item()
  const b = item()
  const c = item()
  const d = item({ watchedOn: null })
  const board = deriveBoard(
    [a, b, c, d],
    [
      placement({ itemId: a.id, tier: 'S', position: 1 }),
      placement({ itemId: b.id, tier: 'S', position: 2 }),
    ],
    [],
    'u1',
    'movie',
  )

  it('moves between containers at the given index', () => {
    const next = moveItem(board, c.id, 'unranked', 'S', 1)
    expect(next.tiers.S.map((i) => i.id)).toEqual([a.id, c.id, b.id])
    expect(next.unranked).toEqual([])
  })

  it('moves to the end when the index overshoots', () => {
    const next = moveItem(board, c.id, 'unranked', 'S', 99)
    expect(next.tiers.S.map((i) => i.id)).toEqual([a.id, b.id, c.id])
  })

  it('reorders within a container', () => {
    const next = moveItem(board, b.id, 'S', 'S', 0)
    expect(next.tiers.S.map((i) => i.id)).toEqual([b.id, a.id])
  })

  it('moves out of the unwatched shelf into a tier', () => {
    const next = moveItem(board, d.id, 'unwatched', 'S', 0)
    expect(next.tiers.S.map((i) => i.id)).toEqual([d.id, a.id, b.id])
    expect(next.unwatched).toEqual([])
  })

  it('moves onto the unwatched shelf', () => {
    const next = moveItem(board, a.id, 'S', 'unwatched', 0)
    expect(next.tiers.S.map((i) => i.id)).toEqual([b.id])
    expect(next.unwatched.map((i) => i.id)).toEqual([a.id, d.id])
  })

  it('never mutates the input board', () => {
    moveItem(board, a.id, 'S', 'unranked', 0)
    expect(board.tiers.S.map((i) => i.id)).toEqual([a.id, b.id])
    expect(board.unranked.map((i) => i.id)).toEqual([c.id])
    expect(board.unwatched.map((i) => i.id)).toEqual([d.id])
  })
})

// --- positions -------------------------------------------------------------------

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

// --- tierSwatch ------------------------------------------------------------------

describe('tierSwatch', () => {
  it('gives every tier a real palette swatch, all distinct', () => {
    const swatches = TIERS.map((t) => tierSwatch(t))
    for (const s of swatches) expect(palette).toContain(s)
    expect(new Set(swatches.map((s) => s.color)).size).toBe(TIERS.length)
  })
})
