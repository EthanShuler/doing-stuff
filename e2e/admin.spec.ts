import { expect, test, type Page } from '@playwright/test'
import { pickSegment } from './helpers'

// The admin page in keyless seed mode. The seed viewer is the admin; the
// seed accounts are Avery + Jordan (both spaces) and Sam (no space, no
// password). Seed state is in-memory per page load, so each test starts clean.

const accountMenu = (page: Page) => page.getByRole('button', { name: 'Account menu' })

async function openAdmin(page: Page) {
  await accountMenu(page).click()
  await page.getByRole('menuitem', { name: 'Admin' }).click()
  await expect(page).toHaveURL('/admin')
}

test('People lists the seed accounts with their state in words', async ({ page }) => {
  await page.goto('/')
  await openAdmin(page)
  const avery = page.getByRole('button', { name: /^Avery/ })
  await expect(avery).toContainText('Admin')
  await expect(avery).toContainText('Our city, together')
  await expect(page.getByRole('button', { name: /^Jordan/ })).toContainText('jordan@example.com')
  const sam = page.getByRole('button', { name: /^Sam/ })
  await expect(sam).toContainText('No password yet')
  await expect(sam).toContainText('No spaces')
  await expect(sam).toContainText('last in: Never')
  await expect(page.getByText('Delete spaces and accounts in Supabase for now.')).toBeVisible()
})

test('creating an account ends on a copyable set-password link', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: '+ New account' }).click()
  const dialog = page.getByRole('dialog', { name: 'New account' })
  await dialog.getByLabel('Email').fill('casey@example.com')
  await dialog.getByLabel('Display name').fill('Casey')
  await dialog.getByLabel('Friends').check()
  await dialog.getByRole('button', { name: 'Create account' }).click()

  const ready = page.getByRole('dialog', { name: 'Link ready' })
  await expect(ready).toBeVisible()
  await expect(ready.getByLabel('Set-password link')).toHaveValue(/\/set-password#token_hash=seed-token-\d+$/)
  await expect(ready.getByRole('button', { name: 'Copy link' })).toBeVisible()
  await expect(ready).toContainText('Don’t open it yourself')
  await ready.getByRole('button', { name: 'Done' }).click()

  // The new person is listed, in Friends, without a password yet.
  const casey = page.getByRole('button', { name: /^Casey/ })
  await expect(casey).toContainText('No password yet')
  await expect(casey).toContainText('Friends')
})

test('a bad email can’t be submitted', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: '+ New account' }).click()
  const dialog = page.getByRole('dialog', { name: 'New account' })
  await dialog.getByLabel('Email').fill('not-an-email')
  await expect(dialog.getByRole('button', { name: 'Create account' })).toBeDisabled()
})

test('a person’s row edits their name and spaces, and hands out a fresh link', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: /^Sam/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Display name').fill('Samantha')
  await dialog.getByLabel('Our city, together').check()
  await dialog.getByRole('button', { name: 'Copy set-password link' }).click()
  await expect(dialog.getByLabel('Set-password link')).toHaveValue(/\/set-password#token_hash=seed-token-/)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: /^Samantha/ })).toContainText('Our city, together')
})

test('a name set for one space shows in that space only', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: /^Riley/ }).click()
  const dialog = page.getByRole('dialog')
  // Riley is only in Friends, so that's the only per-space field.
  await expect(dialog.getByLabel('Name in Our city, together')).toHaveCount(0)
  await dialog.getByLabel('Name in Friends').fill('Ri')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  // People keeps the display name; the Friends row uses the space's name.
  await expect(page.getByRole('button', { name: /^Riley/ })).toBeVisible()
  await pickSegment(page, 'Spaces')
  await expect(page.getByRole('button', { name: /^Friends/ })).toContainText('Avery, Jordan, Ri')

  // The form reopens with it, and Friends' own pages use it.
  await pickSegment(page, 'People')
  await page.getByRole('button', { name: /^Riley/ }).click()
  await expect(dialog.getByLabel('Name in Friends')).toHaveValue('Ri')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await accountMenu(page).click()
  await page.getByRole('menuitem', { name: 'Friends' }).click()
  await page.getByRole('link', { name: /Parks/ }).first().click()
  await expect(page.getByRole('radiogroup', { name: 'Whose map' }).getByText('Ri', { exact: true })).toBeVisible()
})

test('a new space with two features is switchable, and editing it updates the nav live', async ({ page }) => {
  await page.goto('/')
  await openAdmin(page)
  await pickSegment(page, 'Spaces')
  await page.getByRole('button', { name: '+ New space' }).click()

  const dialog = page.getByRole('dialog', { name: 'New space' })
  await dialog.getByLabel('Name').fill('Book club')
  // Unticking "All" starts from every feature ticked; keep only Lists + Recipes.
  await dialog.getByLabel('All features, including future ones').uncheck()
  for (const label of ['Doing Stuff', 'Tier Lists', 'Parks', 'Spoons', 'Little Guys', 'Alignment', 'Music Practice', 'Seasons']) {
    await dialog.getByRole('checkbox', { name: label, exact: true }).uncheck()
  }
  await dialog.getByRole('combobox', { name: 'Members' }).click()
  await page.locator('[role="option"]:visible', { hasText: 'Avery' }).click()
  await dialog.getByLabel('Name').click() // close the dropdown
  await dialog.getByRole('button', { name: 'Create space' }).click()
  await expect(dialog).toBeHidden()

  const row = page.getByRole('button', { name: /^Book club/ })
  await expect(row).toContainText('Avery')
  await expect(row).toContainText('2 features')

  // The admin's own switcher has it — no reload.
  await accountMenu(page).click()
  await page.getByRole('menuitem', { name: 'Book club' }).click()
  await expect(accountMenu(page)).toHaveText(/Book club/)
  await expect(page).toHaveURL('/')
  const header = page.locator('header')
  await expect(header.getByText('Lists', { exact: true })).toBeVisible()
  await expect(header.getByText('Recipes', { exact: true })).toBeVisible()
  await expect(header.getByText('Seasons', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Features' }).getByRole('link')).toHaveCount(2)

  // Turn Seasons on for the space we're in → the nav follows without a reload.
  await openAdmin(page)
  await pickSegment(page, 'Spaces')
  await page.getByRole('button', { name: /^Book club/ }).click()
  const edit = page.getByRole('dialog', { name: 'Edit space' })
  await expect(edit.getByLabel('All features, including future ones')).not.toBeChecked()
  await edit.getByRole('checkbox', { name: 'Seasons', exact: true }).check()
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(edit).toBeHidden()
  await expect(header.getByText('Seasons', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Book club/ })).toContainText('3 features')
})
