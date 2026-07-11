import { expect, test } from '@playwright/test'
import { pickSegment } from './helpers'

test('header feature nav navigates and browser back works', async ({ page }) => {
  await page.goto('/')
  const header = page.locator('header')

  await header.getByText('Movies', { exact: true }).click()
  await expect(page).toHaveURL('/movies')
  await expect(page.getByText('Spirited Away')).toBeVisible()

  await header.getByText('Books', { exact: true }).click()
  await expect(page).toHaveURL('/books')
  await expect(page.getByText('Piranesi')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL('/movies')
  await page.goBack()
  await expect(page).toHaveURL('/')
})

test('doing-stuff screen toggle navigates between its routes', async ({ page }) => {
  await page.goto('/')
  await pickSegment(page, 'Map')
  await expect(page).toHaveURL('/map')
  await expect(page.locator('.leaflet-container')).toBeVisible()

  await pickSegment(page, 'Calendar')
  await expect(page).toHaveURL('/calendar')

  await pickSegment(page, 'Log')
  await expect(page).toHaveURL('/')
  await expect(page.getByText('Riverside picnic')).toBeVisible()
})
