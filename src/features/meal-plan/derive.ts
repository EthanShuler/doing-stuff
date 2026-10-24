import type { GroceryStaple, MealPlanDay, Recipe } from '../../types'
import { formatDate, isoDate } from '../../lib/format'
import { ingredientLines } from '../recipes/derive'

// Pure data-shaping for the meal plan: week math, day labels, the leftovers
// picker, and the grocery step's per-recipe ingredient checklist. No React in
// here — covered by derive.test.ts.
//
// Date math is local-day arithmetic on ISO strings through UTC day counts
// (never toISOString on a local Date), so it's DST-safe like the seasons one.

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toUtc = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const fromUtc = (date: Date): string => isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())

/** `iso` moved by `n` days (negative = earlier). */
export function addDays(iso: string, n: number): string {
  const date = toUtc(iso)
  date.setUTCDate(date.getUTCDate() + n)
  return fromUtc(date)
}

/** The Sunday a meal-plan week starts on, for the week containing `iso`. */
export function weekStart(iso: string): string {
  return addDays(iso, -toUtc(iso).getUTCDay())
}

/** The seven days (Sun → Sat) of the week starting `start`. */
export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** "Oct 25 – Oct 31" — the week heading. */
export function weekLabel(start: string): string {
  return `${formatDate(start)} – ${formatDate(addDays(start, 6))}`
}

/** "Sun" for a date. */
export function dayName(iso: string): string {
  return DAY_NAMES[toUtc(iso).getUTCDay()]
}

/** Rows keyed by their date (one row per day). */
export function daysByDate(days: MealPlanDay[]): Map<string, MealPlanDay> {
  return new Map(days.map((d) => [d.day, d]))
}

/** How many of the week's seven days have something planned. */
export function plannedCount(days: MealPlanDay[], week: string[]): number {
  const byDate = daysByDate(days)
  return week.filter((d) => byDate.has(d)).length
}

/** The recipe a recipe day cooks, or null (not a recipe day, or the recipe
 *  was deleted). */
export function recipeOf(day: MealPlanDay, recipes: Recipe[]): Recipe | null {
  if (day.kind !== 'recipe' || !day.recipeId) return null
  return recipes.find((r) => r.id === day.recipeId) ?? null
}

/** What leftovers can be of: the recipe days in the 7 days before `date`
 *  (so Sunday can eat last Saturday's cook), most recent first. */
export function leftoverSources(days: MealPlanDay[], recipes: Recipe[], date: string): MealPlanDay[] {
  const from = addDays(date, -7)
  return days
    .filter((d) => d.day < date && d.day >= from && recipeOf(d, recipes) !== null)
    .sort((a, b) => b.day.localeCompare(a.day))
}

/** The day row's display line: the recipe title, the free text, or
 *  "Leftovers · Shakshuka (Sun)". */
export function mealLabel(day: MealPlanDay, recipes: Recipe[], days: MealPlanDay[]): string {
  if (day.kind === 'text') return day.text
  if (day.kind === 'recipe') return recipeOf(day, recipes)?.title ?? 'Deleted recipe'
  const source = day.leftoversOf ? days.find((d) => d.id === day.leftoversOf) : undefined
  const recipe = source ? recipeOf(source, recipes) : null
  return recipe && source ? `Leftovers · ${recipe.title} (${dayName(source.day)})` : 'Leftovers'
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Does an ingredient line mention a staple? Whole words, any case — so
 *  "salt" matches "salt for the pasta water" but not "unsalted butter". */
export function isStaple(line: string, staples: GroceryStaple[]): boolean {
  return staples.some((staple) => {
    const name = staple.name.trim()
    return name !== '' && new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(line)
  })
}

export interface GroceryLine {
  /** Stable within the step: `${dayId}:${index}`. */
  key: string
  text: string
  /** Mentions a pantry staple → starts unchecked. */
  staple: boolean
  /** Already sent to the Groceries list from this day → starts unchecked. */
  sent: boolean
}

export interface GroceryGroup {
  day: MealPlanDay
  recipe: Recipe
  lines: GroceryLine[]
}

/** The grocery step's checklist: one group per recipe day of the week, in
 *  day order, each with its recipe's ingredient lines. Leftovers and
 *  free-text days add nothing. */
export function groceryGroups(
  days: MealPlanDay[],
  week: string[],
  recipes: Recipe[],
  staples: GroceryStaple[],
): GroceryGroup[] {
  const byDate = daysByDate(days)
  const groups: GroceryGroup[] = []
  for (const date of week) {
    const day = byDate.get(date)
    const recipe = day ? recipeOf(day, recipes) : null
    if (!day || !recipe) continue
    const sent = new Set(day.groceriesSent)
    groups.push({
      day,
      recipe,
      lines: ingredientLines(recipe.ingredients).map((text, index) => ({
        key: `${day.id}:${index}`,
        text,
        staple: isStaple(text, staples),
        sent: sent.has(text),
      })),
    })
  }
  return groups
}

/** The keys that start checked: everything not a staple and not already sent. */
export function defaultChecked(groups: GroceryGroup[]): Set<string> {
  return new Set(groups.flatMap((g) => g.lines.filter((l) => !l.staple && !l.sent).map((l) => l.key)))
}

/** The extra-items textarea: one item per line, blanks dropped. */
export function extraLines(extras: string): string[] {
  return extras
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** `prev` plus `added`, without repeats (the day's groceries_sent update). */
export function withSent(prev: string[], added: string[]): string[] {
  return [...new Set([...prev, ...added])]
}

/** The free-form list the grocery step writes to: the space's list named
 *  "Groceries" (any case), oldest first if there are several. */
export function findGroceriesList<T extends { name: string; createdAt: string }>(lists: T[]): T | null {
  return (
    [...lists]
      .filter((l) => l.name.trim().toLowerCase() === 'groceries')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null
  )
}
