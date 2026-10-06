import { useCallback, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Profile, Recipe } from '../../types'
import { supabase } from '../../lib/supabase'
import { PROFILE_COLUMNS, SEED_PROFILES, removeById, toProfile, upsertById, useSpaceSync } from '../../data/spaceSync'
import { usePhotoRows } from '../../data/usePhotoRows'
import type { ProfileRow } from '../../data/spaceSync'
import { removeRecipePhoto, uploadRecipePhoto } from './photos'
import { ingredientLines, remapMarks, stepBlocks, withMark } from './derive'

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
        createdBy: 'u2',
        createdAt: '2026-03-22T09:00:00Z',
      },
    ],
  }
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
  created_by: string | null
  created_at: string
}

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
  'id,title,image_url,ingredients,steps,source,source_url,tags,servings,total_time,notes,crossed_ingredients,done_steps,created_by,created_at'

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
}

export type MarkList = 'ingredients' | 'steps'
const MARK_FIELD = { ingredients: 'crossedIngredients', steps: 'doneSteps' } as const

type MarkFields = Partial<Pick<Recipe, 'crossedIngredients' | 'doneSteps'>>

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
})

/** Cleaned-up draft → `recipes` columns (insert and update write the same set). */
// The mark arrays are written only when present: a new recipe starts empty,
// and an edit sends them only when the text they index into changed — so an
// edit can't stomp on a partner's taps on an untouched list.
const recipeColumns = (fields: ReturnType<typeof draftFields> & MarkFields) => ({
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
  ...(fields.crossedIngredients && { crossed_ingredients: fields.crossedIngredients }),
  ...(fields.doneSteps && { done_steps: fields.doneSteps }),
})

export function useRecipeStore(spaceId: string | null): RecipeStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [recipes, setRecipes] = useState<Recipe[]>(initial?.recipes ?? [])
  const [profiles, setProfiles] = useState<Profile[]>(initial?.profiles ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])

  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    const [rows, profs] = await Promise.all([
      supabase.from('recipes').select(RECIPE_COLUMNS).eq('space_id', spaceId).order('created_at'),
      supabase.from('profiles').select(PROFILE_COLUMNS),
    ])
    if (rows.error) throw rows.error
    if (profs.error) throw profs.error
    return {
      recipes: (rows.data as RecipeRow[]).map(toRecipe),
      profiles: (profs.data as ProfileRow[]).map(toProfile),
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
      if (fields.title) await insert({ ...fields, crossedIngredients: [], doneSteps: [] })
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
  }
}
