import { expect, test } from '@playwright/test'
import { pickSegment, pickSelectOption, setRating } from './helpers'

test('search state survives Log → Map → Log', async ({ page }) => {
  // All four doing-stuff routes render one DoingStuffPage, so its store (and
  // control state) must not remount on screen switches.
  await page.goto('/')
  const search = page.getByLabel('Search entries by title')
  await search.fill('picnic')
  await expect(page.getByText('Riverside picnic')).toBeVisible()
  await expect(page.getByText('Dinner at Tabella')).not.toBeVisible()

  await pickSegment(page, 'Map')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await pickSegment(page, 'Log')

  await expect(page.getByLabel('Search entries by title')).toHaveValue('picnic')
  await expect(page.getByText('Riverside picnic')).toBeVisible()
  await expect(page.getByText('Dinner at Tabella')).not.toBeVisible()
})

test('new-entry modal gates Add entry on activity + rating', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '+ New entry' }).first().click()

  const modal = page.getByRole('dialog')
  await expect(modal.getByText('New entry')).toBeVisible()
  const addButton = modal.getByRole('button', { name: 'Add entry' })
  await expect(addButton).toBeDisabled()

  // Activity is locked until a category is chosen.
  const activityInput = modal.getByPlaceholder('Pick a category first')
  await expect(activityInput).toBeDisabled()

  await pickSelectOption(page, modal.getByPlaceholder('Choose…'), 'Outdoor')
  await pickSelectOption(page, modal.getByPlaceholder('Choose an activity…'), 'Park')
  await expect(addButton).toBeDisabled() // still no rating

  await setRating(modal, 4)
  await expect(addButton).toBeEnabled()
})

test('category pills open an activity row that narrows the log; right-click excludes', async ({ page }) => {
  await page.goto('/')
  // Seed Outdoor: Park (Riverside picnic), Swimming (Morning laps),
  // Backpacking (Pine Ridge overnight).
  await page.getByRole('button', { name: 'Outdoor', exact: true }).click()
  await expect(page.getByText('Riverside picnic')).toBeVisible()
  await expect(page.getByText('Dinner at Tabella')).not.toBeVisible()

  await page.getByRole('button', { name: '🏊 Swimming' }).click()
  await expect(page.getByText('Morning laps')).toBeVisible()
  await expect(page.getByText('Riverside picnic')).not.toBeVisible()

  // Right-click an activity: Outdoor minus Swimming.
  await page.getByRole('button', { name: '🏊 Swimming' }).click({ button: 'right' })
  await page.getByRole('button', { name: '🏊 Swimming' }).click({ button: 'right' })
  await expect(page.getByText('− 🏊 Swimming', { exact: true })).toBeVisible()
  await expect(page.getByText('Morning laps')).not.toBeVisible()
  await expect(page.getByText('Riverside picnic')).toBeVisible()

  // Right-click a category from scratch: everything but City.
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await expect(page.getByRole('button', { name: '🏊 Swimming' })).toBeHidden()
  await page.getByRole('button', { name: 'City', exact: true }).click({ button: 'right' })
  await expect(page.getByText('Dinner at Tabella')).not.toBeVisible()
  await expect(page.getByText('Riverside picnic')).toBeVisible()
  await expect(page.getByText('ASL — Lesson 4')).toBeVisible()
})
