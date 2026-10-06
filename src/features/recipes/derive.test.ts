import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../types'
import {
  distinctRecipeTags,
  filterRecipes,
  ingredientLines,
  remapMarks,
  servingsTimeLine,
  sortRecipes,
  sourceHref,
  stepBlocks,
  withMark,
} from './derive'

const recipe = (overrides: Partial<Recipe>): Recipe => ({
  id: 'r1',
  title: 'Recipe',
  imageUrl: '',
  ingredients: '',
  steps: '',
  source: '',
  sourceUrl: '',
  tags: [],
  servings: '',
  totalTime: '',
  notes: '',
  crossedIngredients: [],
  doneSteps: [],
  createdBy: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('ingredientLines', () => {
  it('splits one ingredient per line, trimming and dropping blanks', () => {
    expect(ingredientLines('2 cups flour\n  1 tsp salt  \n\n3 eggs\n')).toEqual([
      '2 cups flour',
      '1 tsp salt',
      '3 eggs',
    ])
  })

  it('returns [] for empty text', () => {
    expect(ingredientLines('')).toEqual([])
    expect(ingredientLines('  \n ')).toEqual([])
  })
})

describe('stepBlocks', () => {
  it('splits steps on blank lines, keeping single newlines inside a step', () => {
    expect(stepBlocks('Boil water.\nSalt it well.\n\nCook the pasta.\n\n \nServe.')).toEqual([
      'Boil water.\nSalt it well.',
      'Cook the pasta.',
      'Serve.',
    ])
  })

  it('treats text with no blank lines as one step', () => {
    expect(stepBlocks('Mix everything.\nBake it.')).toEqual(['Mix everything.\nBake it.'])
  })

  it('returns [] for empty text', () => {
    expect(stepBlocks('')).toEqual([])
  })
})

describe('sortRecipes', () => {
  it('orders alphabetically, case-insensitively, with createdAt tiebreak', () => {
    const rows = [
      recipe({ id: 'a', title: 'miso soup' }),
      recipe({ id: 'b', title: 'Apple kugel' }),
      recipe({ id: 'c', title: 'Cacio e pepe', createdAt: '2026-02-01T00:00:00Z' }),
      recipe({ id: 'd', title: 'Cacio e pepe', createdAt: '2026-01-15T00:00:00Z' }),
    ]
    expect(sortRecipes(rows).map((r) => r.id)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('does not mutate its input', () => {
    const rows = [recipe({ id: 'a', title: 'B' }), recipe({ id: 'b', title: 'A' })]
    sortRecipes(rows)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('distinctRecipeTags', () => {
  it('dedupes case-insensitively (first spelling wins) and sorts', () => {
    const rows = [
      recipe({ id: 'a', tags: ['Dinner', 'pasta'] }),
      recipe({ id: 'b', tags: ['dinner', 'Soup', ' '] }),
    ]
    expect(distinctRecipeTags(rows)).toEqual(['Dinner', 'pasta', 'Soup'])
  })
})

describe('filterRecipes', () => {
  const rows = [
    recipe({ id: 'a', title: 'Cacio e pepe', tags: ['dinner', 'pasta'] }),
    recipe({ id: 'b', title: 'Apple kugel', tags: ['dessert'] }),
    recipe({ id: 'c', title: 'Miso soup', tags: ['soup', 'dinner'] }),
    recipe({ id: 'd', title: 'Plain rice', tags: [] }),
  ]

  it('passes everything through with no search or tags', () => {
    expect(filterRecipes(rows, '', [], [])).toEqual(rows)
  })

  it('fuzzy-matches titles', () => {
    expect(filterRecipes(rows, 'ccp', [], []).map((r) => r.id)).toEqual(['a'])
    expect(filterRecipes(rows, 'kgl', [], []).map((r) => r.id)).toEqual(['b'])
  })

  it('includes are OR and drop untagged recipes', () => {
    expect(filterRecipes(rows, '', ['pasta', 'soup'], []).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('excludes always hide, and untagged recipes survive an exclude-only filter', () => {
    expect(filterRecipes(rows, '', [], ['dinner']).map((r) => r.id)).toEqual(['b', 'd'])
  })

  it('an excluded tag beats an include on the same recipe', () => {
    expect(filterRecipes(rows, '', ['dinner'], ['soup']).map((r) => r.id)).toEqual(['a'])
  })

  it('search and tags compose', () => {
    expect(filterRecipes(rows, 'so', ['dinner'], []).map((r) => r.id)).toEqual(['c'])
  })

  it('matches tags case-insensitively', () => {
    expect(filterRecipes(rows, '', ['DINNER'], []).map((r) => r.id)).toEqual(['a', 'c'])
  })
})

describe('servingsTimeLine', () => {
  it('joins the parts that exist', () => {
    expect(servingsTimeLine({ servings: '4', totalTime: '45 min' })).toBe('Serves 4 · 45 min')
    expect(servingsTimeLine({ servings: '4', totalTime: '' })).toBe('Serves 4')
    expect(servingsTimeLine({ servings: '', totalTime: '45 min' })).toBe('45 min')
    expect(servingsTimeLine({ servings: ' ', totalTime: '' })).toBe('')
  })
})

describe('sourceHref', () => {
  it('keeps a URL that already has a scheme', () => {
    expect(sourceHref('https://smittenkitchen.com/x')).toBe('https://smittenkitchen.com/x')
    expect(sourceHref('http://example.com')).toBe('http://example.com')
  })
  it('adds https:// to a bare domain', () => {
    expect(sourceHref('  smittenkitchen.com/2010/04/shakshuka/ ')).toBe('https://smittenkitchen.com/2010/04/shakshuka/')
    expect(sourceHref('//cdn.example.com/a')).toBe('https://cdn.example.com/a')
  })
  it('is empty for a blank URL', () => {
    expect(sourceHref('   ')).toBe('')
  })
})

describe('withMark', () => {
  it('adds an index once, sorted', () => {
    expect(withMark([3], 1, true)).toEqual([1, 3])
    expect(withMark([1, 3], 3, true)).toEqual([1, 3])
  })

  it('removes an index, and removing a missing one is a no-op', () => {
    expect(withMark([1, 3], 1, false)).toEqual([3])
    expect(withMark([3], 7, false)).toEqual([3])
  })
})

describe('remapMarks', () => {
  it('keeps marks on unchanged lines', () => {
    expect(remapMarks(['a', 'b', 'c'], ['a', 'b', 'c'], [0, 2])).toEqual([0, 2])
  })

  it('follows a marked line when a line is inserted above it', () => {
    expect(remapMarks(['flour', 'eggs'], ['salt', 'flour', 'eggs'], [1])).toEqual([2])
  })

  it('drops the mark of a reworded or removed line', () => {
    expect(remapMarks(['flour', 'eggs', 'milk'], ['flour', '3 eggs'], [1, 2])).toEqual([])
  })

  it('keeps identical lines distinct by occurrence', () => {
    // The SECOND "salt" was marked; a line inserted between them must not
    // move the mark onto the first.
    expect(remapMarks(['salt', 'flour', 'salt'], ['salt', 'flour', 'yeast', 'salt'], [2])).toEqual([3])
  })

  it('ignores out-of-range marks', () => {
    expect(remapMarks(['a'], ['a'], [0, 5])).toEqual([0])
  })
})
