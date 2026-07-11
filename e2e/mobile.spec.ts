import { expect, test } from '@playwright/test'

// Runs under the 'mobile' project (390×844 viewport — see playwright.config).
// Gotcha: AppShell.Navbar stays in the DOM when collapsed, so "is the drawer
// open" must be asked as toBeInViewport, not isVisible.

test('burger opens the drawer; navigating closes it', async ({ page }) => {
  await page.goto('/')
  const drawerLink = page.locator('.mantine-AppShell-navbar').getByText('Movies', { exact: true })
  await expect(drawerLink).not.toBeInViewport()

  await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await expect(drawerLink).toBeInViewport()

  await drawerLink.click()
  await expect(page).toHaveURL('/movies')
  await expect(drawerLink).not.toBeInViewport()
  await expect(page.getByText('Spirited Away')).toBeVisible()
})
