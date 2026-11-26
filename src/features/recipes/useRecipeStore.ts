import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Profile, Recipe, RecipeShelf } from '../../types'
import { supabase } from '../../lib/supabase'
import { SEED_PROFILES, errorMessage, removeById, fetchSpacePeople, upsertById, useSpaceSync } from '../../data/spaceSync'
import { usePhotoRows } from '../../data/usePhotoRows'
import { seedPullFetch } from '../../data/seedPullSource'
import { originOf } from '../../lib/lineage'
import { copyRecipePhoto, removeRecipePhoto, uploadRecipePhoto } from './photos'
import { cloneRecipe, groceryLines, ingredientLines, keptStaples, remapMarks, stepBlocks, withMark } from './derive'

// Data seam for the shared cookbook, mirroring the other stores' two modes:
//   • Supabase keys present → live: reads/writes the `recipes` table scoped to
//     the space (shared data — uniform space-member RLS).
//   • No keys → in-memory seed so the UI can be developed offline.
//
// Photos ride along as public-bucket URLs (see photos.ts); the writes —
// upload, add/edit, delete-with-photo — are the shared usePhotoRows
// (replaced/abandoned photos are the page's call — see src/lib/photoSession.ts). Profiles are fetched for the detail page's byline.
//
// The detail page's cross-offs (crossed ingredients, done steps) live on the
// row as index arrays, so they persist and stream to the partner through the
// same realtime channel. A tap goes through the `set_recipe_mark` RPC, which
// adds/removes ONE index in SQL — two people tapping at once can't clobber
// each other the way a whole-array write would.

interface Snapshot {
  recipes: Recipe[]
  profiles: Profile[]
}

function seed(): Snapshot {
  return {
    profiles: SEED_PROFILES,
    recipes: [
      {
        id: 'r1',
        title: 'Cacio e pepe',
        imageUrl: '',
        ingredients: '200g spaghetti\n60g pecorino romano, finely grated\n2 tsp black pepper, coarsely ground\nsalt for the pasta water',
        steps:
          'Boil the spaghetti in well-salted water until just shy of al dente. Reserve a cup of pasta water before draining.\n\nToast the pepper in a dry pan until fragrant, then add a splash of pasta water.\n\nToss the pasta in the pan, then off heat work in the pecorino with more pasta water until glossy.',
        source: 'NYT Cooking',
        sourceUrl: 'https://cooking.nytimes.com/recipes/1017855-cacio-e-pepe',
        tags: ['dinner', 'pasta'],
        servings: '2',
        totalTime: '25 min',
        notes: 'Grate the cheese fine or it clumps — learned the hard way.',
        crossedIngredients: [],
        doneSteps: [],
        // No grocery list: the meal plan falls back to the ingredient lines.
        groceryList: '',
        stapleItems: [],
        shelf: '',
        copiedFrom: null,
        createdBy: 'u1',
        createdAt: '2026-05-10T09:00:00Z',
      },
      {
        id: 'r2',
        title: 'Apple kugel',
        imageUrl: '',
        ingredients: '8 oz wide egg noodles\n3 eggs\n2 apples, grated\n1/3 cup sugar\n1 tsp cinnamon\n4 tbsp butter, melted',
        steps:
          'Cook and drain the noodles.\n\nMix everything in a big bowl, pour into a buttered baking dish.\n\nBake at 350°F for about 45 minutes, until the top browns.',
        source: 'Grandma Ruth',
        sourceUrl: '',
        tags: ['dessert'],
        servings: '8',
        totalTime: '1h 15min',
        notes: '',
        crossedIngredients: [],
        doneSteps: [],
        groceryList: '',
        stapleItems: [],
        shelf: 'pinned',
        copiedFrom: null,
        createdBy: 'u2',
        createdAt: '2026-04-02T09:00:00Z',
      },
      {
        id: 'r3',
        title: 'Weeknight shakshuka',
        imageUrl: '',
        ingredients: '1 onion, sliced\n1 red pepper, sliced\n3 cloves garlic\n1 tsp cumin\n1 tsp paprika\n28 oz can crushed tomatoes\n5 eggs\nfeta and cilantro to finish',
        steps:
          'Soften the onion and pepper in olive oil, then add garlic and spices.\n\nAdd the tomatoes and simmer 10 minutes until thickened.\n\nCrack in the eggs, cover, and cook until the whites set. Finish with feta.',
        source: 'Adapted from Smitten Kitchen',
        sourceUrl: 'https://smittenkitchen.com/2010/04/shakshuka/',
        tags: ['dinner', 'vegetarian'],
        servings: '3',
        totalTime: '40 min',
        notes: 'Double the garlic. Always double the garlic.',
        crossedIngredients: [],
        doneSteps: [],
        groceryList: 'onion\nred pepper\ngarlic\ncumin\npaprika\ncrushed tomatoes (28 oz can)\neggs\nfeta\ncilantro',
        stapleItems: ['cumin', 'paprika'],
        shelf: '',
        copiedFrom: null,
        createdBy: 'u1',
        createdAt: '2026-06-18T09:00:00Z',
      },
      {
        id: 'r4',
        title: 'Miso soup',
        imageUrl: '',
        ingredients: '4 cups dashi\n3 tbsp white miso\n1/2 block silken tofu, cubed\n2 scallions, sliced\nhandful of wakame',
        steps:
          'Warm the dashi; soak the wakame.\n\nWhisk the miso into a ladleful of broth, then stir it back in off the boil. Add tofu, wakame, and scallions.',
        source: '',
        sourceUrl: '',
        tags: ['soup', 'dinner'],
        servings: '4',
        totalTime: '15 min',
        notes: '',
        crossedIngredients: [],
        doneSteps: [],
        groceryList: '',
        stapleItems: [],
        shelf: '',
        copiedFrom: null,
        createdBy: 'u2',
        createdAt: '2026-03-22T09:00:00Z',
      },
    ],
  }
}

