import type { Locator, Page } from '@playwright/test'

// Mantine-specific interaction helpers. The gotchas these encode:
//
// - Mantine Select is a combobox, not a native <select>: click the visible
//   input, then pick from [role="option"]:visible. The :visible matters —
//   closed Selects elsewhere on the page keep hidden option nodes in the DOM.
// - Mantine inputs ship with hidden siblings, so target by placeholder/label
//   or filter with :visible.
// - Rating stars are labels that need a forced click.

// - SegmentedControl renders hidden radio inputs — getByRole('radio').click()
//   times out. Click the visible label instead.

/** Click a Mantine SegmentedControl segment by its exact label. */
export async function pickSegment(page: Page, label: string) {
  const exact = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
  await page.locator('.mantine-SegmentedControl-label').filter({ hasText: exact }).click()
}

/** Pick an option from a Mantine Select opened by clicking `input`. */
export async function pickSelectOption(page: Page, input: Locator, option: string) {
  await input.click()
  await page.locator('[role="option"]:visible', { hasText: option }).first().click()
}

/** Set a Mantine Rating to `stars` (1–5) within `scope` (e.g. the modal). */
export async function setRating(scope: Locator, stars: number) {
  await scope.locator('.mantine-Rating-root label').nth(stars - 1).click({ force: true })
}

/** The tier board's row for one tier ('S'…'F') — via BoardView's data hook. */
export function tierRow(page: Page, tier: string): Locator {
  return page.locator(`[data-board-row="${tier}"]`)
}

/** The board's 'unranked' or 'unwatched' (Unwatched/Unread) shelf. */
export function boardShelf(page: Page, shelf: 'unranked' | 'unwatched'): Locator {
  return page.locator(`[data-board-shelf="${shelf}"]`)
}
