import { describe, expect, it } from 'vitest'
import type { TierItem, TierList, TierPlacement, TierCompletion } from '../../types'
import {
  TIERS,
  boardViewers,
  datesArePersonal,
  deriveBoard,
  distinctTags,
  distinctUserTags,
  filterByUserTags,
  userTagMap,
  filterByTags,
  findContainer,
  hasUndatedShelf,
  tracksReleaseYear,
  cardByline,
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
  EMPTY_PULL_SUMMARY,
  applyTierPullPlan,
  defaultPullKeys,
  isEmptyTierPullPlan,
  planTierPull,
  planTierPulls,
  sumTierPullSummaries,
  tierPullChoices,
  tierPullSource,
  tierPullSummaryLine,
} from './derive'
import type { TierPullData, TierPullSource, TierPullTarget } from './derive'
import type { ListKey, TierUserTags } from '../../types'
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
    releaseYear: null,
    copiedFrom: null,
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
  return { id: 'l1', name: 'Fruits', emoji: '🍎', noun: 'fruit', shared: false, copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-09T09:00:00Z', ...over }
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

  it('games split by each viewer’s own played record, like books', () => {
    const a = item({ kind: 'game', doneOn: '2026-06-01' })
    const comps = [completion({ itemId: a.id, userId: 'u2' })]
    // The shared date is ignored; only u2 has played it.
    expect(deriveBoard([a], [], comps, 'u2', 'game').unranked).toEqual([a])
    expect(deriveBoard([a], [], comps, 'u1', 'game').unwatched).toEqual([a])
  })

  it('movies ignore read records — the shared watched date still rules', () => {
    const a = item({ kind: 'movie', doneOn: null })
    const board = deriveBoard([a], [], [completion({ itemId: a.id, userId: 'u1' })], 'u1', 'movie')
    expect(board.unwatched).toEqual([a])
  })
})