/** Keyless seed mode's "other space" for a recipe pull (see
 *  src/data/seedPullSource.ts): the same few recipes whichever seed space is
 *  picked. Ids start `src-`; "Miso soup" shares a title with the store seed
 *  (the "Same title here" path); the cake carries a plain https photo
 *  (copyRecipePhoto hands it back unchanged); the tacos bring tags and a
 *  grocery list with staple flags. */
export function seedRecipePullSource(): Recipe[] {
  const base = {
    crossedIngredients: [],
    doneSteps: [],
    shelf: '' as const,
    copiedFrom: null,
    createdBy: 'u2',
  }
  return [
    {
      ...base,
      id: 'src-r1',
      title: 'Miso soup',
      imageUrl: '',
      ingredients: '4 cups water\n1 strip kombu\n3 tbsp red miso\nfirm tofu, cubed',
      steps: 'Steep the kombu in barely simmering water for 10 minutes, then lift it out.\n\nWhisk in the miso off the heat and add the tofu.',
      source: "Kenji's video",
      sourceUrl: '',
      tags: ['soup'],
      servings: '2',
      totalTime: '20 min',
      notes: 'Red miso — saltier than ours.',
      groceryList: '',
      stapleItems: [],
      createdAt: '2026-02-01T09:00:00Z',
    },
    {
      ...base,
      id: 'src-r2',
      title: 'Lemon olive oil cake',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Good_Food_Display_-_NCI_Visuals_Online.jpg',
      ingredients: '1 1/2 cups flour\n1 cup sugar\n3 eggs\n2/3 cup olive oil\n2 lemons, zested and juiced',
      steps: 'Whisk the eggs and sugar until pale, then stream in the oil.\n\nFold in the flour, zest and juice.\n\nBake at 350°F for 45 minutes.',
      source: 'Aunt Dee',
      sourceUrl: '',
      tags: ['dessert'],
      servings: '10',
      totalTime: '1h',
      notes: '',
      groceryList: '',
      stapleItems: [],
      createdAt: '2026-03-04T09:00:00Z',
    },
    {
      ...base,
      id: 'src-r3',
      title: 'Black bean tacos',
      imageUrl: '',
      ingredients: '2 cans black beans, drained\n1 tsp cumin\n8 corn tortillas\n1 avocado\npickled onions\nsalt',
      steps: 'Warm the beans with the cumin and a splash of water; mash half.\n\nChar the tortillas and fill them.',
      source: 'Budget Bytes',
      sourceUrl: 'https://www.budgetbytes.com',
      tags: ['dinner', 'vegetarian', 'quick'],
      servings: '4',
      totalTime: '20 min',
      notes: 'Pickled onions make it.',
      groceryList: 'black beans (2 cans)\ncumin\ncorn tortillas\navocado\nred onion\nsalt',
      stapleItems: ['cumin', 'salt'],
      createdAt: '2026-04-11T09:00:00Z',
    },
    {
      ...base,
      id: 'src-r4',
      title: 'Overnight oats',
      imageUrl: '',
      ingredients: '1/2 cup oats\n1/2 cup milk\n1 tbsp chia\nberries',
      steps: 'Stir it all together in a jar and leave it in the fridge overnight.',
      source: '',
      sourceUrl: '',
      tags: ['breakfast'],
      servings: '1',
      totalTime: '5 min',
      notes: '',
      groceryList: '',
      stapleItems: [],
      createdAt: '2026-05-20T09:00:00Z',
    },
  ]
}

