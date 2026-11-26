import type { Recipe } from '../../types'
import { fuzzyMatch } from '../../lib/fuzzy'
import { distinctTagList, tagMatcher } from '../../lib/tags'
import { originOf } from '../../lib/lineage'
import { titleKey } from '../../lib/text'

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

/** The index's three groups, each keeping the order it was given: pinned
 *  first, then everything else, then the hidden drawer. */
export interface RecipeShelves {
  pinned: Recipe[]
  main: Recipe[]
  hidden: Recipe[]
}

export function shelveRecipes(recipes: Recipe[]): RecipeShelves {
  return {
    pinned: recipes.filter((recipe) => recipe.shelf === 'pinned'),
    main: recipes.filter((recipe) => recipe.shelf === ''),
    hidden: recipes.filter((recipe) => recipe.shelf === 'hidden'),
  }
}

/** The card/list metadata line: "Serves 4 · 45 min" (whichever parts exist). */
export function servingsTimeLine(recipe: Pick<Recipe, 'servings' | 'totalTime'>): string {
  const parts: string[] = []
  if (recipe.servings.trim()) parts.push(`Serves ${recipe.servings.trim()}`)
  if (recipe.totalTime.trim()) parts.push(recipe.totalTime.trim())
  return parts.join(' · ')
}

/** The source link's href. People paste bare "smittenkitchen.com/…" URLs, which
 *  an <a> treats as a path on this site — so anything without a scheme gets
 *  https://. Applied at render, so rows saved before this still link right. */
export function sourceHref(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`
}

/** Add or remove one index from a mark list (crossed ingredients / done
 *  steps), keeping it sorted and duplicate-free. */
export function withMark(marks: number[], index: number, marked: boolean): number[] {
  const rest = marks.filter((i) => i !== index)
  return marked ? [...rest, index].sort((a, b) => a - b) : rest
}

/**
 * Carry marks across an edit of the ingredients / steps text. Marks are
 * indices, so a line inserted above would shift them onto the wrong line —
 * instead each mark follows its line's TEXT: the k-th occurrence of a marked
 * line in the old list maps to the k-th occurrence of the same text in the
 * new one (so two identical "salt" lines stay distinct). A marked line that
 * was reworded or removed drops its mark.
 */
export function remapMarks(oldLines: string[], newLines: string[], marks: number[]): number[] {
  const occurrence = (lines: string[], index: number) =>
    lines.slice(0, index).filter((line) => line === lines[index]).length
  const remapped: number[] = []
  for (const index of marks) {
    const line = oldLines[index]
    if (line === undefined) continue
    const k = occurrence(oldLines, index)
    let seen = 0
    const target = newLines.findIndex((candidate) => candidate === line && seen++ === k)
    if (target !== -1) remapped.push(target)
  }
  return remapped.sort((a, b) => a - b)
}

/** The grocery list is one item per line, like the ingredients. */
export const groceryLines = ingredientLines

/** Is `line` flagged as a staple? Matched by text, ignoring case and the
 *  ends' whitespace — so retyping "Salt" as "salt" keeps its flag. */
export function isStapleItem(line: string, stapleItems: string[]): boolean {
  const key = line.trim().toLowerCase()
  return stapleItems.some((item) => item.trim().toLowerCase() === key)
}

/** Flip one line's staple flag. */
export function toggleStapleItem(stapleItems: string[], line: string): string[] {
  return isStapleItem(line, stapleItems)
    ? stapleItems.filter((item) => item.trim().toLowerCase() !== line.trim().toLowerCase())
    : [...stapleItems, line.trim()]
}

/** The staple flags worth saving: those whose line is still on the list,
 *  spelled as the list now spells it, without repeats. */
export function keptStaples(lines: string[], stapleItems: string[]): string[] {
  return [...new Set(lines.filter((line) => isStapleItem(line, stapleItems)))]
}

// --- Pulling recipes from another space ---

/** How a source recipe relates to this space's cookbook:
 *  • 'lineage' — the same recipe (one was pulled from the other, or both from
 *    a common root): it's already here, so the picker disables it.
 *  • 'title'   — a different recipe that happens to share the title: still
 *    pullable, just flagged so nobody duplicates by accident.
 *  • null      — new here. */
export type RecipePullMatch = 'lineage' | 'title' | null

export interface RecipePullChoice {
  recipe: Recipe
  match: RecipePullMatch
}

/** Every source recipe with its match against `target`, A–Z like the index.
 *  Lineage wins over title (a renamed copy is still "already here"). */
export function recipePullChoices(source: Recipe[], target: Recipe[]): RecipePullChoice[] {
  const origins = new Set(target.map(originOf))
  const titles = new Set(target.map((recipe) => titleKey(recipe.title)))
  return sortRecipes(source).map((recipe) => ({
    recipe,
    match: origins.has(originOf(recipe)) ? 'lineage' : titles.has(titleKey(recipe.title)) ? 'title' : null,
  }))
}

/** What a pull inserts for one source recipe: everything written on it
 *  (title, ingredients, steps, source + link, tags, servings, time, notes,
 *  grocery list + staple flags) with the copied photo's URL, the cooking
 *  marks cleared (they're this batch's state, not the recipe's), the shelf
 *  reset to normal, and
 *  `copiedFrom` = the source's ROOT origin (lib/lineage.ts). */
export function cloneRecipe(source: Recipe, imageUrl: string): Omit<Recipe, 'id' | 'createdBy' | 'createdAt'> {
  return {
    title: source.title,
    imageUrl,
    ingredients: source.ingredients,
    steps: source.steps,
    source: source.source,
    sourceUrl: source.sourceUrl,
    tags: [...source.tags],
    servings: source.servings,
    totalTime: source.totalTime,
    notes: source.notes,
    groceryList: source.groceryList,
    stapleItems: [...source.stapleItems],
    crossedIngredients: [],
    doneSteps: [],
    // How often it gets made is this space's call, not the source's.
    shelf: '',
    copiedFrom: originOf(source),
  }
}
