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
