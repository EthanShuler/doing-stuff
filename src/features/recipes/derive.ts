import type { Recipe } from '../../types'
import { fuzzyMatch } from '../../lib/fuzzy'

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

const tagKey = (tag: string) => tag.trim().toLowerCase()

/** Every tag in use, deduped case-insensitively (first spelling seen wins)
 *  and sorted alphabetically. Drives the filter pills and the modal's
 *  suggestions. */
export function distinctRecipeTags(recipes: Recipe[]): string[] {
  const byKey = new Map<string, string>()
  for (const recipe of recipes) {
    for (const tag of recipe.tags) {
      const key = tagKey(tag)
      if (key && !byKey.has(key)) byKey.set(key, tag.trim())
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * The index filter: fuzzy title search plus the tri-state tag pills (same
 * semantics as the tier boards — includes are OR and widen, an excluded tag
 * always hides its recipes, untagged recipes survive an exclude-only filter
 * but not an include filter).
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
  const wanted = new Set(included.map(tagKey))
  const banned = new Set(excluded.map(tagKey))
  return result.filter((recipe) => {
    if (recipe.tags.some((tag) => banned.has(tagKey(tag)))) return false
    return wanted.size === 0 || recipe.tags.some((tag) => wanted.has(tagKey(tag)))
  })
}

/** The card/list metadata line: "Serves 4 · 45 min" (whichever parts exist). */
export function servingsTimeLine(recipe: Pick<Recipe, 'servings' | 'totalTime'>): string {
  const parts: string[] = []
  if (recipe.servings.trim()) parts.push(`Serves ${recipe.servings.trim()}`)
  if (recipe.totalTime.trim()) parts.push(recipe.totalTime.trim())
  return parts.join(' · ')
}
