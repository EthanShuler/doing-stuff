import { expect, test } from '@playwright/test'

// Every route hard-loads directly (Cloudflare Pages serves index.html as the
// SPA fallback, so deep links must work with no redirect help). Content
// assertions come from the keyless seed data.

test('/ renders the Log dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Riverside picnic')).toBeVisible()
  await expect(page.getByRole('button', { name: '+ New entry' }).first()).toBeVisible()
})

test('/wishlist renders the wishlist', async ({ page }) => {
  await page.goto('/wishlist')
  await expect(page.getByText('Sunrise hike up Eagle Ridge')).toBeVisible()
})

test('/map renders the Leaflet map', async ({ page }) => {
  await page.goto('/map')
  await expect(page.locator('.leaflet-container')).toBeVisible()
})

test('/calendar renders the month grid', async ({ page }) => {
  await page.goto('/calendar')
  // Weekday headers are the stable part of the grid regardless of month.
  await expect(page.getByText('Mon', { exact: true })).toBeVisible()
  await expect(page.getByText('Sun', { exact: true })).toBeVisible()
})

test('/movies renders the movie board', async ({ page }) => {
  await page.goto('/movies')
  await expect(page.getByText('Spirited Away')).toBeVisible()
})

test('/tv renders the TV board', async ({ page }) => {
  await page.goto('/tv')
  await expect(page.getByText('Severance')).toBeVisible()
})

test('/books renders the book board', async ({ page }) => {
  await page.goto('/books')
  await expect(page.getByText('Piranesi')).toBeVisible()
})

test('/ice-cream renders the ice cream board', async ({ page }) => {
  await page.goto('/ice-cream')
  await expect(page.getByText('Mint chocolate chip')).toBeVisible()
})

test('/spoons renders the spoon collection', async ({ page }) => {
  await page.goto('/spoons')
  await expect(page.getByText('Eiffel Tower')).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Add spoon' })).toBeVisible()
})

test('/parks renders the park tracker map', async ({ page }) => {
  await page.goto('/parks')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Log visit' })).toBeVisible()
})

test('/music-practice renders the bassoon wheel', async ({ page }) => {
  await page.goto('/music-practice')
  await expect(page.getByText('Circle of Fifths')).toBeVisible()
  await expect(page.getByRole('button', { name: /log today|update today|logged today/i })).toBeVisible()
})

test('placeholder routes render ComingSoon', async ({ page }) => {
  // exact — the header nav's "French Toast" button would match a loose search
  await page.goto('/french-toast')
  await expect(page.getByText('French toast', { exact: true })).toBeVisible()
})

test('unknown paths redirect to /', async ({ page }) => {
  await page.goto('/definitely-not-a-route')
  await expect(page).toHaveURL('/')
  await expect(page.getByText('Riverside picnic')).toBeVisible()
})
