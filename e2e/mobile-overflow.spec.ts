import { expect, test } from '@playwright/test'

// Runs under the 'mobile' project (390×844 — see playwright.config; the file
// name has to contain "mobile" to match its testMatch).
//
// Nothing on a phone should scroll sideways: a single too-wide row (a nav that
// won't collapse, a nowrap control bar, a fixed-width modal) pushes the whole
// document out and is easy to reintroduce. One assertion per route catches it.

const ROUTES = [
  '/',
  '/wishlist',
  '/map',
  '/calendar',
  '/movies',
  '/tv',
  '/books',
  '/ice-cream',
  '/parks',
  '/spoons',
  '/little-guys',
  '/recipes',
  '/music-practice',
]

/** How far the document overflows the viewport, in CSS px (0 = it doesn't).
 *  Evaluated from a string because the e2e tsconfig has no DOM lib. */
async function overflow(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate<number>('document.documentElement.scrollWidth - window.innerWidth')
}

for (const route of ROUTES) {
  test(`${route} doesn't scroll sideways at 390px`, async ({ page }) => {
    await page.goto(route)
    // Let the lazy route chunk (and any map) settle before measuring.
    await page.waitForLoadState('networkidle')
    expect(await overflow(page)).toBeLessThanOrEqual(0)
  })
}

test('an open modal doesn\'t scroll the page sideways at 390px', async ({ page }) => {
  await page.goto('/spoons')
  await page.getByRole('button', { name: '+ Add spoon' }).click()
  await expect(page.getByRole('heading', { name: 'Add a spoon' })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)
})
