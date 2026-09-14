import { describe, expect, it } from 'vitest'
import type { TierList } from '../../types'
import { KIND_COPY, copyFor, customCopy } from './copy'

const list = (over: Partial<TierList> = {}): TierList => ({
  id: 'l1',
  name: 'Fruits',
  emoji: '🍎',
  noun: 'fruit',
  shared: false,
  createdBy: 'u1',
  createdAt: '2026-06-09T09:00:00Z',
  ...over,
})

describe('KIND_COPY', () => {
  it('keeps the undated shelf and the date field on the built-in kinds', () => {
    expect(KIND_COPY.movie.dates?.shelfLabel).toBe('Unwatched')
    expect(KIND_COPY.movie.dates?.fieldLabel).toBe('Watched on')
    expect(KIND_COPY.book.dates?.shelfLabel).toBe('Unread')
    expect(KIND_COPY.book.dates?.past).toBe('read')
  })
})

describe('customCopy', () => {
  it('templates the wording from the list’s words', () => {
    const copy = customCopy(list())
    expect(copy.pageTitle).toBe('Fruits')
    expect(copy.noun).toBe('fruit')
    expect(copy.boardHint).toContain('New fruits')
  })

  it('follows the custom template: no dates (so no second shelf), no search provider, no example', () => {
    const copy = customCopy(list())
    expect(copy.dates).toBeNull()
    expect(copy.attribution).toBe('')
    // No provider knows this list's titles, so the modal has nothing to
    // suggest as a placeholder.
    expect(copy.example).toBe('')
  })

  it('a shared list has one board, so its hint names one shelf', () => {
    expect(customCopy(list()).boardHint).toContain('both of your unranked shelves')
    const copy = customCopy(list({ shared: true }))
    expect(copy.boardHint).toContain('land on the unranked shelf')
    expect(copy.boardHint).not.toContain('both')
  })

  it('falls back to a generic emoji when the row leaves it blank', () => {
    expect(customCopy(list({ emoji: '' })).emoji).toBe('🏷️')
    expect(customCopy(list({ emoji: '🐛' })).emoji).toBe('🐛')
  })
})

describe('copyFor', () => {
  it('passes built-in keys straight through to KIND_COPY', () => {
    expect(copyFor('movie', [])).toBe(KIND_COPY.movie)
    expect(copyFor('book', [list()])).toBe(KIND_COPY.book)
  })

  it('templates a custom key from its row', () => {
    expect(copyFor('list:l1', [list()]).pageTitle).toBe('Fruits')
  })

  it('yields safe placeholder copy for a list whose row is gone', () => {
    // The partner deleted the list a moment ago and the realtime DELETE landed
    // before the page redirected — this render must not throw.
    const copy = copyFor('list:deleted', [list()])
    expect(copy.pageTitle).toBe('List')
    expect(copy.dates).toBeNull()
    expect(copy.emoji).toBe('🏷️')
  })
})
