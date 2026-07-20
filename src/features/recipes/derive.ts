import type { Recipe } from '../../types'
import { fuzzyMatch } from '../../lib/fuzzy'
import { distinctTagList, tagMatcher } from '../../lib/tags'

// Pure data-shaping for the recipes feature: parsing the light structure out
// of the plain-text fields, plus the index's sort / search / tag filter.
// No React in here — covered by derive.test.ts.

/** Ingredients are one per line: split, trim, drop blanks. */
export function ingredientLines(ingredients: string): string[] {
  return ingredients
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Steps are separated by blank lines: each non-empty block is one numbered
 * step (single newlines inside a block are kept — render with pre-line — so
 * a sub-list survives). A pasted recipe with no blank lines is one step.
 */
export function stepBlocks(steps: string): string[] {
  return steps
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

/** Alphabetical like a real cookbook (case/accent-insensitive), createdAt
 *  tiebreak so same-titled rows keep a stable order. */
export function sortRecipes(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort(
    (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) ||
      a.createdAt.localeCompare(b.createdAt),
  )
}

/** Every tag in use, deduped case-insensitively (first spelling seen wins)
 *  and sorted alphabetically. Drives the filter pills and the modal's
 *  suggestions. */
export function distinctRecipeTags(recipes: Recipe[]): string[] {
  return distinctTagList(recipes.map((recipe) => recipe.tags))
}

/**
 * The index filter: fuzzy title search plus the tri-state tag pills (shared
 * semantics — see tagMatcher in src/lib/tags.ts).
 */
export function filterRecipes(
  recipes: Recipe[],
  search: string,
  included: string[],
  excluded: string[],
): Recipe[] {
  let result = recipes
  if (search.trim()) {
    result = result.filter((recipe) => fuzzyMatch(recipe.title, search))
  }
  if (included.length === 0 && excluded.length === 0) return result
  const matches = tagMatcher(included, excluded)
  return result.filter((recipe) => matches(recipe.tags))
}

/** The card/list metadata line: "Serves 4 · 45 min" (whichever parts exist). */
export function servingsTimeLine(recipe: Pick<Recipe, 'servings' | 'totalTime'>): string {
  const parts: string[] = []
  if (recipe.servings.trim()) parts.push(`Serves ${recipe.servings.trim()}`)
  if (recipe.totalTime.trim()) parts.push(recipe.totalTime.trim())
  return parts.join(' · ')
}
