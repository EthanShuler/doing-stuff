import { Box, Text, UnstyledButton } from '@mantine/core'
import type { Recipe } from '../../types'
import { colors, fonts } from '../../theme'
import { PhotoWithFallback } from '../../components/PhotoWithFallback'
import { servingsTimeLine } from './derive'

export const RECIPE_EMOJI = '🍲'

/** A recipe photo with a 🍲 fallback — see PhotoWithFallback. Shared by the
 *  grid cards, the detail page, and the modal preview. */
export function RecipePhoto({
  imageUrl,
  title,
  height,
  emojiSize,
}: {
  imageUrl: string
  title: string
  height: number
  emojiSize?: number
}) {
  return (
    <PhotoWithFallback imageUrl={imageUrl} alt={title} height={height} fallbackEmoji={RECIPE_EMOJI} emojiSize={emojiSize} />
  )
}

/** The cookbook as a photo card grid (already sorted A–Z — see sortRecipes).
 *  Clicking a card opens the recipe's page. */
export function RecipeGrid({ recipes, onOpen }: { recipes: Recipe[]; onOpen: (recipe: Recipe) => void }) {
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
