import { describe, expect, it } from 'vitest'
import type { TierItem, TierList, TierPlacement, TierCompletion } from '../../types'
import {
  TIERS,
  datesArePersonal,
  deriveBoard,
  distinctTags,
  filterByTags,
  findContainer,
  hasUndatedShelf,
  isSharedBoard,
  keyOf,
  kindColumn,
  listIdOf,
  listKeyFor,
  moveItem,
  normalizeTags,
  placementOwner,
  pruneList,
  itemIdsOnList,
  dropItemRows,
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
    // Done by default — a null doneOn diverts unplaced items to the
    // unwatched shelf, which the shelf-split tests exercise explicitly.
    doneOn: '2026-06-15',
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

function completion(over: Partial<TierCompletion> = {}): TierCompletion {
  seq += 1
  return { id: `r${seq}`, itemId: 'i1', userId: 'u1', doneOn: '2026-06-20', ...over }
}

function list(over: Partial<TierList> = {}): TierList {
  return { id: 'l1', name: 'Fruits', emoji: '🍎', noun: 'fruit', shared: false, createdBy: 'u1', createdAt: '2026-06-09T09:00:00Z', ...over }
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
    const watched = item({ doneOn: '2026-06-01' })
    const undated = item({ doneOn: null })
    const board = deriveBoard([watched, undated], [], [], 'u1', 'movie')
    expect(board.unranked).toEqual([watched])
    expect(board.unwatched).toEqual([undated])
  })

  it('a placement wins over a missing watched date', () => {
    const a = item({ doneOn: null })
    const board = deriveBoard([a], [placement({ itemId: a.id, tier: 'B' })], [], 'u1', 'movie')
    expect(board.tiers.B).toEqual([a])
    expect(board.unwatched).toEqual([])
  })

  it('sorts the unwatched shelf by createdAt (oldest first)', () => {
    const newer = item({ doneOn: null, createdAt: '2026-06-02T00:00:00Z' })
    const older = item({ doneOn: null, createdAt: '2026-06-01T00:00:00Z' })
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

  it('a null viewer does not pick up shared (null-owner) placements', () => {
    const a = item()
    const board = deriveBoard([a], [placement({ itemId: a.id, userId: null })], [], null, 'movie')
    expect(board.unranked).toEqual([a])
    expect(board.tiers.A).toEqual([])
  })
})

// --- deriveBoard: books (per-person read state) ---------------------------------

describe('deriveBoard for books', () => {
  it('a book with no read record for the viewer sits on the unread shelf', () => {
    const a = item({ kind: 'book', doneOn: null })
    const board = deriveBoard([a], [], [], 'u1', 'book')
    expect(board.unwatched).toEqual([a])
    expect(board.unranked).toEqual([])
  })

  it("the partner's read record does not mark it read for me", () => {
    const a = item({ kind: 'book', doneOn: null })
    const board = deriveBoard([a], [], [completion({ itemId: a.id, userId: 'u2' })], 'u1', 'book')
    expect(board.unwatched).toEqual([a])
    expect(board.unranked).toEqual([])
  })

  it('my own read record moves it to my unranked shelf', () => {
    const a = item({ kind: 'book', doneOn: null })
    const board = deriveBoard([a], [], [completion({ itemId: a.id, userId: 'u1' })], 'u1', 'book')
    expect(board.unranked).toEqual([a])
    expect(board.unwatched).toEqual([])
  })

  it('each viewer splits the same pool by their own completions', () => {
    const a = item({ kind: 'book', doneOn: null })
    const comps = [completion({ itemId: a.id, userId: 'u2' })]
    expect(deriveBoard([a], [], comps, 'u2', 'book').unranked).toEqual([a])
    expect(deriveBoard([a], [], comps, 'u1', 'book').unwatched).toEqual([a])
  })

  it('ignores the shared watched date for books', () => {
    const a = item({ kind: 'book', doneOn: '2026-06-01' })
    const board = deriveBoard([a], [], [], 'u1', 'book')
    expect(board.unwatched).toEqual([a])
  })

  it('a placement wins over a missing read record', () => {
    const a = item({ kind: 'book', doneOn: null })
    const board = deriveBoard([a], [placement({ itemId: a.id, tier: 'B' })], [], 'u1', 'book')
    expect(board.tiers.B).toEqual([a])
    expect(board.unwatched).toEqual([])
  })

  it('movies ignore read records — the shared watched date still rules', () => {
    const a = item({ kind: 'movie', doneOn: null })
    const board = deriveBoard([a], [], [completion({ itemId: a.id, userId: 'u1' })], 'u1', 'movie')
    expect(board.unwatched).toEqual([a])
  })
})

