import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { boardShelf, openShelf, pickList, pickSegment, tierRow } from './helpers'

// Seed facts these tests lean on (useTierListStore seed):
// - Viewer in keyless mode is u1 "Avery"; partner is u2 "Jordan".
// - Movies: Spirited Away is S for Avery / A for Jordan; Blade Runner 2049 has
//   no watched date and no Avery placement (→ her Unwatched) but is Jordan's S;
//   Everything Everywhere is dated with no Avery placement (→ her Unranked).
// - Books: read state is per person — Project Hail Mary is ranked A by Avery
//   (she read it) but Unread for Jordan.
// - Ice cream is a CUSTOM list (seed l0, /tiers/l0): no dates in the UI and no
//   second shelf — Rum raisin and Strawberry cheesecake are both simply
//   unranked for Avery.
// - The shelves under the tiers start COLLAPSED (heading + count only), so a
//   test that reads a shelf's cards expands it first with openShelf().

test('movie board derives tiers and shelves for the viewer', async ({ page }) => {
  await page.goto('/movies')
  await expect(tierRow(page, 'S').getByText('Spirited Away')).toBeVisible()
  await expect(tierRow(page, 'S').getByText('Paddington 2')).toBeVisible()
  await openShelf(page, 'unranked')
  await openShelf(page, 'unwatched')
  await expect(boardShelf(page, 'unranked').getByText('Everything Everywhere All at Once')).toBeVisible()
  await expect(boardShelf(page, 'unwatched').getByText('Blade Runner 2049')).toBeVisible()
})

