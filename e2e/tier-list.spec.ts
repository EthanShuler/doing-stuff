import { expect, test } from '@playwright/test'
import { boardShelf, pickSegment, tierRow } from './helpers'

// Seed facts these tests lean on (useTierListStore seed):
// - Viewer in keyless mode is u1 "Avery"; partner is u2 "Jordan".
// - Movies: Spirited Away is S for Avery / A for Jordan; Blade Runner 2049 has
//   no watched date and no Avery placement (→ her Unwatched) but is Jordan's S;
//   Everything Everywhere is dated with no Avery placement (→ her Unranked).
// - Books: read state is per person — Project Hail Mary is ranked A by Avery
//   (she read it) but Unread for Jordan.

test('movie board derives tiers and shelves for the viewer', async ({ page }) => {
  await page.goto('/movies')
  await expect(tierRow(page, 'S').getByText('Spirited Away')).toBeVisible()
  await expect(tierRow(page, 'S').getByText('Paddington 2')).toBeVisible()
  await expect(boardShelf(page, 'unranked').getByText('Everything Everywhere All at Once')).toBeVisible()
  await expect(boardShelf(page, 'unwatched').getByText('Blade Runner 2049')).toBeVisible()
})

test('You/Partner toggle swaps whose board is derived, read-only', async ({ page }) => {
  await page.goto('/movies')
  await pickSegment(page, 'Jordan')

  await expect(page.getByText("Jordan's board — just for looking.")).toBeVisible()
  // Blade Runner: Avery's Unwatched, but Jordan ranked it S.
  await expect(tierRow(page, 'S').getByText('Blade Runner 2049')).toBeVisible()
  await expect(tierRow(page, 'A').getByText('Spirited Away')).toBeVisible()

  await pickSegment(page, 'You')
  await expect(tierRow(page, 'S').getByText('Spirited Away')).toBeVisible()
})

test('book read state is per person (Unread shelf differs by viewer)', async ({ page }) => {
  await page.goto('/books')
  // Avery read Project Hail Mary and ranked it A; Circe is unread for her.
  await expect(tierRow(page, 'A').getByText('Project Hail Mary')).toBeVisible()
  await expect(boardShelf(page, 'unwatched').getByText('Unread')).toBeVisible()
  await expect(boardShelf(page, 'unwatched').getByText('Circe')).toBeVisible()

  // Jordan hasn't read it — same book, his Unread shelf.
  await pickSegment(page, 'Jordan')
  await expect(boardShelf(page, 'unwatched').getByText('Project Hail Mary')).toBeVisible()
})

test('tag filter makes the board read-only and hides non-matches', async ({ page }) => {
  await page.goto('/movies')
  await page.getByText('sci-fi', { exact: true }).click()

  await expect(page.getByText('Filtered by tag — clear the filter to rearrange.')).toBeVisible()
  await expect(page.getByText('Everything Everywhere All at Once')).toBeVisible()
  await expect(page.getByText('Spirited Away')).not.toBeVisible() // fantasy/ghibli only

  await page.getByText('All movies', { exact: true }).click()
  await expect(page.getByText('Spirited Away')).toBeVisible()
})

test('watchlist tab lists open wishes; books call it Reading list', async ({ page }) => {
  await page.goto('/movies')
  await pickSegment(page, 'Watchlist')
  await expect(page.getByText('Dune: Part Two')).toBeVisible()
  await expect(page.getByText('Past Lives')).toBeVisible()

  await page.goto('/books')
  await pickSegment(page, 'Reading list')
  await expect(page.getByText('The Priory of the Orange Tree')).toBeVisible()
})
