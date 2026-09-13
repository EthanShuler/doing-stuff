import { expect, test } from '@playwright/test'
import { pickList } from './helpers'

// Seed facts these tests lean on (useListStore seed):
// - Viewer in keyless mode is u1 "Avery"; partner is u2 "Jordan".
// - Movies: Dune: Part Two and Past Lives are open; Everything Everywhere is
//   already checked off (so Done starts at 1).
// - TV: The Bear.
// - Books are PER PERSON: Priory is Avery's, Babel is Jordan's.
// - Free-form list g1 "Groceries": Oat milk open, Coffee beans done.
//
// No drag specs — dnd-kit drags are flaky under automation; the reorder logic
// is covered by src/lib/order.test.ts + the feature's derive.test.ts.

test('the header nav lands on the movie watchlist', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Lists', exact: true }).first().click()
  await expect(page).toHaveURL('/lists/movies')
  await expect(page.getByText('Dune: Part Two')).toBeVisible()
})

test('the picker switches lists without leaving the page', async ({ page }) => {
  await page.goto('/lists/movies')
  await pickList(page, 'TV')
  await expect(page).toHaveURL('/lists/tv')
  await expect(page.getByText('The Bear')).toBeVisible()
  await expect(page.getByText('Dune: Part Two')).toHaveCount(0)
})

test('the reading list is just yours', async ({ page }) => {
  await page.goto('/lists/books')
  await expect(page.getByText('The Priory of the Orange Tree')).toBeVisible()
  // Jordan's row never renders on Avery's reading list.
  await expect(page.getByText('Babel')).toHaveCount(0)
  await expect(page.getByText('Just yours — your partner keeps their own.')).toBeVisible()
})

test('quick-add puts a row on the list and clears the field', async ({ page }) => {
  await page.goto('/lists/movies')
  const quickAdd = page.getByPlaceholder('+ Add a movie…')
  await quickAdd.fill('The Fall Guy')
  await quickAdd.press('Enter')

  await expect(page.getByText('The Fall Guy')).toBeVisible()
  await expect(quickAdd).toHaveValue('')
})

test('checking a movie off moves it into Done and updates the counts', async ({ page }) => {
  await page.goto('/lists/movies')
  // Seed: 2 open, 1 already done.
  await expect(page.getByText('2 to watch · 1 watched')).toBeVisible()

  // click, not check(): checking the box moves the row into the collapsed
  // Done section, so the input is gone before check() could read it back.
  await page.getByRole('checkbox', { name: 'Mark watched — add to board' }).first().click()

  await expect(page.getByText('1 to watch · 2 watched')).toBeVisible()
  // Done is collapsed by default; open it and the row is struck through.
  await page.getByRole('button', { name: /Done · 2/ }).click()
  const row = page.getByText('Dune: Part Two')
  await expect(row).toBeVisible()
  await expect(row).toHaveCSS('text-decoration-line', 'line-through')
})

test('a free-form list checks off without a board', async ({ page }) => {
  await page.goto('/lists/movies')
  await pickList(page, 'Groceries')
  await expect(page).toHaveURL('/lists/g1')
  await expect(page.getByText('1 to do · 1 done')).toBeVisible()

  await page.getByRole('checkbox', { name: 'Mark done', exact: true }).first().click()
  await expect(page.getByText('0 to do · 2 done')).toBeVisible()
  await page.getByRole('button', { name: /Done · 2/ }).click()
  await expect(page.getByText('Oat milk')).toBeVisible()
})

test('create, rename, and delete a free-form list', async ({ page }) => {
  await page.goto('/lists/movies')

  // Create → lands on the new empty list.
  await page.getByRole('button', { name: '+ New list' }).click()
  await expect(page.getByRole('heading', { name: 'New list' })).toBeVisible()
  await page.getByLabel('Name').fill('Errands')
  await page.getByRole('button', { name: 'Create list' }).click()

  await expect(page).toHaveURL(/\/lists\/(?!movies|tv|books)/)
  await expect(page.getByRole('button', { name: /Errands$/ })).toBeVisible()

  // Rename → the picker pill follows.
  await page.getByRole('button', { name: 'Edit list' }).click()
  await expect(page.getByRole('heading', { name: 'Edit list' })).toBeVisible()
  await page.getByLabel('Name').fill('Chores')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('button', { name: /Chores$/ })).toBeVisible()

  // Delete → the themed confirm modal, then a bounce back to the movie list.
  await page.getByRole('button', { name: 'Edit list' }).click()
  await page.getByRole('button', { name: 'Delete list' }).click()
  await expect(page.getByText('Delete "Chores" for both of you?')).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page).toHaveURL('/lists/movies')
  await expect(page.getByRole('button', { name: /Chores$/ })).toHaveCount(0)
})
