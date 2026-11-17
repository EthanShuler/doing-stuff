import { expect, test } from '@playwright/test'

// Keyless seed mode: there is no account, so both password flows fake
// success. These cover the UI — the gate on /set-password, the shared
// PasswordForm's inline checks, and the account menu's modal. The live
// verifyOtp / updateUser calls can't run here.

test('a set-password link shows the form instead of the app', async ({ page }) => {
  await page.goto('/set-password#token_hash=x')
  await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible()
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  // Not the app shell.
  await expect(page.getByRole('button', { name: 'Account menu' })).toHaveCount(0)
  // Nothing is spent on load: the URL (token included) is untouched.
  await expect(page).toHaveURL(/\/set-password#token_hash=x$/)
})

test('set-password checks length and the match, then sets it', async ({ page }) => {
  await page.goto('/set-password#token_hash=x')
  const password = page.getByLabel('New password', { exact: true })
  const confirm = page.getByLabel('Confirm new password')
  const submit = page.getByRole('button', { name: 'Set password' })

  await password.fill('short')
  await confirm.fill('short')
  await submit.click()
  await expect(page.getByText('Use at least 8 characters')).toBeVisible()

  await password.fill('long enough')
  await confirm.fill('long enougj')
  await submit.click()
  await expect(page.getByText('The passwords don’t match')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible()

  await confirm.fill('long enough')
  // Enter submits too.
  await confirm.press('Enter')
  await expect(page.getByRole('heading', { name: 'Password set' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Password set')
  await page.getByRole('link', { name: 'Go to cajubinile.com' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
})

test('change password from the account menu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Change password' }).click()

  const dialog = page.getByRole('dialog', { name: 'Change password' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('New password', { exact: true }).fill('a new password')
  await dialog.getByLabel('Confirm new password').fill('a different one')
  await dialog.getByRole('button', { name: 'Change password' }).click()
  await expect(dialog.getByText('The passwords don’t match')).toBeVisible()

  await dialog.getByLabel('Confirm new password').fill('a new password')
  await dialog.getByRole('button', { name: 'Change password' }).click()
  await expect(dialog.getByRole('status')).toHaveText('✓ Password changed.')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toHaveCount(0)

  // Reopening starts blank.
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Change password' }).click()
  await expect(dialog.getByLabel('New password', { exact: true })).toHaveValue('')

  // Cancel closes it.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
})