// --- Row → app-type mapper (DB is snake_case) ---

type RecipeRow = {
  id: string
  title: string
  image_url: string | null
  ingredients: string | null
  steps: string | null
  source: string | null
  source_url: string | null
  tags: string[] | null
  servings: string | null
  total_time: string | null
  notes: string | null
  crossed_ingredients: number[] | null
  done_steps: number[] | null
  grocery_list: string | null
  staple_items: string[] | null
  shelf: string | null
  copied_from: string | null
  created_by: string | null
  created_at: string
}

/** Anything but the two named shelves reads as normal. */
const toShelf = (value: string | null): RecipeShelf => (value === 'pinned' || value === 'hidden' ? value : '')

const toRecipe = (r: RecipeRow): Recipe => ({
  id: r.id,
  title: r.title,
  imageUrl: r.image_url ?? '',
  ingredients: r.ingredients ?? '',
  steps: r.steps ?? '',
  source: r.source ?? '',
  sourceUrl: r.source_url ?? '',
  tags: r.tags ?? [],
  servings: r.servings ?? '',
  totalTime: r.total_time ?? '',
  notes: r.notes ?? '',
  crossedIngredients: r.crossed_ingredients ?? [],
  doneSteps: r.done_steps ?? [],
  groceryList: r.grocery_list ?? '',
  stapleItems: r.staple_items ?? [],
  shelf: toShelf(r.shelf),
  copiedFrom: r.copied_from,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

/** Which Recipe field each DB column feeds (the realtime UPDATE merge needs
 *  to know a column was omitted, which toRecipe's defaults would hide). */
const FIELD_OF_COLUMN: Record<Exclude<keyof RecipeRow, 'id'>, Exclude<keyof Recipe, 'id'>> = {
  title: 'title',
  image_url: 'imageUrl',
  ingredients: 'ingredients',
  steps: 'steps',
  source: 'source',
  source_url: 'sourceUrl',
  tags: 'tags',
  servings: 'servings',
  total_time: 'totalTime',
  notes: 'notes',
  crossed_ingredients: 'crossedIngredients',
  done_steps: 'doneSteps',
  grocery_list: 'groceryList',
  staple_items: 'stapleItems',
  shelf: 'shelf',
  copied_from: 'copiedFrom',
  created_by: 'createdBy',
  created_at: 'createdAt',
}

/** `mapped`, with every field whose column is absent from `row` taken from `held`. */
function omittedKept(row: Partial<RecipeRow>, mapped: Recipe, held: Recipe): Recipe {
  const merged = { ...mapped }
  for (const [column, field] of Object.entries(FIELD_OF_COLUMN)) {
    if (!(column in row)) Object.assign(merged, { [field]: held[field as keyof Recipe] })
  }
  return merged
}

const RECIPE_COLUMNS =
  'id,title,image_url,ingredients,steps,source,source_url,tags,servings,total_time,notes,crossed_ingredients,done_steps,grocery_list,staple_items,shelf,copied_from,created_by,created_at'

/** The fields the add/edit modal writes. All plain strings except tags. */
export interface RecipeDraft {
  title: string
  imageUrl: string
  ingredients: string
  steps: string
  source: string
  sourceUrl: string
  tags: string[]
  servings: string
  totalTime: string
  notes: string
  groceryList: string
  stapleItems: string[]
}

export interface RecipeStore {
  recipes: Recipe[]
  profiles: Profile[]
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void

  /** Downscale + upload a photo, returning its public URL for the draft.
   *  Throws on failure (the modal shows the reason and keeps its old image). */
  uploadPhoto: (file: File) => Promise<string>
  /** Add a recipe. Throws on failure (modal stays open). */
  addRecipe: (draft: RecipeDraft) => Promise<void>
  /** Edit a recipe. Throws on failure. Leaves the replaced photo to the
   *  page's photo session. */
  updateRecipe: (id: string, draft: RecipeDraft) => Promise<void>
  /** Delete a recipe (and best-effort its uploaded photo). Throws on failure. */
  deleteRecipe: (id: string) => Promise<void>
  /** Cross off / un-cross one ingredient or step (by index). Optimistic;
   *  a failed write reverts it and records the error. */
  setMark: (id: string, list: MarkList, index: number, marked: boolean) => Promise<void>
  /** Uncheck every ingredient and step — "starting a fresh batch". */
  clearMarks: (id: string) => Promise<void>
  /** Pin, hide, or put back one recipe — a one-column write, so it can't
   *  clobber someone else's edit. Optimistic; a failed write reverts it. */
  setShelf: (id: string, shelf: RecipeShelf) => Promise<void>

  /** Non-fatal warning (a pulled recipe came over without its photo). */
  notice: string | null
  clearNotice: () => void
  /** Read another space's cookbook for a pull (RLS lets a member read any
   *  space they belong to). Throws on failure. Seed mode: the fixed
   *  seedRecipePullSource. */
  fetchPullSource: (sourceSpaceId: string) => Promise<Recipe[]>
  /** Copy recipes from another space into this one, one at a time: copy the
   *  photo, then insert with `copiedFrom` = root origin. A recipe whose
   *  origin is already here is skipped. A failed photo copy pulls the recipe
   *  without it (and sets `notice`); a failed insert stops the pull (and
   *  sets `error`). `onProgress(n, total)` fires as recipe n starts. Returns
   *  how many were pulled. */
  pullRecipes: (recipes: Recipe[], onProgress?: (done: number, total: number) => void) => Promise<number>
}

export type MarkList = 'ingredients' | 'steps'
const MARK_FIELD = { ingredients: 'crossedIngredients', steps: 'doneSteps' } as const

type MarkFields = Partial<Pick<Recipe, 'crossedIngredients' | 'doneSteps'>>
/** Lineage rides along only on a create: null for a recipe made here, the
 *  root origin's id for one pulled from another space. Edits never send it. */
type LineageField = Partial<Pick<Recipe, 'copiedFrom'>>
/** Carried on a create so the seed row is complete; never sent as a column —
 *  a new recipe takes the DB default (''), and only setShelf changes it. */
type ShelfField = Partial<Pick<Recipe, 'shelf'>>

const draftFields = (draft: RecipeDraft) => ({
  title: draft.title.trim(),
  imageUrl: draft.imageUrl.trim(),
  // Keep interior blank lines (they're the step separator) — just trim the ends.
  ingredients: draft.ingredients.trim(),
  steps: draft.steps.trim(),
  source: draft.source.trim(),
  sourceUrl: draft.sourceUrl.trim(),
  tags: draft.tags.map((t) => t.trim()).filter(Boolean),
  servings: draft.servings.trim(),
  totalTime: draft.totalTime.trim(),
  notes: draft.notes.trim(),
  groceryList: groceryLines(draft.groceryList).join('\n'),
  // Only flags for lines still on the list survive the save.
  stapleItems: keptStaples(groceryLines(draft.groceryList), draft.stapleItems),
})

/** Cleaned-up draft → `recipes` columns (insert and update write the same set). */
// The mark arrays are written only when present: a new recipe starts empty,
// and an edit sends them only when the text they index into changed — so an
// edit can't stomp on a partner's taps on an untouched list. `copied_from`
// is written only when set (a pull); seed mode keeps the null on the row.
const recipeColumns = (fields: ReturnType<typeof draftFields> & MarkFields & LineageField & ShelfField) => ({
  title: fields.title,
  image_url: fields.imageUrl,
  ingredients: fields.ingredients,
  steps: fields.steps,
  source: fields.source,
  source_url: fields.sourceUrl,
  tags: fields.tags,
  servings: fields.servings,
  total_time: fields.totalTime,
  notes: fields.notes,
  grocery_list: fields.groceryList,
  staple_items: fields.stapleItems,
  ...(fields.crossedIngredients && { crossed_ingredients: fields.crossedIngredients }),
  ...(fields.doneSteps && { done_steps: fields.doneSteps }),
  // Only a pull sets lineage; everything else leaves the DB default (null).
  ...(fields.copiedFrom && { copied_from: fields.copiedFrom }),
})

export function useRecipeStore(spaceId: string | null): RecipeStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [recipes, setRecipes] = useState<Recipe[]>(initial?.recipes ?? [])
  const [profiles, setProfiles] = useState<Profile[]>(initial?.profiles ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])
  const [notice, setNotice] = useState<string | null>(null)
  const clearNotice = useCallback(() => setNotice(null), [])

  // Latest recipes, so a pull can skip what's already here without
  // re-creating its callback (synced after commit, as the compiler requires).
  const recipesRef = useRef(recipes)
  useLayoutEffect(() => {
    recipesRef.current = recipes
  }, [recipes])

  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [rows, people] = await Promise.all([
      supabase.from('recipes').select(RECIPE_COLUMNS).eq('space_id', spaceId).order('created_at'),
      fetchSpacePeople(spaceId),
    ])
    if (rows.error) throw rows.error
    return {
      recipes: (rows.data as RecipeRow[]).map(toRecipe),
      profiles: people.profiles,
    }
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setRecipes(snap.recipes)
    setProfiles(snap.profiles)
  }, [])

  // syncTable's handlers, except UPDATE: Postgres leaves an UPDATE's
  // unchanged TOASTed values (long text, ~2KB+ — a written-out recipe's
  // steps easily qualify) out of the replicated row. A mark tap touches only
  // the mark arrays, so its echo arrives without `steps` / `ingredients`,
  // and mapping it as-is would blank them. Keep the held value for any
  // column the payload omits.
  const wire = useCallback(
    (channel: RealtimeChannel, spaceFilter: string) =>
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recipes', filter: spaceFilter }, (p) =>
          upsertById(setRecipes, toRecipe(p.new as RecipeRow)),
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recipes', filter: spaceFilter }, (p) => {
          const row = p.new as Partial<RecipeRow> & { id: string }
          const mapped = toRecipe(row as RecipeRow)
          setRecipes((prev) =>
            prev.some((r) => r.id === row.id)
              ? prev.map((r) => (r.id === row.id ? omittedKept(row, mapped, r) : r))
              : [...prev, mapped],
          )
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'recipes' }, (p) =>
          removeById(setRecipes, (p.old as { id: string }).id),
        ),
    [],
  )

  useSpaceSync({
    spaceId,
    channelPrefix: 'recipes',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  const rows = usePhotoRows({
    spaceId,
    table: 'recipes',
    columns: RECIPE_COLUMNS,
    toItem: toRecipe,
    toColumns: recipeColumns,
    seedIdPrefix: 'rx',
    uploadPhoto: uploadRecipePhoto,
    removePhoto: removeRecipePhoto,
    items: recipes,
    setItems: setRecipes,
    setError,
  })
  const { insert, update, find } = rows

  const addRecipe = useCallback(
    async (draft: RecipeDraft) => {
      const fields = draftFields(draft)
      if (fields.title) await insert({ ...fields, crossedIngredients: [], doneSteps: [], shelf: '', copiedFrom: null })
    },
    [insert],
  )

  const updateRecipe = useCallback(
    async (id: string, draft: RecipeDraft) => {
      const fields: ReturnType<typeof draftFields> & MarkFields = draftFields(draft)
      if (!fields.title) return
      // Marks follow their line's text across the edit (see remapMarks).
      const prior = find(id)
      if (prior && prior.ingredients !== fields.ingredients) {
        fields.crossedIngredients = remapMarks(
          ingredientLines(prior.ingredients),
          ingredientLines(fields.ingredients),
          prior.crossedIngredients,
        )
      }
      if (prior && prior.steps !== fields.steps) {
        fields.doneSteps = remapMarks(stepBlocks(prior.steps), stepBlocks(fields.steps), prior.doneSteps)
      }
      await update(id, fields)
    },
    [find, update],
  )

  // Optimistic mark write: flip it locally, then the RPC; the realtime echo
  // (an UPDATE on the row) is idempotent. On failure, flip it back.
  const applyMark = useCallback((id: string, list: MarkList, index: number, marked: boolean) => {
    const field = MARK_FIELD[list]
    setRecipes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: withMark(r[field], index, marked) } : r)),
    )
  }, [])

  const setMark = useCallback(
    async (id: string, list: MarkList, index: number, marked: boolean) => {
      setError(null)
      applyMark(id, list, index, marked)
      if (!supabase || !spaceId) return
      const { error } = await supabase.rpc('set_recipe_mark', {
        target_recipe: id,
        target_list: list,
        target_index: index,
        is_marked: marked,
      })
      if (error) {
        applyMark(id, list, index, !marked)
        setError(error.message)
      }
    },
    [spaceId, applyMark],
  )

  const clearMarks = useCallback(
    async (id: string) => {
      setError(null)
      const prior = find(id)
      if (!prior) return
      const setBoth = (crossedIngredients: number[], doneSteps: number[]) =>
        setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, crossedIngredients, doneSteps } : r)))
      setBoth([], [])
      if (!supabase || !spaceId) return
      const { error } = await supabase.from('recipes').update({ crossed_ingredients: [], done_steps: [] }).eq('id', id)
      if (error) {
        setBoth(prior.crossedIngredients, prior.doneSteps)
        setError(error.message)
      }
    },
    [spaceId, find],
  )

  const setShelf = useCallback(
    async (id: string, shelf: RecipeShelf) => {
      setError(null)
      const prior = find(id)
      if (!prior || prior.shelf === shelf) return
      const apply = (value: RecipeShelf) =>
        setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, shelf: value } : r)))
      apply(shelf)
      if (!supabase || !spaceId) return
      const { error } = await supabase.from('recipes').update({ shelf }).eq('id', id)
      if (error) {
        apply(prior.shelf)
        setError(error.message)
      }
    },
    [spaceId, find],
  )

  const fetchPullSource = useCallback(async (sourceSpaceId: string): Promise<Recipe[]> => {
    if (!supabase) return seedPullFetch(seedRecipePullSource)
    const { data, error } = await supabase
      .from('recipes')
      .select(RECIPE_COLUMNS)
      .eq('space_id', sourceSpaceId)
      .order('created_at')
    if (error) throw error
    return (data as RecipeRow[]).map(toRecipe)
  }, [])

  const pullRecipes = useCallback(
    async (picked: Recipe[], onProgress?: (done: number, total: number) => void): Promise<number> => {
      setError(null)
      setNotice(null)
      // Lineage already here — including what this pull just added.
      const here = new Set(recipesRef.current.map(originOf))
      let pulled = 0
      let photoless = 0
      for (const [index, source] of picked.entries()) {
        onProgress?.(index + 1, picked.length)
        if (here.has(originOf(source))) continue
        let imageUrl = ''
        try {
          imageUrl = await copyRecipePhoto(source.imageUrl, spaceId)
        } catch {
          // The recipe is the point; it comes over without its photo.
          photoless += 1
        }
        try {
          await insert(cloneRecipe(source, imageUrl))
        } catch (err) {
          // insert already recorded the error. Don't strand the copy.
          if (imageUrl && imageUrl !== source.imageUrl) removeRecipePhoto(imageUrl)
          setError((prev) => prev ?? errorMessage(err))
          break
        }
        here.add(originOf(source))
        pulled += 1
      }
      if (photoless > 0) {
        setNotice(
          photoless === 1 ? '1 recipe came over without its photo.' : `${photoless} recipes came over without their photo.`,
        )
      }
      return pulled
    },
    [spaceId, insert],
  )

  return {
    recipes,
    profiles,
    loading,
    error,
    clearError,
    uploadPhoto: rows.uploadPhoto,
    addRecipe,
    updateRecipe,
    deleteRecipe: rows.remove,
    setMark,
    clearMarks,
    setShelf,
    notice,
    clearNotice,
    fetchPullSource,
    pullRecipes,
  }
}
