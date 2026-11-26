import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { pickSegment } from './helpers'

// Pinning and shelving recipes (keyless seed mode). The seed pins Apple
// kugel; nothing starts shelved. "Shelved" is stored as shelf 'hidden'.

const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

/** True when `a` sits above `b` on the page. */
async function above(a: Locator, b: Locator): Promise<boolean> {
  const [boxA, boxB] = await Promise.all([a.boundingBox(), b.boundingBox()])
  return boxA !== null && boxB !== null && boxA.y < boxB.y
}

test('the index shows a Pinned shelf above All', async ({ page }) => {
  await page.goto('/recipes')
  await expect(heading(page, '📌 Pinned')).toBeVisible()
  await expect(heading(page, 'All')).toBeVisible()
  expect(await above(page.getByText('Apple kugel'), heading(page, 'All'))).toBe(true)
  expect(await above(heading(page, 'All'), page.getByText('Cacio e pepe'))).toBe(true)
  await expect(page.getByRole('button', { name: /Shelved ·/ })).toHaveCount(0)
})

test('shelving a recipe moves it into a closed drawer that search still reaches', async ({ page }) => {
  await page.goto('/recipes')
  await page.getByText('Miso soup').click()
  await pickSegment(page, 'Shelved')
  await page.getByRole('button', { name: '← All recipes' }).click()

  // In the drawer, closed.
  const drawer = page.getByRole('button', { name: '▸ Shelved · 1' })
  await expect(drawer).toBeVisible()
  await expect(page.getByText('Miso soup')).toBeHidden()

  // Opens and closes.
  await drawer.click()
  await expect(page.getByText('Miso soup')).toBeVisible()
  await page.getByRole('button', { name: '▾ Shelved · 1' }).click()
  await expect(page.getByText('Miso soup')).toBeHidden()

  // A search reaches into it.
  await page.getByLabel('Search recipes by title').fill('miso')
  await expect(page.getByText('Miso soup')).toBeVisible()
  await page.getByLabel('Clear search').click()
  await expect(page.getByText('Miso soup')).toBeHidden()

  // The list view has the same drawer.
  await pickSegment(page, 'List')
  await expect(page.getByRole('button', { name: '▸ Shelved · 1' })).toBeVisible()
})

test('pinning and unpinning from the recipe page', async ({ page }) => {
  await page.goto('/recipes/r3')
  await pickSegment(page, '📌 Pinned')
  await page.getByRole('button', { name: '← All recipes' }).click()
  await expect(heading(page, 'All')).toBeVisible()
  expect(await above(page.getByText('Weeknight shakshuka'), heading(page, 'All'))).toBe(true)

  // Unpin both: no shelves left, so no headings.
  for (const title of ['Weeknight shakshuka', 'Apple kugel']) {
    await page.getByText(title).click()
    await pickSegment(page, 'All')
    await page.getByRole('button', { name: '← All recipes' }).click()
  }
  await expect(heading(page, 'Cacio e pepe').or(page.getByText('Cacio e pepe'))).toBeVisible()
  await expect(heading(page, '📌 Pinned')).toHaveCount(0)
  await expect(heading(page, 'All')).toHaveCount(0)
})

test('the meal-plan picker ranks pinned first and shelved last', async ({ page }) => {
  // In-app navigation only: the seed lives in memory, so a reload resets it.
  await page.goto('/recipes')
  await page.getByText('Miso soup').click()
  await pickSegment(page, 'Shelved')
  await page.getByRole('button', { name: '← All recipes' }).click()
  await pickSegment(page, 'Meal plan')

  await page.getByRole('button', { name: /^Plan Sat · / }).last().click()
  await page.getByRole('combobox', { name: 'Recipe' }).click()
  await expect(page.locator('[role="option"]:visible')).toHaveText([
    'Apple kugel',
    'Cacio e pepe',
    'Weeknight shakshuka',
    'Miso soup',
  ])
  // A shelved recipe can still be planned.
  await page.locator('[role="option"]:visible', { hasText: 'Miso soup' }).click()
  await expect(page.locator('[data-meal-slot="dinner"]').last()).toContainText('Miso soup')
})
