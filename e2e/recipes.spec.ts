import { expect, test } from '@playwright/test'
import { pickSegment } from './helpers'

// The shared cookbook (keyless seed mode): index grid/list toggle, search,
// tag pills, the per-recipe page (deep-loadable), tap-to-cross-off, and the
// add/edit modal gating.

test('index grid shows seed recipes A–Z', async ({ page }) => {
  await page.goto('/recipes')
  await expect(page.getByText('Cacio e pepe')).toBeVisible()
  // Alphabetical: Apple kugel before Miso soup before Weeknight shakshuka.
  const body = await page.locator('body').innerText()
  expect(body.indexOf('Apple kugel')).toBeLessThan(body.indexOf('Miso soup'))
  expect(body.indexOf('Miso soup')).toBeLessThan(body.indexOf('Weeknight shakshuka'))
})

test('search and tag pills filter the index', async ({ page }) => {
  await page.goto('/recipes')
  await page.getByLabel('Search recipes by title').fill('ccp')
  await expect(page.getByText('Cacio e pepe')).toBeVisible()
  await expect(page.getByText('Apple kugel')).toBeHidden()
  await page.getByLabel('Clear search').click()

  // Include "dessert" → only the kugel survives.
  await page.getByRole('button', { name: 'dessert', exact: true }).click()
  await expect(page.getByText('Apple kugel')).toBeVisible()
  await expect(page.getByText('Miso soup')).toBeHidden()
  await page.getByRole('button', { name: 'All recipes' }).click()
  await expect(page.getByText('Miso soup')).toBeVisible()
})

test('list view shows dense rows and survives the toggle', async ({ page }) => {
  await page.goto('/recipes')
  await pickSegment(page, 'List')
  await expect(page.getByText('Grandma Ruth')).toBeVisible()
  await pickSegment(page, 'Grid')
  await expect(page.getByText('Cacio e pepe')).toBeVisible()
})

test('a recipe page deep-loads, renders numbered steps, and crosses off ingredients', async ({ page }) => {
  await page.goto('/recipes')
  await page.getByText('Weeknight shakshuka').click()
  await expect(page).toHaveURL(/\/recipes\/r3$/)
  await expect(page.getByText('Ingredients')).toBeVisible()
  await expect(page.getByText('Double the garlic. Always double the garlic.')).toBeVisible()
  await expect(page.getByText('Added by Avery', { exact: false })).toBeVisible()

  // Tap-to-cross-off is ephemeral local state.
  const eggLine = page.getByRole('button', { name: '5 eggs' })
  await eggLine.click()
  await expect(eggLine).toHaveCSS('text-decoration-line', 'line-through')

  // Deep-load works too (SPA fallback), and back returns to the index.
  await page.goto('/recipes/r2')
  await expect(page.getByText('Apple kugel')).toBeVisible()
  await expect(page.getByText('Grandma Ruth')).toBeVisible()
  await page.getByRole('button', { name: '← All recipes' }).click()
  await expect(page).toHaveURL(/\/recipes$/)
})

test('add-recipe modal gates save on a title and edits round-trip', async ({ page }) => {
  await page.goto('/recipes')
  await page.getByRole('button', { name: '+ Add recipe' }).click()
  const save = page.getByRole('button', { name: 'Add recipe', exact: true })
  await expect(save).toBeDisabled()
  // exact — the index's search box is labelled "Search recipes by title"
  await page.getByLabel('Title', { exact: true }).fill('Peanut butter toast')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByText('Peanut butter toast')).toBeVisible()

  // Open its page, then edit from there; the modal opens prefilled.
  await page.getByText('Peanut butter toast').click()
  await page.getByRole('button', { name: 'Edit recipe' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Peanut butter toast')
  await page.getByRole('button', { name: 'Cancel' }).click()
})

test('an unknown recipe id shows the not-found state', async ({ page }) => {
  await page.goto('/recipes/nope')
  await expect(page.getByText('Recipe not found')).toBeVisible()
  await page.getByRole('button', { name: '← All recipes' }).click()
  await expect(page.getByText('Cacio e pepe')).toBeVisible()
})
