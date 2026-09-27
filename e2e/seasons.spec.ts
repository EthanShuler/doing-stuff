import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { pickSegment } from './helpers'

// Seed facts these tests lean on (useSeasonStore seed): one season, "Fall
// 2026" 🍂 (id fall-2026), 2026-09-22 → 2026-11-15, 44 items — 38 open with
// no day, 5 planned/fixed, 1 done (ren faire). The Twin Cities Book Festival
// is fixed on Sat 11/7; color walk is due by 10/18.
//
// The planner is all about "today", so every test pins the clock to Saturday
// 2026-09-26 (setFixedTime freezes Date only — timers still run), keeping the
// weekend cards and chips the same whatever day the suite runs.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-26T12:00:00'))
})

/** The weekend card's column for one ISO day. */
const day = (page: Page, iso: string) => page.locator(`[data-day="${iso}"]`)

test('/seasons forwards to the current season’s bucket list', async ({ page }) => {
  await page.goto('/seasons')
  await expect(page).toHaveURL('/seasons/fall-2026')
  await expect(page.getByText('pumpkin bread')).toBeVisible()
  await expect(page.getByText('38 to plan · 5 planned · 1 done')).toBeVisible()
  // Sub-options render under their parent.
  await expect(page.getByText('Sociable Cider Werks')).toBeVisible()
})

test('an unknown season id falls back to the current season', async ({ page }) => {
  await page.goto('/seasons/nope')
  await expect(page).toHaveURL('/seasons/fall-2026')
})

test('the header nav lands on Seasons', async ({ page }) => {
  await page.goto('/')
  await page.locator('header').getByText('Seasons', { exact: true }).click()
  await expect(page).toHaveURL('/seasons/fall-2026')
})

test('the Plan screen counts weekends and lays out the days', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  await pickSegment(page, 'Plan')
  // Sep 25–27 through Nov 13–15.
  await expect(page.getByRole('heading', { name: '8 weekends left' })).toBeVisible()
  await expect(day(page, '2026-09-26').getByText('pumpkin bread')).toBeVisible()
  await expect(day(page, '2026-11-07').getByText('Twin Cities Book Festival')).toBeVisible()
  // Unplanned tray: soonest deadline first.
  const tray = page.locator('[data-tray="unplanned"]')
  await expect(tray.getByRole('button').first()).toContainText('color walk')
})

test('plan an item from the tray via the day chips, then unplan it', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  await pickSegment(page, 'Plan')

  await page.locator('[data-tray="unplanned"]').getByRole('button', { name: 'Plan “color walk”' }).click()
  const popover = page.getByRole('dialog', { name: 'Plan “color walk”' })
  await popover.getByRole('button', { name: 'Sat 10/3', exact: true }).click()
  await expect(popover).toBeHidden()

  await expect(day(page, '2026-10-03').getByText('color walk')).toBeVisible()
  await expect(page.locator('[data-tray="unplanned"]').getByText('color walk')).toHaveCount(0)

  // The bucket list shows the new day on its chip — same store.
  await pickSegment(page, 'Bucket list')
  await expect(page.getByRole('button', { name: 'Sat 10/3 — plan “color walk”' })).toBeVisible()

  // And unplanning from the chip puts it back.
  await page.getByRole('button', { name: 'Sat 10/3 — plan “color walk”' }).click()
  await page.getByRole('dialog', { name: 'Plan “color walk”' }).getByRole('button', { name: 'Unplan' }).click()
  await expect(page.getByRole('button', { name: 'by 10/18 — plan “color walk”' })).toBeVisible()
})

test('a fixed-date item can’t be re-planned', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  await pickSegment(page, 'Plan')
  await day(page, '2026-11-07').getByRole('button', { name: 'Plan “Twin Cities Book Festival”' }).click()
  const popover = page.getByRole('dialog', { name: 'Plan “Twin Cities Book Festival”' })
  await expect(popover.getByText(/can’t be moved/)).toBeVisible()
  await expect(popover.getByRole('button', { name: 'Sat 10/3', exact: true })).toHaveCount(0)
})

test('quick-add on a day files it under Unsorted, planned there', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  await pickSegment(page, 'Plan')
  const add = page.getByLabel('Add to Sun 10/4')
  await add.fill('bike the river road')
  await add.press('Enter')
  await expect(add).toHaveValue('')
  await expect(day(page, '2026-10-04').getByText('bike the river road')).toBeVisible()

  await pickSegment(page, 'Bucket list')
  await expect(page.getByRole('button', { name: 'Sun 10/4 — plan “bike the river road”' })).toBeVisible()
})

test('quick-add in a subsection and check it off', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  const add = page.getByLabel('Add to Food › Baked goods')
  await add.fill('snickerdoodles')
  await add.press('Enter')
  await expect(page.getByRole('button', { name: 'snickerdoodles', exact: true })).toBeVisible()

  await page.getByRole('checkbox', { name: 'Mark “snickerdoodles” done' }).click()
  await expect(page.getByRole('button', { name: 'snickerdoodles', exact: true })).toHaveCSS(
    'text-decoration-line',
    'line-through',
  )
  await expect(page.getByText('38 to plan · 5 planned · 2 done')).toBeVisible()
})

test('the status pills filter the list', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  await page.getByRole('button', { name: 'Done 1' }).click()
  await expect(page.getByText('ren faire')).toBeVisible()
  await expect(page.getByText('pumpkin bread')).toHaveCount(0)
  await page.getByRole('button', { name: 'Any status' }).click()
  await expect(page.getByText('pumpkin bread')).toBeVisible()
})

test('edit an item and duplicate it', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  await page.getByRole('button', { name: 'pumpkin bread', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Edit item/ })).toBeVisible()
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByText('This is the new copy')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  // Original keeps its day; the copy has none.
  await expect(page.getByRole('button', { name: 'pumpkin bread', exact: true })).toHaveCount(2)
  await expect(page.getByText('39 to plan · 5 planned · 1 done')).toBeVisible()
})

test('create a season copying Fall 2026, then delete it', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  await page.getByRole('button', { name: '+ New season' }).click()
  await expect(page.getByRole('heading', { name: 'New season' })).toBeVisible()
  await page.getByLabel('Name').fill('Fall 2027')
  await page.getByLabel('Starts').fill('2027-09-21')
  await page.getByLabel('Ends').fill('2027-11-14')
  // Defaults to copying the season you were on.
  await expect(page.getByRole('combobox', { name: 'Copy items from' })).toHaveValue('🍂 Fall 2026')
  await page.getByRole('button', { name: 'Create season' }).click()

  await expect(page).toHaveURL(/\/seasons\/(?!fall-2026)/)
  await expect(page.getByRole('button', { name: /Fall 2027$/ })).toBeVisible()
  // Every item came over; every date stayed behind.
  await expect(page.getByText('44 to plan · 0 planned · 0 done')).toBeVisible()
  await expect(page.getByText('Sweetland')).toBeVisible()

  await page.getByRole('button', { name: 'Edit season' }).click()
  await page.getByRole('button', { name: 'Delete season' }).click()
  await expect(page.getByText('Delete "Fall 2027" for both of you?')).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page).toHaveURL('/seasons/fall-2026')
  await expect(page.getByRole('button', { name: /Fall 2027$/ })).toHaveCount(0)
})
