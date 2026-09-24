import { expect, test } from '@playwright/test'
import { pickSelectOption } from './helpers'

// The little guy collection (keyless seed mode): the A–Z grid, the owner
// filter pills, name search, and the add/edit modal round-trip.

test('grid lists the seed little guys A–Z', async ({ page }) => {
  await page.goto('/little-guys')
  await expect(page.getByText('Bartholomew')).toBeVisible()
  await expect(page.getByText('Sleepy Steve')).toBeVisible()
  // Alphabetical, not insertion order (DOM order = innerText order).
  const body = await page.locator('body').innerText()
  expect(body.indexOf('Bartholomew')).toBeLessThan(body.indexOf('Peeker'))
})

test('owner pills filter the shelf to one person', async ({ page }) => {
  await page.goto('/little-guys')
  // Two seed guys belong to Avery, one to Jordan, one to nobody.
  await page.getByRole('button', { name: 'Jordan 2' }).click()
  await expect(page.getByText('Bartholomew')).toBeVisible()
  await expect(page.getByText('Sleepy Steve')).toBeHidden()

  // Includes are OR: adding the ownerless pill widens the shelf.
  await page.getByRole('button', { name: 'Nobody in particular 1' }).click()
  await expect(page.getByText('Desk Guy')).toBeVisible()
  await expect(page.getByText('Bartholomew')).toBeVisible()
  await expect(page.getByText('Sleepy Steve')).toBeHidden()

  await page.getByRole('button', { name: 'All 5' }).click()
  await expect(page.getByText('Sleepy Steve')).toBeVisible()

  // Right-click excludes straight away.
  await page.getByRole('button', { name: 'Jordan 2' }).click({ button: 'right' })
  await expect(page.getByText('Bartholomew')).toBeHidden()
  await expect(page.getByText('Sleepy Steve')).toBeVisible()
})

test('search narrows the grid by name', async ({ page }) => {
  await page.goto('/little-guys')
  await page.getByLabel('Search little guys by name').fill('bart')
  await expect(page.getByText('Bartholomew')).toBeVisible()
  await expect(page.getByText('Sleepy Steve')).toBeHidden()

  await page.getByLabel('Clear search').click()
  await expect(page.getByText('Sleepy Steve')).toBeVisible()
})

test('add-guy modal gates save on a name and edits round-trip', async ({ page }) => {
  await page.goto('/little-guys')
  await page.getByRole('button', { name: '+ Add little guy' }).click()
  const save = page.getByRole('button', { name: 'Add little guy', exact: true })
  await expect(save).toBeDisabled()

  // exact — the search box's aria-label ("Search little guys by name") would
  // otherwise match this too.
  await page.getByLabel('Name', { exact: true }).fill('Tiny Dracula')
  await page.getByLabel('Personality').fill('nocturnal')
  // A Mantine Select ships a hidden form input alongside the visible one, so
  // getByLabel('Owner') is ambiguous — target the combobox role.
  await pickSelectOption(page, page.getByRole('combobox', { name: 'Owner' }), 'Jordan')
  await expect(save).toBeEnabled()
  await save.click()

  await expect(page.getByText('Tiny Dracula')).toBeVisible()
  await expect(page.getByText('nocturnal')).toBeVisible()

  // Click the new card to edit; the modal opens prefilled with what was saved.
  await page.getByText('Tiny Dracula').click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Tiny Dracula')
  await expect(page.getByRole('combobox', { name: 'Owner' })).toHaveValue('Jordan')
  await page.getByRole('button', { name: 'Cancel' }).click()

  // He landed on Jordan's shelf, which now holds one more.
  await expect(page.getByRole('button', { name: 'Jordan 3' })).toBeVisible()
})
