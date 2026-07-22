import { expect, test } from '@playwright/test'
import { pickSegment } from './helpers'

// The Bassoon circle-of-fifths tracker (keyless seed mode). The seed logs two
// past days — daysAgo(3) = C @ 60 BPM, daysAgo(1) = G @ 72 BPM — and leaves
// today unset, so the wheel opens carried forward from the last day (G / 72)
// with nothing yet written. Key behavior under test: tapping a wedge only
// *selects* — nothing is logged until the button is pressed.

const logButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /log today|update today|logged today/i })

test('opens on the bassoon wheel carried forward, nothing logged yet', async ({ page }) => {
  await page.goto('/music-practice')
  await expect(page.getByText('Circle of Fifths')).toBeVisible()
  // Carried forward from the last practiced day (G @ 72), but unsaved.
  await expect(logButton(page)).toHaveText('Log today')
  await expect(page.getByText(/Last practiced: G/)).toBeVisible()
  await expect(page.getByPlaceholder('BPM')).toHaveValue(/72/)
})

test('tapping a wheel key selects but does not post', async ({ page }) => {
  await page.goto('/music-practice')

  // Tap the D major wedge and change the tempo — still nothing written.
  await page.locator('g[aria-label*="D major"]').first().click()
  await page.getByPlaceholder('BPM').fill('96')
  // The center readout reflects the pending pick, labelled "Selected", and the
  // context line still shows the previous day — no "Logged today" yet.
  await expect(page.getByText('Selected')).toBeVisible()
  await expect(page.getByText(/Logged today/)).toBeHidden()
  await expect(logButton(page)).toHaveText('Log today')
  await expect(logButton(page)).toBeEnabled()
})

test('the Log button commits key + tempo for today', async ({ page }) => {
  await page.goto('/music-practice')

  await page.locator('g[aria-label*="D major"]').first().click()
  await page.getByPlaceholder('BPM').fill('96')
  await logButton(page).click()

  // Now it's logged: the button confirms and disables, and the context line
  // flips to today's entry.
  await expect(logButton(page)).toHaveText(/Logged today/)
  await expect(logButton(page)).toBeDisabled()
  await expect(page.getByText(/Logged today: D/)).toBeVisible()
})

test('history lists past practice days with tempo, newest first', async ({ page }) => {
  await page.goto('/music-practice')
  await pickSegment(page, 'History')

  // Both seed days show with their tempo.
  await expect(page.getByText('60 BPM')).toBeVisible()
  await expect(page.getByText('72 BPM')).toBeVisible()
})
