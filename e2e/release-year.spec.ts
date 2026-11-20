import { expect, test } from '@playwright/test'
import { tierRow } from './helpers'

// Seed facts (useTierListStore / useListStore seeds): Spirited Away (2001,
// Avery's S) and The Princess Bride (1987, Avery's A) carry release years;
// Ice Cream (/tiers/l0) is a custom board; on the movie list Past Lives is
// Celine Song · 2023; Groceries (/lists/g1) is a free-form list.

test('tier cards show the year and the modal edits it', async ({ page }) => {
  await page.goto('/movies')
  await expect(tierRow(page, 'S').getByText('2001', { exact: true })).toBeVisible()

  await tierRow(page, 'A').getByText('The Princess Bride').click()
  const year = page.getByRole('textbox', { name: 'Year' })
  await expect(year).toHaveValue('1987')

  // Anything but a four-digit year blocks saving.
  await year.fill('87')
  await expect(page.getByText('A 4-digit year')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()

  await year.fill('1988')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tierRow(page, 'A').getByText('1988', { exact: true })).toBeVisible()
})

test('a custom board has no year field', async ({ page }) => {
  await page.goto('/tiers/l0')
  await page.getByRole('button', { name: '+ Add flavor' }).click()
  await expect(page.getByRole('heading', { name: 'Add a flavor' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Year' })).toHaveCount(0)
})

test('list rows show the year and the row modal edits it', async ({ page }) => {
  await page.goto('/lists/movies')
  await expect(page.getByText('· Celine Song · 2023')).toBeVisible()

  await page.getByText('Past Lives').click()
  const year = page.getByRole('textbox', { name: 'Year' })
  await expect(year).toHaveValue('2023')
  await year.fill('2024')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('· Celine Song · 2024')).toBeVisible()
})

test('a free-form list row has no year field', async ({ page }) => {
  await page.goto('/lists/g1')
  await page.getByText('Oat milk').click()
  await expect(page.getByRole('heading', { name: /^Edit / })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Year' })).toHaveCount(0)
})
