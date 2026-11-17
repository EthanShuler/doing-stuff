import { expect, test } from '@playwright/test'

// Keyless seed mode ships two spaces (src/data/seedSpaces.ts):
// "Our city, together" (null = every feature) and "Friends" (Tier Lists,
// Lists, Recipes, Seasons). The seed viewer is the admin.

const accountMenu = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Account menu' })

test('switching spaces swaps the nav and keeps the same feature', async ({ page }) => {
  await page.goto('/recipes')
  const header = page.locator('header')
  await expect(header.getByText('Spoons', { exact: true })).toBeVisible()
  await expect(accountMenu(page)).toHaveText(/Our city, together/)

  await accountMenu(page).click()
  // The current space carries the check.
  await expect(page.getByRole('menuitem', { name: /Our city, together/ })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('menuitem', { name: 'Friends' }).click()

  await expect(page).toHaveURL('/recipes')
  await expect(accountMenu(page)).toHaveText(/Friends/)
  await expect(header.getByText('Recipes', { exact: true })).toBeVisible()
  await expect(header.getByText('Spoons', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ Add recipe' })).toBeVisible()

  // The hub lists only Friends' four features.
  await header.getByText('cajubinile.com').click()
  await expect(page.getByRole('navigation', { name: 'Features' }).getByRole('link')).toHaveCount(4)
})

test('switching drops an id-bearing sub-path for the feature root', async ({ page }) => {
  await page.goto('/seasons/fall-2026')
  await accountMenu(page).click()
  await page.getByRole('menuitem', { name: 'Friends' }).click()
  // Lands on /seasons, which then forwards to the (seed) current season.
  await expect(page).toHaveURL(/\/seasons/)
  await expect(accountMenu(page)).toHaveText(/Friends/)
})

test('switching into a space without the current feature lands on the hub', async ({ page }) => {
  await page.goto('/spoons')
  await accountMenu(page).click()
  await page.getByRole('menuitem', { name: 'Friends' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('navigation', { name: 'Features' })).toBeVisible()
})

test('a disabled feature’s route bounces to the hub, and the pick survives a reload', async ({ page }) => {
  await page.goto('/')
  await accountMenu(page).click()
  await page.getByRole('menuitem', { name: 'Friends' }).click()
  await expect(accountMenu(page)).toHaveText(/Friends/)

  // A hard load re-reads the remembered space (localStorage) …
  await page.goto('/spoons')
  await expect(page).toHaveURL('/')
  await expect(accountMenu(page)).toHaveText(/Friends/)
  await page.goto('/log')
  await expect(page).toHaveURL('/')

  // … and switching back restores everything.
  await accountMenu(page).click()
  await page.getByRole('menuitem', { name: 'Our city, together' }).click()
  await page.goto('/spoons')
  await expect(page).toHaveURL('/spoons')
  await expect(page.getByText('Eiffel Tower')).toBeVisible()
})

test('the Admin menu item opens /admin', async ({ page }) => {
  await page.goto('/movies')
  await accountMenu(page).click()
  await page.getByRole('menuitem', { name: 'Admin' }).click()
  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('button', { name: '+ New account' })).toBeVisible()
})

test('seed mode has no Sign out (nothing to sign out of)', async ({ page }) => {
  await page.goto('/')
  await accountMenu(page).click()
  await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toHaveCount(0)
})
