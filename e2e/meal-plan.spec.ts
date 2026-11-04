import { expect, test } from '@playwright/test'
import { pickSegment, pickSelectOption } from './helpers'

// The Recipes feature's meal plan (keyless seed mode). The seed plans the
// current week relative to today, so the clock is pinned to a Saturday:
// that week runs Sun 10/18 – Sat 10/24, with dinners Sun = shakshuka, Mon =
// leftovers of it, Tue = free text, Wed = cacio e pepe, and lunches Mon =
// free text, Thu = leftovers of Wed's dinner.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00'))
})

type Page = import('@playwright/test').Page
const slot = (page: Page, date: string, meal: 'lunch' | 'dinner' = 'dinner') =>
  page.locator(`[data-meal-day="${date}"] [data-meal-slot="${meal}"]`)

test('the plan deep-loads and the screen toggle survives a round trip', async ({ page }) => {
  await page.goto('/recipes/plan')
  await expect(slot(page, '2026-10-18')).toContainText('Weeknight shakshuka')
  await expect(slot(page, '2026-10-19')).toContainText('Leftovers · Weeknight shakshuka (Sun dinner)')
  await expect(slot(page, '2026-10-20')).toContainText('Tacos at Sam’s')
  await expect(slot(page, '2026-10-19', 'lunch')).toContainText('Sandwiches')
  await expect(slot(page, '2026-10-22', 'lunch')).toContainText('Leftovers · Cacio e pepe (Wed dinner)')
  await expect(page.getByText('4 of 7 dinners · 2 of 7 lunches')).toBeVisible()

  await pickSegment(page, 'Cookbook')
  await expect(page).toHaveURL(/\/recipes$/)
  await pickSegment(page, 'Meal plan')
  await expect(page).toHaveURL(/\/recipes\/plan$/)
  await expect(slot(page, '2026-10-21')).toContainText('Cacio e pepe')
})

test('a meal takes a recipe, free text, or leftovers, and clears', async ({ page }) => {
  await page.goto('/recipes/plan')

  await page.getByRole('button', { name: 'Plan Thu · Oct 22 · Dinner' }).click()
  await pickSelectOption(page, page.getByRole('combobox', { name: 'Recipe' }), 'Miso soup')
  await expect(slot(page, '2026-10-22')).toContainText('Miso soup')

  await page.getByRole('button', { name: 'Plan Fri · Oct 23 · Lunch' }).click()
  await page.getByRole('button', { name: /Miso soup \(Thu dinner\)/ }).click()
  await expect(slot(page, '2026-10-23', 'lunch')).toContainText('Leftovers · Miso soup (Thu dinner)')
  await expect(slot(page, '2026-10-23')).toContainText('+ Plan dinner')

  await page.getByRole('button', { name: 'Plan Sat · Oct 24 · Dinner' }).click()
  const sat = page.getByRole('dialog', { name: /Sat/ })
  await sat.getByLabel('Something else').fill('Eating out')
  await sat.getByLabel('Something else').press('Enter')
  await expect(slot(page, '2026-10-24')).toContainText('Eating out')
  await expect(page.getByText('6 of 7 dinners · 3 of 7 lunches')).toBeVisible()

  // Clearing Thu dinner turns Fri lunch's leftovers into plain leftovers,
  // and leaves Thu lunch alone.
  await page.getByRole('button', { name: 'Plan Thu · Oct 22 · Dinner' }).click()
  await page.getByRole('dialog', { name: /Thu/ }).getByRole('button', { name: 'Clear dinner' }).click()
  await expect(slot(page, '2026-10-22')).toContainText('+ Plan dinner')
  await expect(slot(page, '2026-10-22', 'lunch')).toContainText('Cacio e pepe')
  await expect(slot(page, '2026-10-23', 'lunch')).toHaveText(/Leftovers$/)
})

test('a recipe day links to its recipe page', async ({ page }) => {
  await page.goto('/recipes/plan')
  await page.getByRole('button', { name: 'Open Cacio e pepe' }).click()
  await expect(page).toHaveURL(/\/recipes\/r1$/)
})

test('next week starts empty', async ({ page }) => {
  await page.goto('/recipes/plan')
  await pickSegment(page, 'Next week')
  await expect(page.getByText('Oct 25 – Oct 31 · 0 of 7 dinners · 0 of 7 lunches')).toBeVisible()
})

test('the grocery step starts staples unticked and remembers what it added', async ({ page }) => {
  await page.goto('/recipes/plan')
  await page.getByRole('button', { name: '🛒 Plan groceries' }).click()
  const modal = page.getByRole('dialog', { name: 'Plan groceries' })
  await expect(modal.getByText('Sun dinner · Weeknight shakshuka')).toBeVisible()
  await expect(modal.getByText('Wed dinner · Cacio e pepe')).toBeVisible()

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
