import { useCallback, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Profile, Recipe } from '../../types'
import { supabase } from '../../lib/supabase'
import { PROFILE_COLUMNS, SEED_PROFILES, syncTable, toProfile, useSpaceSync } from '../../data/spaceSync'
import { usePhotoRows } from '../../data/usePhotoRows'
import type { ProfileRow } from '../../data/spaceSync'
import { removeRecipePhoto, uploadRecipePhoto } from './photos'

// Data seam for the shared cookbook, mirroring the other stores' two modes:
//   • Supabase keys present → live: reads/writes the `recipes` table scoped to
//     the space (shared data — uniform space-member RLS).
//   • No keys → in-memory seed so the UI can be developed offline.
//
// Photos ride along as public-bucket URLs (see photos.ts); the writes —
// upload, add/edit, delete-with-photo — are the shared usePhotoRows
// (replaced/abandoned photos are the page's call — see src/lib/photoSession.ts). Profiles are fetched for the detail page's byline.

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
  createdBy: r.created_by,
  createdAt: r.created_at,
})

const RECIPE_COLUMNS =
  'id,title,image_url,ingredients,steps,source,source_url,tags,servings,total_time,notes,created_by,created_at'

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
}

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
const recipeColumns = (fields: ReturnType<typeof draftFields>) => ({
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

  const wire = useCallback(
    (channel: RealtimeChannel, spaceFilter: string) =>
      syncTable(channel, spaceFilter, 'recipes', toRecipe, setRecipes),
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
  const { insert, update } = rows

  const addRecipe = useCallback(
    async (draft: RecipeDraft) => {
      const fields = draftFields(draft)
      if (fields.title) await insert(fields)
    },
    [insert],
  )

  const updateRecipe = useCallback(
    async (id: string, draft: RecipeDraft) => {
      const fields = draftFields(draft)
      if (fields.title) await update(id, fields)
    },
    [update],
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
  }
}
