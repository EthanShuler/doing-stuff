import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Pulling recipes from another space (keyless seed mode): the "Friends" seed
// space's cookbook is the fixed seedRecipePullSource (useRecipeStore.ts).
// Pulled recipes carry lineage, so reopening the picker shows them as
// "Already here" (disabled); "Miso soup" only shares a title with the home
// seed, so it stays tickable as "Same title here".

const pullRow = (page: Page, title: string) =>
  page.getByRole('dialog').locator('[data-pull-row]').filter({ hasText: title })

async function openPull(page: Page) {
  await page.getByRole('button', { name: 'Pull from…' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('From Friends')).toBeVisible()
  await expect(pullRow(page, 'Black bean tacos')).toBeVisible()
}

test('pull two recipes, then they read "Already here"', async ({ page }) => {
  await page.goto('/recipes')
  await expect(page.getByText('Cacio e pepe')).toBeVisible()
  await openPull(page)

  const dialog = page.getByRole('dialog')
  // The title-only match is flagged but tickable, and starts unticked.
  await expect(pullRow(page, 'Miso soup')).toContainText('Same title here')
  await expect(dialog.getByRole('checkbox', { name: 'Miso soup' })).toBeEnabled()
  await expect(dialog.getByRole('checkbox', { name: 'Miso soup' })).not.toBeChecked()

  await dialog.getByRole('checkbox', { name: 'Black bean tacos' }).check()
  await dialog.getByRole('checkbox', { name: 'Overnight oats' }).check()
  await expect(dialog.getByText('2 selected')).toBeVisible()
  await dialog.getByRole('button', { name: 'Pull 2 recipes' }).click()
  await expect(dialog).toBeHidden()

  // Both land in the index.
  await expect(page.getByText('Black bean tacos')).toBeVisible()
  await expect(page.getByText('Overnight oats')).toBeVisible()

  // Reopen: both are "Already here" and can't be ticked; the miso is unchanged.
  await openPull(page)
  for (const title of ['Black bean tacos', 'Overnight oats']) {
    await expect(pullRow(page, title)).toContainText('Already here')
    await expect(dialog.getByRole('checkbox', { name: title })).toBeDisabled()
  }
  await expect(pullRow(page, 'Miso soup')).toContainText('Same title here')
  await expect(dialog.getByRole('checkbox', { name: 'Miso soup' })).toBeEnabled()
  await expect(dialog.getByText('0 selected · 2 already here')).toBeVisible()
})

test('the pulled recipe keeps its grocery list and tags', async ({ page }) => {
  await page.goto('/recipes')
  await openPull(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Search recipes to pull').fill('tacos')
  await expect(pullRow(page, 'Overnight oats')).toBeHidden()
  await dialog.getByRole('checkbox', { name: 'Black bean tacos' }).check()
  await dialog.getByRole('button', { name: 'Pull 1 recipe' }).click()
  await expect(dialog).toBeHidden()

  // The tags arrive as filter pills; the recipe page shows the source.
  await expect(page.getByRole('button', { name: 'quick', exact: true })).toBeVisible()
  await page.getByText('Black bean tacos').click()
  await expect(page.getByText('Budget Bytes')).toBeVisible()
  await expect(page.getByText('Pickled onions make it.')).toBeVisible()
})

test('the pull button stays off the meal plan', async ({ page }) => {
  await page.goto('/recipes/plan')
  await expect(page.getByText('This week')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pull from…' })).toHaveCount(0)
})
