import { describe, expect, it } from 'vitest'
import type { TierItem, TierPlacement } from '../../types'
import {
  TIERS,
  deriveBoard,
  findContainer,
  moveItem,
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
    watchedOn: null,
    createdBy: 'u1',
    createdAt: `2026-07-0${(seq % 9) + 1}T00:00:00Z`,
    ...over,
  }
}

function placement(over: Partial<TierPlacement> = {}): TierPlacement {
  seq += 1
  return { id: `p${seq}`, itemId: 'i1', userId: 'u1', tier: 'A', position: 1, ...over }
}

// --- deriveBoard ---------------------------------------------------------------

describe('deriveBoard', () => {
  it('filters items by kind', () => {
    const movie = item({ kind: 'movie' })
    const show = item({ kind: 'tv' })
    const board = deriveBoard([movie, show], [], 'u1', 'movie')
    expect(board.unranked).toEqual([movie])
  })

  it('only applies the viewer own placements', () => {
    const a = item()
    const mine = placement({ itemId: a.id, userId: 'u1', tier: 'S' })
    const theirs = placement({ itemId: a.id, userId: 'u2', tier: 'F' })
    const board = deriveBoard([a], [mine, theirs], 'u1', 'movie')
    expect(board.tiers.S).toEqual([a])
    expect(board.tiers.F).toEqual([])
  })

  it('an item placed only by the partner stays unranked for me', () => {
    const a = item()
    const theirs = placement({ itemId: a.id, userId: 'u2', tier: 'S' })
    const board = deriveBoard([a], [theirs], 'u1', 'movie')
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
      'u1',
      'movie',
    )
    expect(board.tiers.B.map((i) => i.id)).toEqual([first.id, third.id, second.id])
  })

  it('sorts the unranked shelf by createdAt (oldest first)', () => {
    const newer = item({ createdAt: '2026-06-02T00:00:00Z' })
    const older = item({ createdAt: '2026-06-01T00:00:00Z' })
    const board = deriveBoard([newer, older], [], 'u1', 'movie')
    expect(board.unranked.map((i) => i.id)).toEqual([older.id, newer.id])
  })

  it('ignores placements whose item is gone', () => {
    const board = deriveBoard([], [placement({ itemId: 'ghost', tier: 'S' })], 'u1', 'movie')
    expect(board.tiers.S).toEqual([])
  })

  it('handles a null viewer (everything unranked)', () => {
    const a = item()
    const board = deriveBoard([a], [placement({ itemId: a.id })], null, 'movie')
    expect(board.unranked).toEqual([a])
  })
})

// --- findContainer / moveItem --------------------------------------------------

describe('findContainer', () => {
  const a = item()
  const b = item()
  const board = deriveBoard([a, b], [placement({ itemId: a.id, tier: 'C' })], 'u1', 'movie')

  it('resolves container ids to themselves', () => {
    expect(findContainer(board, 'C')).toBe('C')
    expect(findContainer(board, 'unranked')).toBe('unranked')
  })

  it('resolves a card id to its container', () => {
    expect(findContainer(board, a.id)).toBe('C')
    expect(findContainer(board, b.id)).toBe('unranked')
  })

  it('returns undefined for unknown ids', () => {
    expect(findContainer(board, 'nope')).toBeUndefined()
  })
})

describe('moveItem', () => {
  const a = item()
  const b = item()
  const c = item()
  const board = deriveBoard(
    [a, b, c],
    [
      placement({ itemId: a.id, tier: 'S', position: 1 }),
      placement({ itemId: b.id, tier: 'S', position: 2 }),
    ],
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

  it('never mutates the input board', () => {
    moveItem(board, a.id, 'S', 'unranked', 0)
    expect(board.tiers.S.map((i) => i.id)).toEqual([a.id, b.id])
    expect(board.unranked.map((i) => i.id)).toEqual([c.id])
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
