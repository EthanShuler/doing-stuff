import { expect, test } from '@playwright/test'
import { pickSegment } from './helpers'

// The spoon collection (keyless seed mode). Drag isn't involved here, so the
// whole feature is automatable: grid, screen toggle, modal gating, and the
// same-place fan-out (two Paris spoons = two distinct pins).

test('collection grid shows seed spoons sorted with undated last', async ({ page }) => {
  await page.goto('/spoons')
  await expect(page.getByText('Little gold Louvre')).toBeVisible()
  await expect(page.getByText('Paris, France').first()).toBeVisible()
  // Undated spoons trail the dated ones (DOM order = innerText order).
  const body = await page.locator('body').innerText()
  expect(body.indexOf('Little gold Louvre')).toBeLessThan(body.indexOf('Mystery spoon'))
})

test('map screen renders Leaflet with a pin per locatable spoon', async ({ page }) => {
  await page.goto('/spoons')
  await pickSegment(page, 'Map')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  // 4 locatable seed spoons (the Mystery spoon has no coords) — the two Paris
  // spoons fan out into separate pins rather than stacking.
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(4)
})

test('add-spoon modal gates save on a name and edits round-trip', async ({ page }) => {
  await page.goto('/spoons')
  await page.getByRole('button', { name: '+ Add spoon' }).click()
  const save = page.getByRole('button', { name: 'Add spoon', exact: true })
  await expect(save).toBeDisabled()
  await page.getByLabel('Name').fill('Space Needle')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByText('Space Needle')).toBeVisible()

  // Click the new card to edit; the modal opens prefilled.
  await page.getByText('Space Needle').click()
  await expect(page.getByLabel('Name')).toHaveValue('Space Needle')
  await page.getByRole('button', { name: 'Cancel' }).click()
})

test('store survives the list/map toggle', async ({ page }) => {
  await page.goto('/spoons')
  await pickSegment(page, 'Map')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await pickSegment(page, 'Collection')
  await expect(page.getByText('Eiffel Tower')).toBeVisible()
})
