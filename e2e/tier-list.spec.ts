import { expect, test } from '@playwright/test'
import { boardShelf, pickSegment, tierRow } from './helpers'

// Seed facts these tests lean on (useTierListStore seed):
// - Viewer in keyless mode is u1 "Avery"; partner is u2 "Jordan".
// - Movies: Spirited Away is S for Avery / A for Jordan; Blade Runner 2049 has
//   no watched date and no Avery placement (→ her Unwatched) but is Jordan's S;
//   Everything Everywhere is dated with no Avery placement (→ her Unranked).
// - Books: read state is per person — Project Hail Mary is ranked A by Avery
//   (she read it) but Unread for Jordan.
// - Ice cream: no dates in the UI — watchedOn is just the shared tried marker.
//   Rum raisin is untried (→ Not tried for both); Strawberry cheesecake is
//   tried but unranked by Avery.

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

test('ice cream board splits tried/not-tried with no dates shown', async ({ page }) => {
  await page.goto('/ice-cream')
  await expect(tierRow(page, 'S').getByText('Mint chocolate chip')).toBeVisible()
  await expect(boardShelf(page, 'unranked').getByText('Strawberry cheesecake')).toBeVisible()
  await expect(boardShelf(page, 'unwatched').getByText('Not tried')).toBeVisible()
  await expect(boardShelf(page, 'unwatched').getByText('Rum raisin')).toBeVisible()

  // The tried marker is shared: Rum raisin is Not tried for Jordan too.
  await pickSegment(page, 'Jordan')
  await expect(boardShelf(page, 'unwatched').getByText('Rum raisin')).toBeVisible()
  await expect(tierRow(page, 'A').getByText('Mint chocolate chip')).toBeVisible()
})

test('ice cream add/edit modal has no date field', async ({ page }) => {
  await page.goto('/ice-cream')
  await page.getByRole('button', { name: '+ Add flavor' }).click()
  await expect(page.getByRole('heading', { name: 'Add a flavor' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Tags' })).toBeVisible()
  await expect(page.locator('input[type="date"]')).toHaveCount(0)
})

test('ice cream watchlist is the To-try list', async ({ page }) => {
  await page.goto('/ice-cream')
  await pickSegment(page, 'To-try list')
  await expect(page.getByText('Ube')).toBeVisible()
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

test('tag pills cycle include → exclude → off', async ({ page }) => {
  await page.goto('/movies')

  // First click: include — only fantasy-tagged movies remain.
  await page.getByText('fantasy', { exact: true }).click()
  await expect(page.getByText('Spirited Away')).toBeVisible()
  await expect(page.getByText('Paddington 2')).not.toBeVisible() // untagged

  // Second click: exclude — the pill relabels "− fantasy"; fantasy movies
  // hide, everything else (including untagged) comes back.
  await page.getByText('fantasy', { exact: true }).click()
  await expect(page.getByText('− fantasy', { exact: true })).toBeVisible()
  await expect(page.getByText('Spirited Away')).not.toBeVisible()
  await expect(page.getByText('The Princess Bride')).not.toBeVisible()
  await expect(page.getByText('Paddington 2')).toBeVisible()
  await expect(page.getByText('Everything Everywhere All at Once')).toBeVisible()

  // Third click: off — full board, drag mode back (no filtered note).
  await page.getByText('− fantasy', { exact: true }).click()
  await expect(page.getByText('Spirited Away')).toBeVisible()
  await expect(page.getByText('Filtered by tag — clear the filter to rearrange.')).not.toBeVisible()
})

test('watchlist tab lists open wishes; books call it Reading list', async ({ page }) => {
  // Movie watchlist is shared: both members' wishes show, in queue order
  // (position, top = next up), with the drag-to-reorder hint. The drag itself
  // is covered by derive.test.ts — dnd-kit drags are flaky under automation.
  await page.goto('/movies')
  await pickSegment(page, 'Watchlist')
  await expect(page.getByText('Dune: Part Two')).toBeVisible()
  await expect(page.getByText('Past Lives')).toBeVisible()
  await expect(page.getByText("Drag to reorder — the top of the list is what you'll watch next.")).toBeVisible()

  // Reading list is per person: only the viewer's (u1's) wish shows — the
  // partner's "Babel" stays on their own list. One open row = nothing to
  // reorder, so no hint.
  await page.goto('/books')
  await pickSegment(page, 'Reading list')
  await expect(page.getByText('The Priory of the Orange Tree')).toBeVisible()
  await expect(page.getByText('Babel')).not.toBeVisible()
  await expect(page.getByText(/Drag to reorder/)).not.toBeVisible()
})
