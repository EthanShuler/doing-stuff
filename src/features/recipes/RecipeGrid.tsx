import { useState } from 'react'
import { Box, Text, UnstyledButton } from '@mantine/core'
import type { Recipe } from '../../types'
import { colors, fonts } from '../../theme'
import { EmptyCard } from '../../components/EmptyCard'
import { servingsTimeLine } from './derive'

export const RECIPE_EMOJI = '🍲'

/** A recipe photo with a 🍲 fallback for '' or broken URLs. The broken state
 *  is remembered per URL, so uploading a replacement retries. Shared by the
 *  grid cards, the detail page, and the modal preview. */
export function RecipePhoto({
  imageUrl,
  title,
  height,
  emojiSize = 40,
}: {
  imageUrl: string
  title: string
  height: number
  emojiSize?: number
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  if (!imageUrl || brokenUrl === imageUrl) {
    return (
      <Box
        w="100%"
        h={height}
        bg={colors.chip}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: emojiSize }}
      >
        {RECIPE_EMOJI}
      </Box>
    )
  }
  return (
    <img
      src={imageUrl}
      alt={title}
      onError={() => setBrokenUrl(imageUrl)}
      style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
    />
  )
}

/** The cookbook as a photo card grid (already sorted A–Z — see sortRecipes).
 *  Clicking a card opens the recipe's page. */
export function RecipeGrid({
  recipes,
  filtered,
  onOpen,
}: {
  recipes: Recipe[]
  /** True when a search/tag filter is active — flips the empty-state copy. */
  filtered: boolean
  onOpen: (recipe: Recipe) => void
}) {
  if (recipes.length === 0) {
    return filtered ? (
      <EmptyCard title="Nothing matches" blurb="No recipe fits that search and those tags." />
    ) : (
      <EmptyCard
        title="No recipes yet"
        blurb="Write down the first thing you've made — a title is all it takes; the rest can come later."
      />
    )
  }

  return (
    <Box
      mt={24}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 18,
      }}
    >
      {recipes.map((recipe) => {
        const meta = servingsTimeLine(recipe)
        return (
          <UnstyledButton
            key={recipe.id}
            onClick={() => onOpen(recipe)}
            bg="#fff"
            style={{
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(40,30,20,0.08)',
              display: 'block',
            }}
          >
            <RecipePhoto imageUrl={recipe.imageUrl} title={recipe.title} height={150} />
            <Box p="10px 12px 12px">
              <Text fz={15} fw={700} c={colors.ink} lh={1.3} style={{ fontFamily: fonts.sans }}>
                {recipe.title}
              </Text>
              {recipe.source && (
                <Text fz={12.5} c={colors.muted} mt={2} style={{ fontFamily: fonts.sans }}>
                  {recipe.source}
                </Text>
              )}
              {meta && (
                <Text fz={11} c={colors.faint} mt={4} style={{ fontFamily: fonts.mono }}>
                  {meta}
                </Text>
              )}
            </Box>
          </UnstyledButton>
        )
      })}
    </Box>
  )
}
