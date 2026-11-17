import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { boardShelf, openShelf, tierRow } from './helpers'

// Seed facts (useTierListStore: seed() is "here", seedTierPullSource() is the
// other space — the same dataset whichever seed space is picked as source):
// - The viewer is u1. Here, Spirited Away is S and Paddington 2 is S; The
//   Princess Bride is A; Blade Runner 2049 is unranked (and undated).
// - There, u1 ranked Arrival S, Spirited Away A, Moonlight A, Blade Runner
//   2049 B; Cats is unranked.
// - So a Movies pull brings Arrival (new, S), Moonlight (new, A) and ranks the
//   already-here Blade Runner 2049 B; Spirited Away keeps its S here.
// - "Snacks" exists only there (Pretzels S, Seaweed snacks B, Licorice
//   unranked).

function pullDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Pull boards' })
}

async function openPull(page: Page) {
  await page.getByRole('button', { name: 'Pull from…' }).click()
  await expect(pullDialog(page)).toBeVisible()
}

test('pulls the Movies board from the other space, then has nothing new', async ({ page }) => {
  await page.goto('/movies')
  await openPull(page)
  const dialog = pullDialog(page)
  await expect(dialog.getByText('From Friends')).toBeVisible()
  // The board on screen starts ticked; the others don't.
  await expect(dialog.getByRole('checkbox', { name: '🎬 Movies' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: '📺 TV' })).not.toBeChecked()
  await expect(dialog.getByText("3 rankings · 2 new items · 2 already here · 1 you've ranked here left alone")).toBeVisible()

  await dialog.getByRole('button', { name: 'Pull', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('alert').filter({ hasText: 'Pulled: 3 rankings' })).toBeVisible()

  // New cards land after the existing ones in their tiers.
  await expect(tierRow(page, 'S').getByText('Arrival')).toBeVisible()
  await expect(tierRow(page, 'A').getByText('Moonlight')).toBeVisible()
  await expect(tierRow(page, 'B').getByText('Blade Runner 2049')).toBeVisible()
  // Already ranked here: left alone.
  await expect(tierRow(page, 'S').getByText('Spirited Away')).toBeVisible()
  await expect(tierRow(page, 'A').getByText('Spirited Away')).toHaveCount(0)
  // Ranked-only by default: the unranked Cats stayed behind.
  await openShelf(page, 'unranked')
  await openShelf(page, 'unwatched')
  await expect(page.getByText('Cats')).toHaveCount(0)

  // Again: nothing new, and the Pull button is off.
  await openPull(page)
  await expect(dialog.getByText('Nothing new to pull.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Pull', exact: true })).toBeDisabled()
  // The unranked option would still bring Cats.
  await dialog.getByRole('checkbox', { name: "Also bring items I haven't ranked" }).check()
  await expect(dialog.getByText('1 new item · 4 already here')).toBeVisible()
  await dialog.getByRole('button', { name: 'Pull', exact: true }).click()
  await expect(dialog).toBeHidden()
  await openShelf(page, 'unwatched')
  // No shared date comes over, so the unranked copy waits on Unwatched.
  await expect(boardShelf(page, 'unwatched').getByText('Cats')).toBeVisible()
})

test('pulls a list that only exists there as a new list', async ({ page }) => {
  await page.goto('/movies')
  await openPull(page)
  const dialog = pullDialog(page)
  await dialog.getByRole('checkbox', { name: '🎬 Movies' }).uncheck()
  await dialog.getByRole('checkbox', { name: '🍿 Snacks' }).check()
  await expect(dialog.getByText('1 new list · 2 rankings · 2 new items')).toBeVisible()
  await dialog.getByRole('button', { name: 'Pull', exact: true }).click()
  await expect(dialog).toBeHidden()
  // The note about what came over floats over the picker; wave it off.
  await page.getByRole('alert').getByRole('button', { name: 'Dismiss' }).click()

  await page.getByRole('button', { name: /Snacks$/ }).click()
  await expect(page).toHaveURL(/\/tiers\//)
  await expect(tierRow(page, 'S').getByText('Pretzels')).toBeVisible()
  await expect(tierRow(page, 'B').getByText('Seaweed snacks')).toBeVisible()

  // From the new list's own board, its source list starts ticked — and is done.
  await openPull(page)
  await expect(dialog.getByRole('checkbox', { name: '🍿 Snacks' })).toBeChecked()
  await expect(dialog.getByText('Nothing new to pull.')).toBeVisible()
})
