import { useMemo, useState } from 'react'
import { Box, Button, Group, SegmentedControl, Text, TextInput, UnstyledButton } from '@mantine/core'
import { useNavigate, useParams } from 'react-router'
import type { Recipe } from '../../types'
import { ACCENT, colors, fonts } from '../../theme'
import { Pill } from '../../components/Pill'
import { EmptyCard } from '../../components/EmptyCard'
import { FloatingBanner } from '../../components/FloatingBanner'
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
  const { id: openId } = useParams()

  const [view, setView] = useState<View>('grid')
  const [search, setSearch] = useState('')

  // Tri-state tag pills, same semantics as the tier boards: a click cycles
  // off → include → exclude → off. Includes are OR; excludes always hide.
  const [tagFilter, setTagFilter] = useState<Record<string, 'include' | 'exclude'>>({})
  const allTags = useMemo(() => distinctRecipeTags(store.recipes), [store.recipes])
  const includedTags = Object.keys(tagFilter).filter((t) => tagFilter[t] === 'include')
  const excludedTags = Object.keys(tagFilter).filter((t) => tagFilter[t] === 'exclude')
  const filterActive = includedTags.length > 0 || excludedTags.length > 0
  const toggleTag = (tag: string) =>
    setTagFilter((prev) => {
      const next = { ...prev }
      if (prev[tag] === 'include') next[tag] = 'exclude'
      else if (prev[tag] === 'exclude') delete next[tag]
      else next[tag] = 'include'
      return next
    })

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

  const saveRecipe = async () => {
    if (!draft.title.trim()) return
    try {
      if (editingId) await store.updateRecipe(editingId, draft)
      else await store.addRecipe(draft)
      closeModal()
    } catch {
      // Write failed — keep the modal open; store.error shows the reason.
    }
  }

  const deleteEditingRecipe = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    if (!window.confirm('Delete this recipe for both of you? Its photo is removed too.')) return
    try {
      await store.deleteRecipe(editingId)
      closeModal()
      // If its page was open, it no longer exists — back to the index.
      if (openId === editingId) navigate('/recipes')
    } catch {
      // Keep the modal open on failure.
    }
  }

  if (configured && store.loading) {
    return <Splash text="Loading your space…" mih="60vh" />
  }

  const openRecipe = openId ? store.recipes.find((r) => r.id === openId) ?? null : null

  return (
    <>
      <title>{openRecipe ? `${openRecipe.title} · cajubinile.com` : 'Recipes · cajubinile.com'}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        <Box maw={1100} mx="auto">
          {openId ? (
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
                <Button variant="secondary" radius={10} onClick={() => navigate('/recipes')}>
                  ← All recipes
                </Button>
              </EmptyCard>
            )
          ) : (
            <>
              <Group
                justify="space-between"
                align="center"
                gap={12}
                wrap="wrap"
                pb={18}
                style={{ borderBottom: `1px dotted ${colors.rule}` }}
              >
                <Group gap={12} align="center" wrap="wrap">
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
                </Group>
                <Button onClick={openAdd} radius={10}>
                  + Add recipe
                </Button>
              </Group>

              {allTags.length > 0 && (
                <Group gap={8} mt={16} wrap="wrap">
                  <Pill label="All recipes" active={!filterActive} activeBg={ACCENT} onClick={() => setTagFilter({})} />
                  {allTags.map((tag) => (
                    <Pill
                      key={tag.toLowerCase()}
                      label={tag}
                      active={tagFilter[tag] !== undefined}
                      excluded={tagFilter[tag] === 'exclude'}
                      activeBg={ACCENT}
                      onClick={() => toggleTag(tag)}
                    />
                  ))}
                  {filterActive && (
                    <Text fz={12} c={colors.faint} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
                      tap a tag again to exclude it
                    </Text>
                  )}
                </Group>
              )}

              {view === 'list' ? (
                <RecipeList
                  recipes={shown}
                  filtered={filterActive || search.trim().length > 0}
                  onOpen={(recipe) => navigate(`/recipes/${recipe.id}`)}
                />
              ) : (
                <RecipeGrid
                  recipes={shown}
                  filtered={filterActive || search.trim().length > 0}
                  onOpen={(recipe) => navigate(`/recipes/${recipe.id}`)}
                />
              )}
            </>
          )}
        </Box>
      </Box>

      <RecipeModal
        opened={modalOpen}
        draft={draft}
        isEditing={editingId !== null}
        tagSuggestions={allTags}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onUpload={store.uploadPhoto}
        onSave={() => void saveRecipe()}
        onDelete={() => void deleteEditingRecipe()}
        onClose={closeModal}
      />
    </>
  )
}