test('shelves start collapsed with a count, expand on click, and reset on a board switch', async ({ page }) => {
  await page.goto('/movies')
  const unranked = boardShelf(page, 'unranked')
  const toggle = unranked.locator('[data-shelf-toggle]')
  // Collapsed: heading + count, no cards.
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(unranked.getByText('Unranked')).toBeVisible()
  await expect(unranked.getByText('· 1')).toBeVisible()
  await expect(unranked.getByText('Everything Everywhere All at Once')).toHaveCount(0)
  // The unwatched shelf is independent and also collapsed.
  await expect(boardShelf(page, 'unwatched').locator('[data-shelf-toggle]')).toHaveAttribute('aria-expanded', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(unranked.getByText('Everything Everywhere All at Once')).toBeVisible()
  await expect(boardShelf(page, 'unwatched').getByText('Blade Runner 2049')).toHaveCount(0)

  // Expanding survives the You/Partner switch (the page owns the state)…
  await pickSegment(page, 'Jordan')
  await expect(boardShelf(page, 'unranked').locator('[data-shelf-toggle]')).toHaveAttribute('aria-expanded', 'true')
  await pickSegment(page, 'You')

  // …but a board switch starts collapsed again.
  await pickList(page, 'TV')
  await expect(boardShelf(page, 'unranked').locator('[data-shelf-toggle]')).toHaveAttribute('aria-expanded', 'false')
})

test('the list picker switches boards without leaving the page', async ({ page }) => {
  await page.goto('/movies')
  await expect(tierRow(page, 'S').getByText('Spirited Away')).toBeVisible()

  await pickList(page, 'TV')
  await expect(page).toHaveURL('/tv')
  await expect(page.getByText('Severance')).toBeVisible()
  await expect(page.getByText('Spirited Away')).not.toBeVisible()
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
  await openShelf(page, 'unwatched')
  await expect(boardShelf(page, 'unwatched').getByText('Circe')).toBeVisible()

  // Jordan hasn't read it — same book, his Unread shelf.
  await pickSegment(page, 'Jordan')
  await expect(boardShelf(page, 'unwatched').getByText('Project Hail Mary')).toBeVisible()
})

test('ice cream board has one shelf and no dates', async ({ page }) => {
  await page.goto('/tiers/l0')
  await expect(tierRow(page, 'S').getByText('Mint chocolate chip')).toBeVisible()
  // A custom list has no second shelf at all.
  await expect(boardShelf(page, 'unwatched')).toHaveCount(0)

  // Everything Avery hasn't ranked sits in Unranked, dated or not.
  await openShelf(page, 'unranked')
  await expect(boardShelf(page, 'unranked').getByText('Strawberry cheesecake')).toBeVisible()
  await expect(boardShelf(page, 'unranked').getByText('Rum raisin')).toBeVisible()

  await pickSegment(page, 'Jordan')
  await expect(boardShelf(page, 'unwatched')).toHaveCount(0)
  await expect(tierRow(page, 'A').getByText('Mint chocolate chip')).toBeVisible()
})

test('ice cream add/edit modal has no date field', async ({ page }) => {
  await page.goto('/tiers/l0')
  await page.getByRole('button', { name: '+ Add flavor' }).click()
  await expect(page.getByRole('heading', { name: 'Add a flavor' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Tags' })).toBeVisible()
  await expect(page.locator('input[type="date"]')).toHaveCount(0)
})

test('tag filter makes the board read-only and hides non-matches', async ({ page }) => {
  await page.goto('/movies')
  // Everything Everywhere is unranked — open that shelf so it can show.
  await openShelf(page, 'unranked')
  await page.getByText('sci-fi', { exact: true }).click()

  await expect(page.getByText('Filtered by tag — clear the filter to rearrange.')).toBeVisible()
  await expect(page.getByText('Everything Everywhere All at Once')).toBeVisible()
  await expect(page.getByText('Spirited Away')).not.toBeVisible() // fantasy/ghibli only

  await page.getByText('All movies', { exact: true }).click()
  await expect(page.getByText('Spirited Away')).toBeVisible()
})

test('tag pills cycle include → exclude → off', async ({ page }) => {
  await page.goto('/movies')
  // The shelf state is the page's, so it stays open across the filter's
  // read-only ↔ drag board swap.
  await openShelf(page, 'unranked')

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

// --- custom lists ------------------------------------------------------------
// Seed list l1 is "Fruits": Mango ranked S by Avery; Durian and Honeycrisp
// apple both unranked (a custom list has no second shelf).

test('the picker reaches a space-defined board without leaving the page', async ({ page }) => {
  await page.goto('/movies')
  await pickList(page, 'Fruits')
  await expect(page).toHaveURL('/tiers/l1')

  await expect(tierRow(page, 'S').getByText('Mango')).toBeVisible()
  await openShelf(page, 'unranked')
  await expect(boardShelf(page, 'unranked').getByText('Honeycrisp apple')).toBeVisible()
  await expect(boardShelf(page, 'unranked').getByText('Durian')).toBeVisible()
  await expect(boardShelf(page, 'unwatched')).toHaveCount(0)
})

/** The You/Partner toggle's partner tab (Mantine's SegmentedControl label). */
const partnerTab = (page: Page) => page.locator('.mantine-SegmentedControl-label').filter({ hasText: /^Jordan$/ })

// Seed list l2 is "Board games", flagged SHARED: one board for the space
// (null-owner placements) — Catan S, Wingspan and Twilight Imperium unranked.
test('a shared list shows one board for both members, with no You/Partner toggle', async ({ page }) => {
  await page.goto('/movies')
  await expect(partnerTab(page)).toBeVisible()

  await pickList(page, 'Board games')
  await expect(page).toHaveURL('/tiers/l2')
  await expect(page.getByText('Shared board — you both rank together.')).toBeVisible()
  await expect(partnerTab(page)).toHaveCount(0)
  await expect(page.getByText("Jordan's board — just for looking.")).toHaveCount(0)

  // The shared ranking, not anyone's personal one.
  await expect(tierRow(page, 'S').getByText('Catan')).toBeVisible()
  await openShelf(page, 'unranked')
  await expect(boardShelf(page, 'unranked').getByText('Wingspan')).toBeVisible()
  await expect(boardShelf(page, 'unranked').getByText('Twilight Imperium')).toBeVisible()

  // The flag is editable, and the add hint speaks of one shelf.
  await page.getByRole('button', { name: 'Edit list' }).click()
  await expect(page.getByRole('checkbox', { name: 'Shared board' })).toBeChecked()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: '+ Add game' }).click()
  await expect(page.getByText('New games land on the unranked shelf', { exact: false })).toBeVisible()
})

test('a new list can be created shared from the modal', async ({ page }) => {
  await page.goto('/movies')
  await page.getByRole('button', { name: '+ New list' }).click()
  await page.getByLabel('Name').fill('Cheeses')
  await page.getByLabel('Singular noun').fill('cheese')
  const box = page.getByRole('checkbox', { name: 'Shared board' })
  await expect(box).not.toBeChecked()
  await box.check()
  await expect(page.getByText('one shared board', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Create list' }).click()

  await expect(page).toHaveURL(/\/tiers\//)
  await expect(page.getByText('Shared board — you both rank together.')).toBeVisible()
  await expect(partnerTab(page)).toHaveCount(0)

  // Flip it back to per-person: the toggle returns.
  await page.getByRole('button', { name: 'Edit list' }).click()
  await page.getByRole('checkbox', { name: 'Shared board' }).uncheck()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(partnerTab(page)).toBeVisible()
})

test('create, rename, and delete a custom list', async ({ page }) => {
  await page.goto('/movies')

  // Create → lands on the new empty board, worded from the draft.
  await page.getByRole('button', { name: '+ New list' }).click()
  await expect(page.getByRole('heading', { name: 'New list' })).toBeVisible()
  await page.getByLabel('Name').fill('Bugs')
  await page.getByLabel('Singular noun').fill('bug')
  await page.getByRole('button', { name: 'Create list' }).click()

  await expect(page).toHaveURL(/\/tiers\//)
  await expect(page.getByRole('button', { name: '+ Add bug' })).toBeVisible()

  // Rename → the picker pill follows.
  await page.getByRole('button', { name: 'Edit list' }).click()
  await expect(page.getByRole('heading', { name: 'Edit list' })).toBeVisible()
  await page.getByLabel('Name').fill('Beetles')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('button', { name: /Beetles$/ })).toBeVisible()

  // Delete → the themed confirm modal, then a bounce back to /movies.
  await page.getByRole('button', { name: 'Edit list' }).click()
  await page.getByRole('button', { name: 'Delete list' }).click()
  await expect(page.getByText('Delete the "Beetles" list for both of you?')).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page).toHaveURL('/movies')
  await expect(page.getByRole('button', { name: /Beetles$/ })).toHaveCount(0)
})
