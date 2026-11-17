import { useEffect, useState } from 'react'
import { Box, Checkbox, Group, Text, TextInput, UnstyledButton } from '@mantine/core'
import type { Recipe } from '../../types'
import { colors, fonts, radii, text } from '../../theme'
import { fuzzyMatch } from '../../lib/fuzzy'
import { errorMessage } from '../../data/spaceSync'
import { usePullSources } from '../../data/useSpace'
import { PullModal } from '../../components/PullModal'
import { recipePullChoices } from './derive'
import type { RecipePullChoice } from './derive'
import type { RecipeStore } from './useRecipeStore'

// "Pull from…" on the cookbook: pick recipes from another space's cookbook
// and copy them here (useRecipeStore.pullRecipes). A recipe already here by
// lineage is shown but can't be ticked ("Already here"); one that only shares
// a title stays pickable, flagged "Same title here" and unticked by default.

/** The pull modal for recipes: owns the source space, its fetched cookbook,
 *  the ticks, and the running pull. Mount it with a fresh `key` per opening
 *  so every open starts clean. */
export function RecipePullModal({
  opened,
  onClose,
  store,
}: {
  opened: boolean
  onClose: () => void
  store: Pick<RecipeStore, 'recipes' | 'fetchPullSource' | 'pullRecipes'>
}) {
  const { recipes, fetchPullSource, pullRecipes } = store
  const sources = usePullSources('recipes')
  const [sourceId, setSourceId] = useState<string | null>(() => sources[0]?.id ?? null)
  // The fetched cookbook, keyed by the space it came from — a stale answer
  // for a previous pick is simply "not loaded yet".
  const [loaded, setLoaded] = useState<{ spaceId: string; recipes: Recipe[] } | null>(null)
  const [loadError, setLoadError] = useState<{ spaceId: string; message: string } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (!opened || !sourceId) return
    let cancelled = false
    fetchPullSource(sourceId).then(
      (rows) => {
        if (!cancelled) setLoaded({ spaceId: sourceId, recipes: rows })
      },
      (err: unknown) => {
        if (!cancelled) setLoadError({ spaceId: sourceId, message: errorMessage(err) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [opened, sourceId, fetchPullSource])

  const sourceRecipes = loaded && loaded.spaceId === sourceId ? loaded.recipes : null
  const failed = loadError && loadError.spaceId === sourceId ? loadError.message : null
  const choices = sourceRecipes ? recipePullChoices(sourceRecipes, recipes) : []
  // Only what can still be pulled counts — a tick on a recipe that has since
  // become "Already here" (a partial pull, a partner's pull) drops out.
  const picked = choices.filter((c) => c.match !== 'lineage' && selected.has(c.recipe.id)).map((c) => c.recipe)
  const alreadyHere = choices.filter((c) => c.match === 'lineage').length
  const running = progress !== null

  const changeSource = (id: string) => {
    setSourceId(id)
    setSelected(new Set())
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const pull = async () => {
    if (running || picked.length === 0) return
    setProgress({ done: 0, total: picked.length })
    const pulled = await pullRecipes(picked, (done, total) => setProgress({ done, total }))
    setProgress(null)
    // A failed insert stops the pull and leaves the modal open (store.error
    // says why); what did come over now reads "Already here".
    if (pulled === picked.length) onClose()
  }

  const requestClose = () => {
    if (!running) onClose()
  }

  const n = picked.length
  return (
    <PullModal
      opened={opened}
      onClose={requestClose}
      title="Pull recipes"
      sources={sources}
      sourceId={sourceId}
      onSourceChange={changeSource}
      summary={
        sourceRecipes && sourceRecipes.length > 0
          ? `${n} selected${alreadyHere > 0 ? ` · ${alreadyHere} already here` : ''}`
          : undefined
      }
      confirmLabel={
        progress
          ? `Pulling ${Math.max(progress.done, 1)} of ${progress.total}…`
          : n === 0
            ? 'Pull recipes'
            : `Pull ${n} recipe${n === 1 ? '' : 's'}`
      }
      confirmDisabled={running || n === 0}
      onConfirm={() => void pull()}
    >
      <RecipePullBody
        choices={sourceRecipes ? choices : null}
        error={failed}
        selected={selected}
        onToggle={toggle}
        search={search}
        onSearch={setSearch}
        disabled={running}
      />
    </PullModal>
  )
}

/** The body: a fuzzy title search over the source cookbook, then one row per
 *  recipe — checkbox · title · faint source line · a word tag for a match. */
export function RecipePullBody({
  choices,
  error,
  selected,
  onToggle,
  search,
  onSearch,
  disabled,
}: {
  /** null while the source is loading. */
  choices: RecipePullChoice[] | null
  error: string | null
  selected: Set<string>
  onToggle: (id: string) => void
  search: string
  onSearch: (value: string) => void
  disabled: boolean
}) {
  if (error) {
    return (
      <Text fz={text.small} c={colors.muted} style={{ fontStyle: 'italic' }}>
        Couldn’t read that cookbook: {error}
      </Text>
    )
  }
  if (!choices) {
    return (
      <Text fz={text.small} c={colors.faint} style={{ fontStyle: 'italic' }}>
        Loading their recipes…
      </Text>
    )
  }
  if (choices.length === 0) {
    return (
      <Text fz={text.small} c={colors.faint} style={{ fontStyle: 'italic' }}>
        No recipes in that space yet.
      </Text>
    )
  }

  const shown = choices.filter((c) => fuzzyMatch(c.recipe.title, search))

  return (
    <>
      <TextInput
        value={search}
        onChange={(event) => onSearch(event.currentTarget.value)}
        placeholder="Search their recipes…"
        aria-label="Search recipes to pull"
        rightSection={
          search ? (
            <UnstyledButton
              onClick={() => onSearch('')}
              aria-label="Clear recipe search"
              style={{ color: colors.faint, fontSize: 14, lineHeight: 1 }}
            >
              ✕
            </UnstyledButton>
          ) : null
        }
        mb={12}
      />
      {shown.length === 0 ? (
        <Text fz={text.small} c={colors.faint} style={{ fontStyle: 'italic' }}>
          Nothing matches.
        </Text>
      ) : (
        <Box
          bg={colors.surface}
          style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: radii.chip, overflow: 'hidden' }}
        >
          {shown.map(({ recipe, match }, index) => {
            const here = match === 'lineage'
            return (
              <Group
                key={recipe.id}
                data-pull-row
                gap={10}
                wrap="nowrap"
                align="flex-start"
                px={12}
                py={8}
                style={{ borderTop: index === 0 ? 'none' : `1px dotted ${colors.dotted}`, opacity: here ? 0.6 : 1 }}
              >
                <Checkbox
                  checked={!here && selected.has(recipe.id)}
                  disabled={here || disabled}
                  onChange={() => onToggle(recipe.id)}
                  label={recipe.title}
                  description={recipe.source || undefined}
                  styles={{
                    label: { fontFamily: fonts.sans, fontSize: text.body, color: colors.ink },
                    description: { fontFamily: fonts.sans, fontSize: text.caption, color: colors.faint },
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                />
                {match && <MatchTag>{here ? 'Already here' : 'Same title here'}</MatchTag>}
              </Group>
            )
          })}
        </Box>
      )}
    </>
  )
}

/** The match, in words (never color alone). */
function MatchTag({ children }: { children: string }) {
  return (
    <Text
      fz={text.tiny}
      c={colors.muted}
      px={7}
      py={1}
      mt={2}
      bg={colors.chip}
      style={{ borderRadius: 20, border: `1px solid ${colors.borderFaint}`, whiteSpace: 'nowrap', flexShrink: 0 }}
    >
      {children}
    </Text>
  )
}
