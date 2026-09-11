import { useMemo, useState } from 'react'
import { Button, SegmentedControl, TextInput, UnstyledButton } from '@mantine/core'
import { useNavigate, useParams } from 'react-router'
import type { Recipe } from '../../types'
import { colors } from '../../theme'
import { useBusy } from '../../lib/useBusy'
import { useTagFilter } from '../../lib/useTagFilter'
import { TagFilterPills } from '../../components/TagFilterPills'
import { useConfirm } from '../../components/ConfirmModal'
import { ControlBar } from '../../components/ControlBar'
import { EmptyCard } from '../../components/EmptyCard'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { Splash } from '../../components/Splash'
import { useRecipeStore } from './useRecipeStore'
import type { RecipeDraft } from './useRecipeStore'
import { distinctRecipeTags, filterRecipes, sortRecipes } from './derive'
import { RecipeGrid } from './RecipeGrid'
import { RecipeList } from './RecipeList'
import { RecipeDetail } from './RecipeDetail'
import { RecipeModal } from './RecipeModal'

type View = 'grid' | 'list'

const emptyDraft = (): RecipeDraft => ({
  title: '',
  imageUrl: '',
  ingredients: '',
  steps: '',
  source: '',
  sourceUrl: '',
  tags: [],
  servings: '',
  totalTime: '',
  notes: '',
})

/** The shared cookbook. Both /recipes (the index: grid/list toggle, search,
 *  tag pills) and /recipes/:id (the full recipe page you cook from) render
 *  this same component — the doing-stuff multi-route trick — so the store and
 *  its realtime channel survive opening and closing recipes. */
export function RecipesPage({ spaceId, configured }: { spaceId: string | null; configured: boolean }) {
  const store = useRecipeStore(spaceId)
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { id: openId } = useParams()

  const [view, setView] = useState<View>('grid')
  const [search, setSearch] = useState('')

  // Tri-state tag pills, shared with the tier boards (src/lib/useTagFilter).
  const { tagFilter, includedTags, excludedTags, filterActive, toggleTag, clearTagFilter } = useTagFilter()
  const allTags = useMemo(() => distinctRecipeTags(store.recipes), [store.recipes])

  const shown = useMemo(
    () => sortRecipes(filterRecipes(store.recipes, search, includedTags, excludedTags)),
    [store.recipes, search, tagFilter],
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft)

  const openAdd = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setModalOpen(true)
  }

  const openEdit = (recipe: Recipe) => {
    setEditingId(recipe.id)
    setDraft({
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      source: recipe.source,
      sourceUrl: recipe.sourceUrl,
      tags: recipe.tags,
      servings: recipe.servings,
      totalTime: recipe.totalTime,
      notes: recipe.notes,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const { busy: saving, run: runSave } = useBusy()
  const saveRecipe = () =>
    runSave(async () => {
      if (!draft.title.trim()) return
      try {
        if (editingId) await store.updateRecipe(editingId, draft)
        else await store.addRecipe(draft)
        closeModal()
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const deleteEditingRecipe = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    if (!(await confirm({ title: 'Delete this recipe for both of you?', message: 'Its photo is removed too.' }))) return
    try {
      await store.deleteRecipe(editingId)
      closeModal()
      // If its page was open, it no longer exists — back to the index.
      if (openId === editingId) navigate('/recipes')
    } catch {
      // Keep the modal open on failure.
    }
  }

  // Both branches gate: a deep link to /recipes/:id would otherwise flash
  // "Recipe not found" for as long as the first load takes.
  const loadingData = configured && store.loading

  const openRecipe = openId ? store.recipes.find((r) => r.id === openId) ?? null : null

  return (
    <>
      <title>{openRecipe ? `${openRecipe.title} · cajubinile.com` : 'Recipes · cajubinile.com'}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <PageFrame>
        {loadingData ? (
          <Splash text="Loading your space…" mih="40vh" />
        ) : openId ? (
          openRecipe ? (
            // Keyed by id so the tap-to-cross-off marks reset per recipe.
            <RecipeDetail
              key={openRecipe.id}
              recipe={openRecipe}
              profiles={store.profiles}
              onBack={() => navigate('/recipes')}
              onEdit={() => openEdit(openRecipe)}
            />
          ) : (
            <EmptyCard title="Recipe not found" blurb="It may have been deleted.">
              <Button variant="secondary" onClick={() => navigate('/recipes')}>
                ← All recipes
              </Button>
            </EmptyCard>
          )
        ) : (
          <>
            <ControlBar
              left={
                <>
                  <SegmentedControl
                    value={view}
                    onChange={(value) => setView(value as View)}
                    data={[
                      { label: 'Grid', value: 'grid' },
                      { label: 'List', value: 'list' },
                    ]}
                  />
                  <TextInput
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    placeholder="Search recipes…"
                    aria-label="Search recipes by title"
                    rightSection={
                      search ? (
                        <UnstyledButton
                          onClick={() => setSearch('')}
                          aria-label="Clear search"
                          style={{ color: colors.faint, fontSize: 14, lineHeight: 1 }}
                        >
                          ✕
                        </UnstyledButton>
                      ) : null
                    }
                    w={200}
                  />
                </>
              }
              right={<Button onClick={openAdd}>+ Add recipe</Button>}
            />

            <TagFilterPills
              tags={allTags}
              allLabel="All recipes"
              tagFilter={tagFilter}
              filterActive={filterActive}
              onToggle={toggleTag}
              onClear={clearTagFilter}
            />

            {shown.length === 0 ? (
              filterActive || search.trim().length > 0 ? (
                <EmptyCard title="Nothing matches" blurb="No recipe fits that search and those tags." />
              ) : (
                <EmptyCard
                  title="No recipes yet"
                  blurb="Write down the first thing you've made — a title is all it takes; the rest can come later."
                />
              )
            ) : view === 'list' ? (
              <RecipeList recipes={shown} onOpen={(recipe) => navigate(`/recipes/${recipe.id}`)} />
            ) : (
              <RecipeGrid recipes={shown} onOpen={(recipe) => navigate(`/recipes/${recipe.id}`)} />
            )}
          </>
        )}
      </PageFrame>

      <RecipeModal
        opened={modalOpen}
        draft={draft}
        isEditing={editingId !== null}
        tagSuggestions={allTags}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onUpload={store.uploadPhoto}
        saving={saving}
        onSave={() => void saveRecipe()}
        onDelete={() => void deleteEditingRecipe()}
        onClose={closeModal}
      />
    </>
  )
}