describe('datesArePersonal', () => {
  it('is true only for books and games', () => {
    expect(datesArePersonal('book')).toBe(true)
    expect(datesArePersonal('game')).toBe(true)
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

describe('tracksReleaseYear', () => {
  it('is true for the built-in kinds and false for a custom list', () => {
    for (const key of ['movie', 'tv', 'book', 'game'] as const) expect(tracksReleaseYear(key)).toBe(true)
    expect(tracksReleaseYear('list:l1')).toBe(false)
  })
})

describe('cardByline', () => {
  it('puts the year first so a clamped card keeps it', () => {
    expect(cardByline({ creator: 'Denis Villeneuve', releaseYear: 2021 })).toBe('2021 · Denis Villeneuve')
  })
  it('drops whichever part is missing', () => {
    expect(cardByline({ creator: 'Andy Weir', releaseYear: null })).toBe('Andy Weir')
    expect(cardByline({ creator: '', releaseYear: 1937 })).toBe('1937')
    expect(cardByline({ creator: '', releaseYear: null })).toBe('')
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

describe('personal tags', () => {
  const tags = (itemId: string, userId: string, list: string[]): TierUserTags => ({ id: `${itemId}-${userId}`, itemId, userId, tags: list })
  const a = item({ id: 'ua', kind: 'movie' })
  const b = item({ id: 'ub', kind: 'movie' })
  const c = item({ id: 'uc', kind: 'tv' })
  const rows = [
    tags('ua', 'u1', ['comfort', 'Rewatch']),
    tags('ub', 'u1', ['rewatch']),
    tags('uc', 'u1', ['sitcom']),
    tags('ub', 'u2', ['date night']),
  ]

  it('userTagMap keeps only the given member’s rows', () => {
    expect(userTagMap(rows, 'u2')).toEqual(new Map([['ub', ['date night']]]))
    expect(userTagMap(rows, null).size).toBe(0)
  })

  it('distinctUserTags collects one member’s tags on one kind, deduped and sorted', () => {
    expect(distinctUserTags([a, b, c], rows, 'u1', 'movie')).toEqual(['comfort', 'Rewatch'])
    expect(distinctUserTags([a, b, c], rows, 'u2', 'movie')).toEqual(['date night'])
    expect(distinctUserTags([a, b, c], rows, 'u2', 'tv')).toEqual([])
  })

  it('filterByUserTags matches the member’s own tags, never the partner’s', () => {
    expect(filterByUserTags([a, b], rows, 'u1', ['rewatch'], [])).toEqual([a, b])
    expect(filterByUserTags([a, b], rows, 'u1', [], ['comfort'])).toEqual([b])
    // u2's "date night" is theirs alone.
    expect(filterByUserTags([a, b], rows, 'u1', ['date night'], [])).toEqual([])
    expect(filterByUserTags([a, b], rows, 'u2', ['date night'], [])).toEqual([b])
  })

  it('empty selections filter nothing', () => {
    expect(filterByUserTags([a, b, c], rows, 'u1', [], [])).toEqual([a, b, c])
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

// --- boardViewers -----------------------------------------------------------------

describe('boardViewers', () => {
  const profiles = [
    { id: 'u1', email: 'avery@example.com', displayName: 'Avery' },
    { id: 'u2', email: 'jordan@example.com', displayName: 'Jordan' },
    { id: 'u3', email: 'sam.lee@example.com', displayName: null },
    // A co-member from another of u1's spaces — visible under RLS, not here.
    { id: 'x9', email: 'other@example.com', displayName: 'Outsider' },
  ]

  it('is just you in a one-member space', () => {
    expect(boardViewers(['u1'], profiles, 'u1')).toEqual([{ id: 'u1', label: 'You' }])
  })

  it('puts you first, then the others in join order', () => {
    expect(boardViewers(['u2', 'u1', 'u3'], profiles, 'u1')).toEqual([
      { id: 'u1', label: 'You' },
      { id: 'u2', label: 'Jordan' },
      { id: 'u3', label: 'sam.lee' },
    ])
  })

  it('leaves out profiles from another space', () => {
    const ids = boardViewers(['u1', 'u2'], profiles, 'u1').map((v) => v.id)
    expect(ids).toEqual(['u1', 'u2'])
    expect(ids).not.toContain('x9')
  })

  it('falls back to "Member" for a member with no visible profile', () => {
    expect(boardViewers(['u1', 'u7'], profiles, 'u1')[1]).toEqual({ id: 'u7', label: 'Member' })
  })

  it('is empty without a signed-in self', () => {
    expect(boardViewers(['u1', 'u2'], profiles, null)).toEqual([])
  })
})

// --- Pulling boards from another space -------------------------------------------

describe('planTierPull', () => {
  const NOW = '2026-11-17T12:00:00.000Z'
  const ids = () => {
    let n = 0
    return () => `new${++n}`
  }
  const src = (over: Partial<TierItem>): TierItem => ({
    id: 'sx',
    kind: 'movie',
    title: 'Untitled',
    imageUrl: '',
    doneOn: '2026-05-01',
    tags: [],
    creator: '',
    releaseYear: null,
    copiedFrom: null,
    createdBy: 'u9',
    createdAt: '2026-05-01T00:00:00Z',
    ...over,
  })
  const place = (itemId: string, tier: TierPlacement['tier'], position: number, userId: string | null = 'u1'): TierPlacement => ({
    id: `pl-${itemId}-${userId}`,
    itemId,
    userId,
    tier,
    position,
  })
  const emptyTarget = (over: Partial<TierPullTarget> = {}): TierPullTarget => ({
    lists: [],
    items: [],
    placements: [],
    completions: [],
    userTags: [],
    ...over,
  })
  const source = (over: Partial<TierPullSource>): TierPullSource => ({
    key: 'movie',
    list: null,
    items: [],
    placements: [],
    completions: [],
    userTags: [],
    ...over,
  })

  it('copies ranked items with lineage and no shared date, and ranks them in source order', () => {
    const a = src({ id: 'a', title: 'Arrival', imageUrl: 'https://x/a.jpg', creator: 'Villeneuve', releaseYear: 2016, tags: ['sci-fi'], createdAt: '2026-05-01T00:00:00Z' })
    const b = src({ id: 'b', title: 'Moonlight', copiedFrom: 'root-b', createdAt: '2026-05-02T00:00:00Z' })
    const c = src({ id: 'c', title: 'Cats', createdAt: '2026-05-03T00:00:00Z' })
    const plan = planTierPull(
      source({ items: [c, b, a], placements: [place('a', 'S', 2), place('b', 'S', 1)] }),
      emptyTarget(),
      'u1',
      ids(),
      NOW,
    )
    // Ranked only by default: the unranked Cats stays behind.
    expect(plan.newItems.map((i) => i.title)).toEqual(['Arrival', 'Moonlight'])
    expect(plan.newItems[0]).toMatchObject({
      kind: 'movie',
      imageUrl: 'https://x/a.jpg',
      creator: 'Villeneuve',
      releaseYear: 2016,
      tags: ['sci-fi'],
      doneOn: null,
      copiedFrom: 'a',
      createdBy: 'u1',
      createdAt: NOW,
    })
    // Root origin, not the immediate source.
    expect(plan.newItems[1].copiedFrom).toBe('root-b')
    // createdAt steps by 1 ms so the unranked shelf keeps source order.
    expect(plan.newItems[1].createdAt).toBe('2026-11-17T12:00:00.001Z')
    // S: Moonlight (source position 1) before Arrival (2).
    const byItem = new Map(plan.newItems.map((i) => [i.id, i.title]))
    expect(plan.newPlacements.map((p) => [byItem.get(p.itemId), p.tier, p.position, p.userId])).toEqual([
      ['Moonlight', 'S', 1, 'u1'],
      ['Arrival', 'S', 2, 'u1'],
    ])
    expect(plan.summary).toMatchObject({ itemsAdded: 2, itemsMatched: 0, rankingsAdded: 2, rankingsKept: 0 })
  })

  it('brings unranked items as items only with includeUnranked', () => {
    const a = src({ id: 'a', title: 'Arrival' })
    const c = src({ id: 'c', title: 'Cats', createdAt: '2026-05-03T00:00:00Z' })
    const plan = planTierPull(source({ items: [a, c], placements: [place('a', 'A', 1)] }), emptyTarget(), 'u1', ids(), NOW, {
      includeUnranked: true,
    })
    expect(plan.newItems.map((i) => i.title)).toEqual(['Arrival', 'Cats'])
    expect(plan.newPlacements).toHaveLength(1)
  })

  it('matches by lineage before title', () => {
    // Here: "Dune" made here (t1), and "Dune" with no relation (t2).
    const t1 = item({ id: 't1', title: 'Dune', createdAt: '2026-01-01T00:00:00Z' })
    const t2 = item({ id: 't2', title: 'Dune', createdAt: '2026-01-02T00:00:00Z' })
    // There: an unrelated "Dune" (older) and a copy of t1 (newer, renamed).
    const unrelated = src({ id: 's1', title: 'Dune', createdAt: '2026-05-01T00:00:00Z' })
    const copyOfT1 = src({ id: 's2', title: 'Dune (1984)', copiedFrom: 't1', createdAt: '2026-05-02T00:00:00Z' })
    const plan = planTierPull(
      source({ items: [unrelated, copyOfT1], placements: [place('s1', 'A', 1), place('s2', 'B', 1)] }),
      emptyTarget({ items: [t1, t2] }),
      'u1',
      ids(),
      NOW,
    )
    // The copy claims t1 by lineage even though the older source item would
    // have taken it by title; the unrelated Dune falls through to t2.
    expect(plan.newItems).toEqual([])
    expect(plan.newPlacements.map((p) => [p.itemId, p.tier])).toEqual([
      ['t2', 'A'],
      ['t1', 'B'],
    ])
    expect(plan.summary.itemsMatched).toBe(2)
  })

  it('is injective: two same-title source items claim one target item, the other is copied', () => {
    const here = item({ id: 'h1', title: 'Hamlet', kind: 'movie' })
    const older = src({ id: 's1', title: 'hamlet ', createdAt: '2026-05-01T00:00:00Z' })
    const newer = src({ id: 's2', title: 'HAMLET', createdAt: '2026-05-02T00:00:00Z' })
    const plan = planTierPull(
      source({ items: [newer, older], placements: [place('s1', 'S', 1), place('s2', 'C', 1)] }),
      emptyTarget({ items: [here] }),
      'u1',
      ids(),
      NOW,
    )
    // The OLDER source item (createdAt order) claims h1; the newer is copied.
    expect(plan.newItems).toHaveLength(1)
    expect(plan.newItems[0].copiedFrom).toBe('s2')
    expect(plan.newPlacements.find((p) => p.itemId === 'h1')?.tier).toBe('S')
    expect(plan.summary).toMatchObject({ itemsAdded: 1, itemsMatched: 1 })
  })

  it('only title-matches within the same board', () => {
    const show = item({ id: 'h1', title: 'Fargo', kind: 'tv' })
    const plan = planTierPull(
      source({ items: [src({ id: 's1', title: 'Fargo' })], placements: [place('s1', 'A', 1)] }),
      emptyTarget({ items: [show] }),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.newItems).toHaveLength(1)
    expect(plan.newItems[0].kind).toBe('movie')
  })

  it('creates a custom list when none matches, and copied items carry the TARGET list id', () => {
    const snacks = list({ id: 'src-l', name: 'Snacks', emoji: '🍿', noun: 'snack', shared: false })
    const s = src({ id: 's1', title: 'Pretzels', kind: 'list:src-l' })
    const plan = planTierPull(
      source({ key: 'list:src-l', list: snacks, items: [s], placements: [place('s1', 'A', 1)] }),
      emptyTarget({ lists: [list({ id: 'l9', name: 'Fruits' })] }),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.newList).toMatchObject({ name: 'Snacks', emoji: '🍿', noun: 'snack', shared: false, copiedFrom: 'src-l' })
    expect(plan.targetKey).toBe(`list:${plan.newList!.id}`)
    expect(plan.newItems[0].kind).toBe(`list:${plan.newList!.id}`)
    expect(plan.summary.listsAdded).toBe(1)
  })

  it('matches a custom list by lineage, else by name in any case', () => {
    const there = list({ id: 'src-l', name: 'Snacks', copiedFrom: null })
    const s = src({ id: 's1', title: 'Pretzels', kind: 'list:src-l' })
    const pulled = (lists: TierList[]) =>
      planTierPull(source({ key: 'list:src-l', list: there, items: [s], placements: [place('s1', 'A', 1)] }), emptyTarget({ lists }), 'u1', ids(), NOW)
    // Lineage wins over a same-named list.
    const byLineage = pulled([
      list({ id: 'named', name: 'snacks', createdAt: '2026-01-01T00:00:00Z' }),
      list({ id: 'copy', name: 'Nibbles', copiedFrom: 'src-l', createdAt: '2026-02-01T00:00:00Z' }),
    ])
    expect(byLineage.newList).toBeNull()
    expect(byLineage.targetKey).toBe('list:copy')
    const byName = pulled([list({ id: 'named', name: '  SNACKS ' })])
    expect(byName.targetKey).toBe('list:named')
    expect(byName.newItems[0].kind).toBe('list:named')
  })

  it('does not create an empty list when nothing on it would come over', () => {
    const there = list({ id: 'src-l', name: 'Snacks' })
    const plan = planTierPull(
      source({ key: 'list:src-l', list: there, items: [src({ id: 's1', kind: 'list:src-l' })] }),
      emptyTarget(),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.newList).toBeNull()
    expect(isEmptyTierPullPlan(plan)).toBe(true)
  })

  it('writes null-owner rankings onto a shared list here', () => {
    const there = list({ id: 'src-l', name: 'Board games', shared: true })
    const here = list({ id: 'l2', name: 'Board games', shared: true })
    const s = src({ id: 's1', title: 'Azul', kind: 'list:src-l' })
    const plan = planTierPull(
      source({ key: 'list:src-l', list: there, items: [s], placements: [place('s1', 'A', 1, null)] }),
      emptyTarget({ lists: [here] }),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.newPlacements).toEqual([expect.objectContaining({ userId: null, tier: 'A' })])
  })

  it('owner follows the TARGET list mode: a shared source onto a per-person list ranks as the puller', () => {
    const there = list({ id: 'src-l', name: 'Board games', shared: true })
    const here = list({ id: 'l2', name: 'Board games', shared: false })
    const s = src({ id: 's1', title: 'Azul', kind: 'list:src-l' })
    const plan = planTierPull(
      source({ key: 'list:src-l', list: there, items: [s], placements: [place('s1', 'A', 1, null)] }),
      emptyTarget({ lists: [here] }),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.newPlacements[0].userId).toBe('u1')
  })

  it('leaves items already ranked here alone and appends after the last card of each tier', () => {
    const here1 = item({ id: 'h1', title: 'Heat' })
    const here2 = item({ id: 'h2', title: 'Ronin' })
    const otherBoard = item({ id: 'h3', title: 'Severance', kind: 'tv' })
    const target = emptyTarget({
      items: [here1, here2, otherBoard],
      placements: [
        place('h1', 'S', 4),
        place('h2', 'A', 1.5),
        // The partner's card and another board's card don't count.
        place('h2', 'S', 99, 'u2'),
        place('h3', 'S', 50),
      ],
    })
    const plan = planTierPull(
      source({
        items: [
          src({ id: 's1', title: 'Heat', createdAt: '2026-05-01T00:00:00Z' }),
          src({ id: 's2', title: 'Arrival', createdAt: '2026-05-02T00:00:00Z' }),
          src({ id: 's3', title: 'Moonlight', createdAt: '2026-05-03T00:00:00Z' }),
          src({ id: 's4', title: 'Up', createdAt: '2026-05-04T00:00:00Z' }),
        ],
        placements: [place('s1', 'F', 1), place('s2', 'S', 2), place('s3', 'S', 1), place('s4', 'A', 1)],
      }),
      target,
      'u1',
      ids(),
      NOW,
    )
    const title = new Map(plan.newItems.map((i) => [i.id, i.title]))
    // Heat is already ranked S here — not moved to F.
    expect(plan.newPlacements.some((p) => p.itemId === 'h1')).toBe(false)
    expect(plan.newPlacements.map((p) => [title.get(p.itemId), p.tier, p.position])).toEqual([
      ['Moonlight', 'S', 5],
      ['Arrival', 'S', 6],
      ['Up', 'A', 2.5],
    ])
    expect(plan.summary).toMatchObject({ rankingsAdded: 3, rankingsKept: 1, itemsMatched: 1, itemsAdded: 3 })
  })

  it('ranks a matched item that is unranked here', () => {
    const here = item({ id: 'h1', title: 'Heat' })
    const plan = planTierPull(
      source({ items: [src({ id: 's1', title: 'Heat' })], placements: [place('s1', 'B', 1)] }),
      emptyTarget({ items: [here] }),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.newItems).toEqual([])
    expect(plan.newPlacements).toEqual([expect.objectContaining({ itemId: 'h1', tier: 'B', position: 1 })])
  })

  it('books: copies only the puller’s own read date, and only where they have none here', () => {
    const book = (over: Partial<TierItem>) => src({ kind: 'book', doneOn: null, ...over })
    const here = item({ id: 'h1', title: 'Circe', kind: 'book', doneOn: null })
    const plan = planTierPull(
      source({
        key: 'book',
        items: [book({ id: 's1', title: 'Circe' }), book({ id: 's2', title: 'Piranesi', doneOn: '2026-01-01' })],
        placements: [place('s1', 'A', 1), place('s2', 'S', 1)],
        completions: [
          { id: 'c1', itemId: 's1', userId: 'u1', doneOn: '2026-03-01' },
          { id: 'c2', itemId: 's2', userId: 'u1', doneOn: '2026-04-01' },
          // Someone else's read date never comes over.
          { id: 'c3', itemId: 's2', userId: 'u2', doneOn: '2026-04-02' },
        ],
      }),
      emptyTarget({ items: [here], completions: [{ id: 'hc', itemId: 'h1', userId: 'u1', doneOn: '2025-12-01' }] }),
      'u1',
      ids(),
      NOW,
    )
    const piranesi = plan.newItems.find((i) => i.title === 'Piranesi')!
    // The shared date is never carried.
    expect(piranesi.doneOn).toBeNull()
    expect(plan.newCompletions).toEqual([expect.objectContaining({ itemId: piranesi.id, userId: 'u1', doneOn: '2026-04-01' })])
    expect(plan.summary.datesAdded).toBe(1)
  })

  it('never copies completions onto a movie board', () => {
    const plan = planTierPull(
      source({
        items: [src({ id: 's1' })],
        placements: [place('s1', 'A', 1)],
        completions: [{ id: 'c1', itemId: 's1', userId: 'u1', doneOn: '2026-03-01' }],
      }),
      emptyTarget(),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.newCompletions).toEqual([])
  })

  it('unions personal tags with the puller’s tags here and never edits the existing item', () => {
    const here = item({ id: 'h1', title: 'Heat', tags: ['crime'], doneOn: '2026-02-02' })
    const plan = planTierPull(
      source({
        items: [src({ id: 's1', title: 'Heat', tags: ['thriller'], doneOn: '2026-05-05' })],
        placements: [place('s1', 'A', 1)],
        userTags: [{ id: 'st', itemId: 's1', userId: 'u1', tags: ['Rewatch', 'cozy'] }],
      }),
      emptyTarget({ items: [here], userTags: [{ id: 'ht', itemId: 'h1', userId: 'u1', tags: ['rewatch'] }] }),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.userTagUpserts).toEqual([{ id: 'ht', itemId: 'h1', userId: 'u1', tags: ['rewatch', 'cozy'] }])
    expect(plan.summary.tagsMerged).toBe(1)
    // Nothing in the plan touches the existing item's title/shared tags/date.
    expect(plan.newItems).toEqual([])
  })

  it('pulling twice: the second plan is empty', () => {
    const data: TierPullData = {
      lists: [list({ id: 'src-l', name: 'Snacks' })],
      items: [
        src({ id: 's1', title: 'Spirited Away', createdAt: '2026-05-01T00:00:00Z' }),
        src({ id: 's2', title: 'Arrival', createdAt: '2026-05-02T00:00:00Z' }),
        src({ id: 's3', title: 'Circe', kind: 'book', doneOn: null }),
        src({ id: 's4', title: 'Pretzels', kind: 'list:src-l' }),
        src({ id: 's5', title: 'Licorice', kind: 'list:src-l', createdAt: '2026-05-09T00:00:00Z' }),
      ],
      placements: [place('s1', 'S', 1), place('s2', 'A', 1), place('s3', 'B', 1), place('s4', 'C', 1)],
      completions: [{ id: 'c1', itemId: 's3', userId: 'u1', doneOn: '2026-03-01' }],
      userTags: [{ id: 't1', itemId: 's2', userId: 'u1', tags: ['cozy'] }],
    }
    const target = emptyTarget({ items: [item({ id: 'h1', title: 'Spirited Away' })] })
    const keys: ListKey[] = ['movie', 'book', 'list:src-l']
    const first = planTierPulls(data, keys, target, 'u1', ids(), NOW, { includeUnranked: true })
    expect(sumTierPullSummaries(first)).toMatchObject({ listsAdded: 1, itemsAdded: 4, itemsMatched: 1, rankingsAdded: 4, datesAdded: 1, tagsMerged: 1 })
    const after = first.reduce(applyTierPullPlan, target)
    const second = planTierPulls(data, keys, after, 'u1', ids(), NOW, { includeUnranked: true })
    expect(second.every(isEmptyTierPullPlan)).toBe(true)
    expect(sumTierPullSummaries(second)).toMatchObject({ itemsMatched: 5, rankingsKept: 4, itemsAdded: 0, rankingsAdded: 0 })
    expect(tierPullSummaryLine(sumTierPullSummaries(second))).toBe('')
  })

  it('a chain back to the origin space matches with one rule', () => {
    // A → B → A: the item made here (h1) went out and came back as a copy.
    const here = item({ id: 'h1', title: 'Heat' })
    const plan = planTierPull(
      source({ items: [src({ id: 'b1', title: 'Heat (1995)', copiedFrom: 'h1' })], placements: [place('b1', 'A', 1)] }),
      emptyTarget({ items: [here] }),
      'u1',
      ids(),
      NOW,
    )
    expect(plan.newItems).toEqual([])
    expect(plan.newPlacements[0].itemId).toBe('h1')
  })
})

describe('tierPullSource / tierPullChoices / defaultPullKeys', () => {
  const data: TierPullData = {
    lists: [
      list({ id: 'sl1', name: 'Snacks', createdAt: '2026-01-02T00:00:00Z' }),
      list({ id: 'sl2', name: 'Board games', shared: true, createdAt: '2026-01-01T00:00:00Z' }),
    ],
    items: [
      item({ id: 'a', kind: 'movie' }),
      item({ id: 'b', kind: 'movie' }),
      item({ id: 'g', kind: 'list:sl2' }),
      item({ id: 's', kind: 'list:sl1' }),
    ],
    placements: [
      placement({ itemId: 'a', userId: 'u1' }),
      // A stray null-owner row on a built-in is ignored; the shared list's counts.
      placement({ itemId: 'b', userId: null }),
      placement({ itemId: 'g', userId: null }),
      placement({ itemId: 'g', userId: 'u1' }),
    ],
    completions: [],
    userTags: [],
  }

  it('picks placements by the source list mode', () => {
    expect(tierPullSource(data, 'movie', 'u1').placements.map((p) => p.itemId)).toEqual(['a'])
    const games = tierPullSource(data, 'list:sl2', 'u1')
    expect(games.list?.name).toBe('Board games')
    expect(games.placements.map((p) => p.userId)).toEqual([null])
  })

  it('lists the built-ins then the lists oldest first, with counts', () => {
    expect(tierPullChoices(data, 'u1').map((c) => [c.key, c.total, c.ranked])).toEqual([
      ['movie', 2, 1],
      ['tv', 0, 0],
      ['book', 0, 0],
      ['game', 0, 0],
      ['list:sl2', 1, 1],
      ['list:sl1', 1, 0],
    ])
  })

  it('pre-ticks the board on screen, or the source list matching it', () => {
    expect(defaultPullKeys(data, 'tv', [])).toEqual(['tv'])
    expect(defaultPullKeys(data, 'list:x', [list({ id: 'x', name: 'SNACKS' })])).toEqual(['list:sl1'])
    expect(defaultPullKeys(data, 'list:x', [list({ id: 'x', name: 'Nibbles', copiedFrom: 'sl2' })])).toEqual(['list:sl2'])
    expect(defaultPullKeys(data, 'list:x', [list({ id: 'x', name: 'Bugs' })])).toEqual([])
  })
})

describe('tierPullSummaryLine', () => {
  it('lists only the non-zero parts', () => {
    expect(
      tierPullSummaryLine({ listsAdded: 0, itemsAdded: 30, itemsMatched: 12, rankingsAdded: 42, rankingsKept: 5, tagsMerged: 0, datesAdded: 0 }),
    ).toBe("42 rankings · 30 new items · 12 already here · 5 you've ranked here left alone")
    expect(
      tierPullSummaryLine({ listsAdded: 1, itemsAdded: 1, itemsMatched: 0, rankingsAdded: 1, rankingsKept: 0, tagsMerged: 1, datesAdded: 1 }),
    ).toBe('1 new list · 1 ranking · 1 new item · 1 read date · your tags on 1 item')
  })

  it('is empty when nothing would be written', () => {
    expect(tierPullSummaryLine({ ...EMPTY_PULL_SUMMARY, itemsMatched: 3, rankingsKept: 3 })).toBe('')
  })
})
