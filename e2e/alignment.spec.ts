import { expect, test } from '@playwright/test'

// Seed facts these tests lean on (useAlignmentStore seed): two charts —
// "Sandwiches" (ac1, all nine squares filled) and "Halloween candy" (ac2,
// five filled; Neutral Good is blank).

test('/alignment forwards to the first chart', async ({ page }) => {
  await page.goto('/alignment')
  await expect(page).toHaveURL('/alignment/ac1')
  await expect(page.getByRole('heading', { name: 'Sandwiches' })).toBeVisible()
  await expect(page.getByText('9 of 9 squares filled')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Chaotic Evil' })).toContainText('Pop-Tart')
})

test('an unknown chart id falls back to the first chart', async ({ page }) => {
  await page.goto('/alignment/nope')
  await expect(page).toHaveURL('/alignment/ac1')
})

test('the header nav lands on Alignment', async ({ page }) => {
  await page.goto('/')
  await page.locator('header').getByText('Alignment', { exact: true }).click()
  await expect(page).toHaveURL('/alignment/ac1')
})

test('the picker switches charts', async ({ page }) => {
  await page.goto('/alignment/ac1')
  await page.getByRole('button', { name: 'Halloween candy' }).click()
  await expect(page).toHaveURL('/alignment/ac2')
  await expect(page.getByText('5 of 9 squares filled')).toBeVisible()
})

test('fill in a square in place; Escape backs out of an edit', async ({ page }) => {
  await page.goto('/alignment/ac2')
  await page.getByRole('button', { name: 'Edit Neutral Good' }).click()
  await page.getByRole('textbox', { name: 'Neutral Good' }).fill('Kit Kat')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Edit Neutral Good' })).toContainText('Kit Kat')
  await expect(page.getByText('6 of 9 squares filled')).toBeVisible()

  await page.getByRole('button', { name: 'Edit Neutral Good' }).click()
  await page.getByRole('textbox', { name: 'Neutral Good' }).fill('Never mind')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Edit Neutral Good' })).toContainText('Kit Kat')
})

test('create, rename, and delete a chart', async ({ page }) => {
  await page.goto('/alignment/ac1')
  await page.getByRole('button', { name: '+ New chart' }).click()
  await page.getByLabel('Title').fill('Dishwasher loading')
  await page.getByRole('button', { name: 'Create chart' }).click()

  await expect(page).toHaveURL(/\/alignment\/ac\d+$/)
  await expect(page.getByRole('heading', { name: 'Dishwasher loading' })).toBeVisible()
  await expect(page.getByText('0 of 9 squares filled')).toBeVisible()

  await page.getByRole('button', { name: 'Edit chart' }).click()
  await page.getByLabel('Title').fill('Dishwashers')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Dishwashers' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit chart' }).click()
  await page.getByRole('button', { name: 'Delete chart' }).click()
  await expect(page.getByText('Delete "Dishwashers" for both of you?')).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page).toHaveURL('/alignment/ac1')
  await expect(page.getByRole('button', { name: 'Dishwashers' })).toHaveCount(0)
})
