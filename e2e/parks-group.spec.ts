import { expect, test, type Page } from '@playwright/test'
import { pickSegment } from './helpers'

// Parks in a space of three or more (keyless seed mode). The seed's "Friends"
// space has three members — Avery (u1), Jordan (u2) and Riley — so Parks runs
// in group mode there: a whose-map picker, two pin states, no Together /
// Separately. Seed facts: Avery has been to 6 parks, Jordan to 6, Riley to 2
// (Olympic alone, Yellowstone with Avery); 9 parks have a visit from anyone.

async function openGroupParks(page: Page) {
  await page.goto('/parks')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Friends' }).click()
  await expect(page.getByRole('button', { name: 'Account menu' })).toHaveText(/Friends/)
  await expect(page).toHaveURL('/parks')
  await expect(page.locator('.leaflet-container')).toBeVisible()
}

const pins = (page: Page) => page.locator('.leaflet-marker-icon')

test('group mode swaps the pair design for a whose-map picker', async ({ page }) => {
  await openGroupParks(page)
  const picker = page.getByRole('radiogroup', { name: 'Whose map' })
  for (const label of ['Everyone', 'Avery', 'Jordan', 'Riley']) {
    await expect(picker.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(pins(page)).toHaveCount(63)

  // Per-member scoreboard, and no together/separately anywhere.
  await expect(page.getByText('Avery 6/63')).toBeVisible()
  await expect(page.getByText('Riley 2/63')).toBeVisible()
  await expect(page.getByText(/Together/)).toHaveCount(0)
  await expect(page.getByText(/Separately/i)).toHaveCount(0)

  // Two-state legend and filter.
  await expect(page.getByText('Not yet', { exact: true })).toBeVisible()
  await expect(page.getByText('Visited', { exact: true })).toHaveCount(2) // legend + pill
  await expect(page.getByRole('button', { name: 'Visited', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unvisited' })).toBeVisible()
})

test('a visited pin lists who has been, and the Visited filter follows the viewer', async ({ page }) => {
  await openGroupParks(page)
  await page.getByRole('button', { name: 'Visited', exact: true }).click()
  await expect(pins(page)).toHaveCount(9)

  // Riley's map: just Olympic and Yellowstone.
  await pickSegment(page, 'Riley')
  await expect(pins(page)).toHaveCount(2)
  await pins(page).first().click()
  await expect(page.locator('.leaflet-popup')).toContainText(/Visited by (Avery, )?Riley/)

  await pickSegment(page, 'Avery')
  await expect(pins(page)).toHaveCount(6)

  // Unvisited on Jordan's map hides Jordan's parks but keeps Riley's Olympic;
  // the viewer and the filter both survive the List toggle.
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await pickSegment(page, 'Jordan')
  await page.getByRole('button', { name: 'Unvisited' }).click()
  await expect(pins(page)).toHaveCount(57)
  await pickSegment(page, 'List')
  await expect(page.getByText('Olympic', { exact: true })).toBeVisible()
  await expect(page.getByText('Visited by Riley', { exact: true })).toBeVisible()
  await expect(page.getByText('Denali', { exact: true })).toBeHidden()
})

test('the visit form has plain checkboxes and no separately option', async ({ page }) => {
  await openGroupParks(page)
  await pickSegment(page, 'List')
  await page.getByText('Yellowstone', { exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Avery, Riley')).toBeVisible()

  await page.getByRole('button', { name: '+ Log a visit' }).click()
  for (const name of ['Avery', 'Jordan', 'Riley']) {
    await expect(page.getByRole('checkbox', { name })).toBeChecked()
  }
  await expect(page.getByRole('checkbox', { name: /separately/i })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Avery' }).uncheck()
  await page.getByRole('button', { name: 'Log visit', exact: true }).click()
  await expect(dialog.getByText('Jordan, Riley')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Jordan 7/63')).toBeVisible()
  await expect(page.getByText('Riley 2/63')).toBeVisible()
})
