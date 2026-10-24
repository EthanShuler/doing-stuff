import { describe, expect, it } from 'vitest'
import type { MealPlanDay, Recipe } from '../../types'
import {
  addDays,
  dayName,
  defaultChecked,
  extraLines,
  findGroceriesList,
  groceryGroups,
  isStaple,
  leftoverSources,
  mealLabel,
  plannedCount,
  weekDays,
  weekLabel,
  weekStart,
  withSent,
} from './derive'

const recipe = (id: string, title: string, ingredients = ''): Recipe => ({
  id,
  title,
  imageUrl: '',
  ingredients,
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
})

const day = (id: string, date: string, fields: Partial<MealPlanDay> = {}): MealPlanDay => ({
  id,
  day: date,
  kind: 'recipe',
  recipeId: null,
  text: '',
  leftoversOf: null,
  groceriesSent: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...fields,
})

const staples = (...names: string[]) => names.map((name, i) => ({ id: `s${i}`, name }))

describe('week math', () => {
  it('starts weeks on Sunday', () => {
    expect(weekStart('2026-10-24')).toBe('2026-10-18') // a Saturday
    expect(weekStart('2026-10-25')).toBe('2026-10-25') // a Sunday
    expect(weekStart('2026-11-02')).toBe('2026-11-01')
  })

  it('crosses month, year, and DST boundaries by whole days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-11-01', 7)).toBe('2026-11-08') // US DST ends Nov 1
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('lists the seven days and labels the week', () => {
    const days = weekDays('2026-10-25')
    expect(days).toHaveLength(7)
    expect(days[6]).toBe('2026-10-31')
    expect(days.map(dayName)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(weekLabel('2026-10-25')).toBe('Oct 25 – Oct 31')
  })

  it('counts planned days in the week only', () => {
    const rows = [day('a', '2026-10-25'), day('b', '2026-10-31'), day('c', '2026-11-01')]
    expect(plannedCount(rows, weekDays('2026-10-25'))).toBe(2)
  })
})

describe('labels and leftovers', () => {
  const recipes = [recipe('r1', 'Shakshuka'), recipe('r2', 'Cacio e pepe')]
  const sun = day('d1', '2026-10-25', { recipeId: 'r1' })

  it('labels each kind', () => {
    const rows = [sun]
    expect(mealLabel(sun, recipes, rows)).toBe('Shakshuka')
    expect(mealLabel(day('x', '2026-10-26', { kind: 'text', text: 'Pizza night' }), recipes, rows)).toBe('Pizza night')
    expect(mealLabel(day('x', '2026-10-26', { kind: 'leftovers', leftoversOf: 'd1' }), recipes, rows)).toBe(
      'Leftovers · Shakshuka (Sun)',
    )
    expect(mealLabel(day('x', '2026-10-26', { kind: 'leftovers' }), recipes, rows)).toBe('Leftovers')
    expect(mealLabel(day('x', '2026-10-26', { recipeId: 'gone' }), recipes, rows)).toBe('Deleted recipe')
  })

  it('offers recipe days from the previous 7 days, newest first', () => {
    const rows = [
      day('old', '2026-10-17', { recipeId: 'r2' }), // 8 days before Sun 10/25
      day('sat', '2026-10-24', { recipeId: 'r2' }),
      day('fri', '2026-10-23', { recipeId: 'r1' }),
      day('txt', '2026-10-22', { kind: 'text', text: 'Out' }),
      day('gone', '2026-10-21', { recipeId: 'deleted' }),
      day('same', '2026-10-25', { recipeId: 'r1' }),
    ]
    expect(leftoverSources(rows, recipes, '2026-10-25').map((d) => d.id)).toEqual(['sat', 'fri'])
  })
})

describe('staples', () => {
  it('matches whole words, any case', () => {
    const list = staples('salt', 'Olive Oil')
    expect(isStaple('salt for the pasta water', list)).toBe(true)
    expect(isStaple('4 tbsp unsalted butter', list)).toBe(false)
    expect(isStaple('2 tbsp olive oil', list)).toBe(true)
    expect(isStaple('1 onion', list)).toBe(false)
  })

  it('ignores blank staples and escapes regex characters', () => {
    expect(isStaple('anything', staples('  '))).toBe(false)
    expect(isStaple('1 cup a.p. flour', staples('a.p. flour'))).toBe(true)
    expect(isStaple('1 cup aXpX flour', staples('a.p. flour'))).toBe(false)
    expect(isStaple('salt + pepper', staples('salt'))).toBe(true)
  })
})

describe('grocery groups', () => {
  const recipes = [
    recipe('r1', 'Shakshuka', '1 onion\n\n5 eggs\nsalt'),
    recipe('r2', 'Kugel', '3 eggs\nsugar'),
    recipe('r3', 'Toast', ''),
  ]
  const week = weekDays('2026-10-25')
  const rows = [
    day('tue', '2026-10-27', { recipeId: 'r2', groceriesSent: ['3 eggs'] }),
    day('sun', '2026-10-25', { recipeId: 'r1' }),
    day('mon', '2026-10-26', { kind: 'leftovers', leftoversOf: 'sun' }),
    day('wed', '2026-10-28', { kind: 'text', text: 'Out' }),
    day('thu', '2026-10-29', { recipeId: 'r3' }),
    day('next', '2026-11-01', { recipeId: 'r2' }),
  ]

  it('groups recipe days of the week in day order, skipping leftovers and text', () => {
    const groups = groceryGroups(rows, week, recipes, [])
    expect(groups.map((g) => g.day.id)).toEqual(['sun', 'tue', 'thu'])
    expect(groups[0].lines.map((l) => l.text)).toEqual(['1 onion', '5 eggs', 'salt'])
    expect(groups[2].lines).toEqual([])
  })

  it('starts staples and already-sent lines unchecked', () => {
    const groups = groceryGroups(rows, week, recipes, staples('salt'))
    const checked = defaultChecked(groups)
    expect(groups[0].lines[2]).toMatchObject({ text: 'salt', staple: true, sent: false })
    expect(groups[1].lines[0]).toMatchObject({ text: '3 eggs', sent: true })
    expect([...checked].sort()).toEqual(['sun:0', 'sun:1', 'tue:1'])
  })
})

describe('grocery helpers', () => {
  it('splits extras one per line', () => {
    expect(extraLines(' Paper towels \n\n Coffee\n')).toEqual(['Paper towels', 'Coffee'])
  })

  it('unions sent lines without repeats', () => {
    expect(withSent(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('finds the oldest list named Groceries, any case', () => {
    const lists = [
      { id: 'x', name: 'Restaurants', createdAt: '2026-01-01' },
      { id: 'b', name: ' groceries ', createdAt: '2026-03-01' },
      { id: 'a', name: 'Groceries', createdAt: '2026-02-01' },
    ]
    expect(findGroceriesList(lists)?.id).toBe('a')
    expect(findGroceriesList(lists.slice(0, 1))).toBeNull()
  })
})
