import { Text } from '@mantine/core'
import type { Recipe } from '../../types'
import { colors, fonts, text } from '../../theme'
import { PhotoCard, PhotoCardGrid } from '../../components/PhotoCard'
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
    <PhotoCardGrid minColumnWidth={190}>
      {recipes.map((recipe) => {
        const meta = servingsTimeLine(recipe)
        return (
          <PhotoCard
            key={recipe.id}
            imageUrl={recipe.imageUrl}
            alt={recipe.title}
            fallbackEmoji={RECIPE_EMOJI}
            photoHeight={150}
            title={recipe.title}
            onClick={() => onOpen(recipe)}
          >
            {recipe.source && (
              <Text fz={text.small} c={colors.muted} mt={2} style={{ fontFamily: fonts.sans }}>
                {recipe.source}
              </Text>
            )}
            {meta && (
              <Text fz={text.tiny} c={colors.faint} mt={4} style={{ fontFamily: fonts.mono }}>
                {meta}
              </Text>
            )}
          </PhotoCard>
        )
      })}
    </PhotoCardGrid>
  )
}
