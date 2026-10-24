import { expect, test } from '@playwright/test'
import { pickSegment, pickSelectOption } from './helpers'

// The Recipes feature's meal plan (keyless seed mode). The seed plans the
// current week relative to today, so the clock is pinned to a Saturday:
// that week runs Sun 10/18 – Sat 10/24, with Sun = shakshuka, Mon =
// leftovers of it, Tue = free text, Wed = cacio e pepe.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00'))
})

const dayRow = (page: import('@playwright/test').Page, date: string) => page.locator(`[data-meal-day="${date}"]`)

test('the plan deep-loads and the screen toggle survives a round trip', async ({ page }) => {
  await page.goto('/recipes/plan')
  await expect(dayRow(page, '2026-10-18')).toContainText('Weeknight shakshuka')
  await expect(dayRow(page, '2026-10-19')).toContainText('Leftovers · Weeknight shakshuka (Sun)')
  await expect(dayRow(page, '2026-10-20')).toContainText('Tacos at Sam’s')
  await expect(page.getByText('4 of 7 planned')).toBeVisible()

  await pickSegment(page, 'Cookbook')
  await expect(page).toHaveURL(/\/recipes$/)
  await pickSegment(page, 'Meal plan')
  await expect(page).toHaveURL(/\/recipes\/plan$/)
  await expect(dayRow(page, '2026-10-21')).toContainText('Cacio e pepe')
})

test('a day takes a recipe, free text, or leftovers, and clears', async ({ page }) => {
  await page.goto('/recipes/plan')

  await page.getByRole('button', { name: 'Plan Thu · Oct 22' }).click()
  await pickSelectOption(page, page.getByRole('combobox', { name: 'Recipe' }), 'Miso soup')
  await expect(dayRow(page, '2026-10-22')).toContainText('Miso soup')

  await page.getByRole('button', { name: 'Plan Fri · Oct 23' }).click()
  await page.getByRole('button', { name: /Miso soup \(Thu\)/ }).click()
  await expect(dayRow(page, '2026-10-23')).toContainText('Leftovers · Miso soup (Thu)')

  await page.getByRole('button', { name: 'Plan Sat · Oct 24' }).click()
  const sat = page.getByRole('dialog', { name: /Sat/ })
  await sat.getByLabel('Something else').fill('Eating out')
  await sat.getByLabel('Something else').press('Enter')
  await expect(dayRow(page, '2026-10-24')).toContainText('Eating out')
  await expect(page.getByText('7 of 7 planned')).toBeVisible()

  // Clearing Thu turns Fri's leftovers into plain leftovers.
  await page.getByRole('button', { name: 'Plan Thu · Oct 22' }).click()
  await page.getByRole('dialog', { name: /Thu/ }).getByRole('button', { name: 'Clear day' }).click()
  await expect(dayRow(page, '2026-10-22')).toContainText('+ Plan dinner')
  await expect(dayRow(page, '2026-10-23')).toHaveText(/Leftovers$/)
})

test('a recipe day links to its recipe page', async ({ page }) => {
  await page.goto('/recipes/plan')
  await page.getByRole('button', { name: 'Open Cacio e pepe' }).click()
  await expect(page).toHaveURL(/\/recipes\/r1$/)
})

test('next week starts empty', async ({ page }) => {
  await page.goto('/recipes/plan')
  await pickSegment(page, 'Next week')
  await expect(page.getByText('Oct 25 – Oct 31 · 0 of 7 planned')).toBeVisible()
})

test('the grocery step starts staples unticked and remembers what it added', async ({ page }) => {
  await page.goto('/recipes/plan')
  await page.getByRole('button', { name: '🛒 Plan groceries' }).click()
  const modal = page.getByRole('dialog', { name: 'Plan groceries' })
  await expect(modal.getByText('Sun · Weeknight shakshuka')).toBeVisible()
  await expect(modal.getByText('Wed · Cacio e pepe')).toBeVisible()

  // Seed staples: salt, black pepper, olive oil.
  await expect(modal.getByRole('checkbox', { name: '5 eggs' })).toBeChecked()
  await expect(modal.getByRole('checkbox', { name: 'salt for the pasta water' })).not.toBeChecked()
  await expect(modal.getByRole('checkbox', { name: '2 tsp black pepper, coarsely ground' })).not.toBeChecked()

  // A new staple unticks the lines it matches.
  await modal.getByRole('combobox', { name: 'Pantry staples' }).fill('cumin')
  await modal.getByRole('combobox', { name: 'Pantry staples' }).press('Enter')
  await expect(modal.getByRole('checkbox', { name: '1 tsp cumin' })).not.toBeChecked()

  await modal.getByRole('checkbox', { name: '5 eggs' }).uncheck()
  await modal.getByLabel('Extra items').fill('Paper towels\nCoffee')
  // Shakshuka 8 lines − cumin − eggs = 6, cacio 4 − pepper − salt = 2, + 2 extras.
  await modal.getByRole('button', { name: 'Add 10 to Groceries' }).click()
  await expect(page.getByText('Added 10 items to the Groceries list.')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // Re-running: what was added starts unticked and says so.
  await page.getByRole('button', { name: '🛒 Plan groceries' }).click()
  await expect(modal.getByRole('checkbox', { name: '1 onion, sliced' })).not.toBeChecked()
  await expect(modal.getByText('already added').first()).toBeVisible()
  await expect(modal.getByRole('checkbox', { name: '5 eggs' })).toBeChecked()
  await expect(modal.getByRole('button', { name: 'Add 1 to Groceries' })).toBeVisible()
})