describe('datesArePersonal', () => {
  it('is true only for books', () => {
    expect(datesArePersonal('book')).toBe(true)
    expect(datesArePersonal('movie')).toBe(false)
    expect(datesArePersonal('tv')).toBe(false)
  })

  it('is false for a custom list — ice cream and friends share one done marker', () => {
    expect(datesArePersonal('list:l1')).toBe(false)
  })
})

// --- list keys ---------------------------------------------------------------

describe('list key helpers', () => {
  it('round-trips a list id through its key', () => {
    const key = listKeyFor('abc-123')
    expect(key).toBe('list:abc-123')
    expect(listIdOf(key)).toBe('abc-123')
  })

  it('reports no list id for a built-in kind', () => {
    expect(listIdOf('movie')).toBeNull()
  })

  it('maps a key onto the row’s kind column', () => {
    expect(kindColumn('movie')).toBe('movie')
    expect(kindColumn('list:l1')).toBe('custom')
  })

  it('rebuilds a key from the row’s two columns', () => {
    expect(keyOf('movie', null)).toBe('movie')
    expect(keyOf('custom', 'l1')).toBe('list:l1')
  })

  it('kindColumn + listIdOf round-trip through keyOf', () => {
    for (const key of ['movie', 'tv', 'book', 'list:l1'] as const) {
      expect(keyOf(kindColumn(key), listIdOf(key))).toBe(key)
    }
  })
})

// --- deriveBoard: a custom list (no dates at all, keyed by list id) ------------

describe('deriveBoard for a custom list', () => {
  it('filters by the list key, ignoring other boards', () => {
    const mine = item({ kind: 'list:l1', doneOn: '2026-06-09' })
    const theirs = item({ kind: 'list:l2', doneOn: '2026-06-09' })
    const movie = item({ kind: 'movie', doneOn: '2026-06-09' })
    const board = deriveBoard([mine, theirs, movie], [], [], 'u1', 'list:l1')
    expect(board.unranked).toEqual([mine])
  })

  it('has no second shelf: every unplaced item is unranked, dated or not', () => {
    const done = item({ kind: 'list:l1', doneOn: '2026-06-09' })
    const notYet = item({ kind: 'list:l1', doneOn: null })
    const board = deriveBoard(
      [done, notYet],
      [],
      [completion({ itemId: notYet.id, userId: 'u1' })],
      'u1',
      'list:l1',
    )
    expect(board.unranked.map((i) => i.id).sort()).toEqual([done.id, notYet.id].sort())
    expect(board.unwatched).toEqual([])
  })

  it('still ranks a placed item, dateless or not', () => {
    const a = item({ kind: 'list:l1', doneOn: null })
    const board = deriveBoard([a], [placement({ itemId: a.id, tier: 'A' })], [], 'u1', 'list:l1')
    expect(board.tiers.A).toEqual([a])
    expect(board.unranked).toEqual([])
    expect(board.unwatched).toEqual([])
  })
})

// --- shared boards -----------------------------------------------------------------

describe('hasUndatedShelf', () => {
  it('is true for the built-in kinds and false for a custom list', () => {
    for (const key of ['movie', 'tv', 'book'] as const) expect(hasUndatedShelf(key)).toBe(true)
    expect(hasUndatedShelf('list:l1')).toBe(false)
  })
})

describe('isSharedBoard', () => {
  it('is false for every built-in board', () => {
    const lists = [list({ shared: true })]
    for (const key of ['movie', 'tv', 'book'] as const) {
      expect(isSharedBoard(key, lists)).toBe(false)
    }
  })

  it('reads the list row’s flag', () => {
    expect(isSharedBoard('list:l1', [list({ shared: true })])).toBe(true)
    expect(isSharedBoard('list:l1', [list({ shared: false })])).toBe(false)
  })

  it('is false for a list whose row is gone', () => {
    expect(isSharedBoard('list:deleted', [list({ shared: true })])).toBe(false)
  })
})

describe('placementOwner', () => {
  it('is the viewer on a personal board and null on a shared one', () => {
    expect(placementOwner(false, 'u1')).toBe('u1')
    expect(placementOwner(true, 'u1')).toBeNull()
    expect(placementOwner(false, null)).toBeNull()
  })
})

