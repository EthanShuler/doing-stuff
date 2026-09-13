import { describe, expect, it } from 'vitest'
import type { ListDef } from '../../types'
import { LIST_COPY, copyFor, customListCopy } from './copy'

const def = (over: Partial<ListDef> = {}): ListDef => ({
  id: 'g1',
  name: 'Groceries',
  emoji: '🛒',
  createdBy: 'u1',
  createdAt: '2026-09-01T09:00:00Z',
  ...over,
})

describe('LIST_COPY', () => {
  it('keeps each built-in’s own wording', () => {
    expect(LIST_COPY.movie.past).toBe('watched')
    expect(LIST_COPY.movie.creatorLabel).toBe('Director')
    expect(LIST_COPY.tv.creatorLabel).toBe('Creator')
    expect(LIST_COPY.book.verb).toBe('read')
    expect(LIST_COPY.book.creatorLabel).toBe('Author')
  })

  it('every built-in promotes onto a tier board and carries an image', () => {
    for (const copy of Object.values(LIST_COPY)) {
      expect(copy.linksToBoard).toBe(true)
      expect(copy.hasImage).toBe(true)
      expect(copy.searchKind).not.toBeNull()
    }
  })
})

describe('customListCopy', () => {
  it('takes its label from the row and templates the rest', () => {
    const copy = customListCopy(def())
    expect(copy.label).toBe('Groceries')
    expect(copy.emoji).toBe('🛒')
    expect(copy.noun).toBe('item')
    expect(copy.addPlaceholder).toBe('+ Add to Groceries…')
    expect(copy.verb).toBe('do')
    expect(copy.past).toBe('done')
    expect(copy.creatorLabel).toBe('Note')
  })

  it('has no board, no image, and no search provider', () => {
    const copy = customListCopy(def())
    expect(copy.linksToBoard).toBe(false)
    expect(copy.hasImage).toBe(false)
    expect(copy.searchKind).toBeNull()
    expect(copy.attribution).toBe('')
    expect(copy.example).toBe('')
  })

  it('falls back to a generic emoji when the row leaves it blank', () => {
    expect(customListCopy(def({ emoji: '' })).emoji).toBe('🏷️')
    expect(customListCopy(def({ emoji: '🐛' })).emoji).toBe('🐛')
  })
})

describe('copyFor', () => {
  it('passes built-in refs straight through to LIST_COPY', () => {
    expect(copyFor('movie', [])).toBe(LIST_COPY.movie)
    expect(copyFor('tv', [])).toBe(LIST_COPY.tv)
    expect(copyFor('book', [def()])).toBe(LIST_COPY.book)
  })

  it('templates a free-form ref from its row', () => {
    expect(copyFor('custom:g1', [def()]).label).toBe('Groceries')
  })

  it('yields safe placeholder copy for a list whose row is gone', () => {
    // The partner deleted the list a moment ago and the realtime DELETE landed
    // before the page redirected — this render must not throw.
    const copy = copyFor('custom:deleted', [def()])
    expect(copy.label).toBe('List')
    expect(copy.emoji).toBe('🏷️')
    expect(copy.linksToBoard).toBe(false)
  })
})
