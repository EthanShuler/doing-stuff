import { expect, test } from '@playwright/test'
import { pickSegment, pickSelectOption } from './helpers'

// The national-parks tracker (keyless seed mode). Seed facts these lean on:
// Avery (u1) has been to 5 parks, Jordan (u2) to 6, 3 of them on shared trips
// (Yosemite, Zion, Haleakalā); Great Smoky Mountains is the both-but-
// separately case (one flagged row); Yosemite has two visits; the Grand
// Canyon visit is undated. No drag involved, so everything is automatable.

test('map shows all 63 pins with the person legend and stats', async ({ page }) => {
  await page.goto('/parks')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(63)
  // The scoreboard derives from the seed visits.
  await expect(page.getByText('Avery 5/63')).toBeVisible()
  await expect(page.getByText('Jordan 6/63')).toBeVisible()
  await expect(page.getByText('Together 3/63')).toBeVisible()
  // The legend names the split "both, separately" state.
  await expect(page.getByText('Separately', { exact: true })).toBeVisible()
})

test('list groups by region and filters by status', async ({ page }) => {
  await page.goto('/parks')
  await pickSegment(page, 'List')
  await expect(page.getByText('Alaska · 8')).toBeVisible()
  await expect(page.getByText('Yosemite', { exact: true })).toBeVisible()
  // Three shared-trip parks wear the together chip.
  await expect(page.getByText('together', { exact: true })).toHaveCount(3)

  // Unvisited hides every park with a visit, whoever went.
  await page.getByRole('button', { name: 'Unvisited' }).click()
  await expect(page.getByText('Yosemite', { exact: true })).toBeHidden()
  await expect(page.getByText('Denali', { exact: true })).toBeHidden()
  await expect(page.getByText('Arches', { exact: true })).toBeVisible()

  // A member pill shows only their parks.
  await page.getByRole('button', { name: 'Jordan' }).click()
  await expect(page.getByText('Denali', { exact: true })).toBeVisible()
  await expect(page.getByText('Grand Canyon', { exact: true })).toBeHidden()
})

test('park detail modal lists trips and the visit form gates on attendees', async ({ page }) => {
  await page.goto('/parks')
  await pickSegment(page, 'List')
  await page.getByText('Yosemite', { exact: true }).click()

  // Facts (the modal's eyebrow — list rows also say "est.") + both seed trips.
  await expect(page.getByText('Pacific West · CA · est. 1890')).toBeVisible()
  await expect(page.getByText('Aug 14, 2023')).toBeVisible()
  await expect(page.getByText('Avery + Jordan')).toBeVisible()

  // The add form defaults to everyone along; unchecking both blocks saving.
  await page.getByRole('button', { name: '+ Log a visit' }).click()
  const save = page.getByRole('button', { name: 'Log visit', exact: true })
  await expect(save).toBeEnabled()
  await page.getByRole('checkbox', { name: 'Avery' }).uncheck()
  await page.getByRole('checkbox', { name: 'Jordan' }).uncheck()
  await expect(save).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Aug 14, 2023')).toBeVisible()
})

test('separate-visits rows count for each person but not Together', async ({ page }) => {
  await page.goto('/parks')
  await pickSegment(page, 'List')
  // Great Smoky is in both members' totals (5 and 6 include it) yet wears no
  // together chip — its one seed row is flagged separate.
  await page.getByText('Great Smoky Mountains', { exact: true }).click()
  await expect(page.getByText('Avery + Jordan, separately')).toBeVisible()

  // Unflagging it in the edit form promotes the park to a together one.
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('checkbox', { name: 'We went separately (different trips)' }).uncheck()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Together 4/63')).toBeVisible()
})

test('header Log visit flow adds a park and updates the stats', async ({ page }) => {
  await page.goto('/parks')
  await page.getByRole('button', { name: '+ Log visit' }).click()

  // No park picked yet → gated.
  const save = page.getByRole('button', { name: 'Log visit', exact: true })
  await expect(save).toBeDisabled()
  await pickSelectOption(page, page.getByPlaceholder('Pick one of the 63'), 'Acadia · ME')
  await expect(save).toBeEnabled()
  await save.click()

  // Acadia was Jordan-only; a both-attendee trip moves Avery and Together.
  await expect(page.getByText('Avery 6/63')).toBeVisible()
  await expect(page.getByText('Together 4/63')).toBeVisible()
})

test('store survives the map/list toggle', async ({ page }) => {
  await page.goto('/parks')
  await pickSegment(page, 'List')
  await expect(page.getByText('Yosemite', { exact: true })).toBeVisible()
  await pickSegment(page, 'Map')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.getByText('Together 3/63')).toBeVisible()
})