describe('deriveBoard for a shared list', () => {
  it('reads the null-owner placements, whoever is looking', () => {
    const a = item({ kind: 'list:l2', doneOn: '2026-06-09' })
    const b = item({ kind: 'list:l2', doneOn: '2026-06-09' })
    const placements = [placement({ itemId: a.id, userId: null, tier: 'S' })]
    for (const viewer of ['u1', 'u2', null]) {
      const board = deriveBoard([a, b], placements, [], viewer, 'list:l2', true)
      expect(board.tiers.S).toEqual([a])
      expect(board.unranked).toEqual([b])
    }
  })

  it('ignores every member’s personal placements', () => {
    const a = item({ kind: 'list:l2', doneOn: '2026-06-09' })
    const board = deriveBoard(
      [a],
      [placement({ itemId: a.id, userId: 'u1', tier: 'S' }), placement({ itemId: a.id, userId: 'u2', tier: 'A' })],
      [],
      'u1',
      'list:l2',
      true,
    )
    expect(board.tiers.S).toEqual([])
    expect(board.tiers.A).toEqual([])
    expect(board.unranked).toEqual([a])
  })

  it('a personal board ignores the shared placements', () => {
    const a = item({ kind: 'list:l1', doneOn: '2026-06-09' })
    const board = deriveBoard([a], [placement({ itemId: a.id, userId: null, tier: 'S' })], [], 'u1', 'list:l1')
    expect(board.unranked).toEqual([a])
  })

  it('has no second shelf either — unplaced is simply unranked', () => {
    const notYet = item({ kind: 'list:l2', doneOn: null })
    const board = deriveBoard([notYet], [], [], 'u1', 'list:l2', true)
    expect(board.unranked).toEqual([notYet])
    expect(board.unwatched).toEqual([])
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
  const disneyFantasy = item({ tags: ['Disney', 'fantasy'] })
  const untagged = item()

  it('empty selections filter nothing', () => {
    expect(filterByTags([disney, fantasy, untagged], [], [])).toEqual([disney, fantasy, untagged])
  })

  it('keeps items matching ANY included tag (case-insensitive)', () => {
    expect(filterByTags([disney, fantasy, untagged], ['disney', 'fantasy'], [])).toEqual([disney, fantasy])
  })

  it('drops untagged items when an include filter is on', () => {
    expect(filterByTags([disney, untagged], ['disney'], [])).toEqual([disney])
  })

  it('an exclude drops its items but keeps untagged ones (case-insensitive)', () => {
    expect(filterByTags([disney, fantasy, untagged], [], ['disney'])).toEqual([fantasy, untagged])
  })

  it('exclude wins over include when an item carries both', () => {
    expect(filterByTags([disney, fantasy, disneyFantasy], ['fantasy'], ['disney'])).toEqual([fantasy])
  })
})

// --- findContainer / moveItem --------------------------------------------------

describe('findContainer', () => {
  const a = item()
  const b = item()
  const c = item({ doneOn: null })
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
  const d = item({ doneOn: null })
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

// --- deleting a list ----------------------------------------------------------

describe('pruneList', () => {
  it('removes the list’s items and their placements and completions', () => {
    const mine = item({ kind: 'list:l1' })
    const alsoMine = item({ kind: 'list:l1' })
    const other = item({ kind: 'movie' })
    const state = {
      items: [mine, alsoMine, other],
      placements: [
        placement({ itemId: mine.id, userId: 'u1' }),
        placement({ itemId: mine.id, userId: 'u2' }),
        placement({ itemId: other.id, userId: 'u1' }),
      ],
      completions: [completion({ itemId: alsoMine.id }), completion({ itemId: other.id })],
    }
    const next = pruneList(state, 'l1')
    expect(next.items).toEqual([other])
    expect(next.placements.map((p) => p.itemId)).toEqual([other.id])
    expect(next.completions.map((c) => c.itemId)).toEqual([other.id])
  })

  it('leaves another list alone', () => {
    const keep = item({ kind: 'list:l2' })
    const next = pruneList({ items: [keep], placements: [], completions: [] }, 'l1')
    expect(next.items).toEqual([keep])
  })

  it('never mutates the input', () => {
    const state = { items: [item({ kind: 'list:l1' })], placements: [], completions: [] }
    const before = state.items.length
    pruneList(state, 'l1')
    expect(state.items.length).toBe(before)
  })
})

describe('itemIdsOnList / dropItemRows', () => {
  it('collects only the list’s item ids', () => {
    const a = item({ kind: 'list:l1' })
    const b = item({ kind: 'list:l2' })
    const c = item({ kind: 'movie' })
    expect([...itemIdsOnList([a, b, c], 'l1')]).toEqual([a.id])
  })

  it('drops rows for the given ids and keeps the rest', () => {
    const rows = [placement({ itemId: 'x' }), placement({ itemId: 'y' }), completion({ itemId: 'x' })]
    expect(dropItemRows(rows, new Set(['x'])).map((r) => r.itemId)).toEqual(['y'])
    expect(dropItemRows(rows, new Set())).toEqual(rows)
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
