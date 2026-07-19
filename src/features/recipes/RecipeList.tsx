import { Box, Group, Text, UnstyledButton } from '@mantine/core'
import type { Recipe } from '../../types'
import { colors, fonts } from '../../theme'
import { EmptyCard } from '../../components/EmptyCard'
import { servingsTimeLine } from './derive'

/** The cookbook as a dense scannable index: one row per recipe (already
 *  sorted A–Z), title + source on the left, tags and serves/time on the
 *  right. The grid's counterpart for when you know what you're looking for. */
export function RecipeList({
  recipes,
  filtered,
  onOpen,
}: {
  recipes: Recipe[]
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
      bg="#fff"
      style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 12, overflow: 'hidden' }}
    >
      {recipes.map((recipe, index) => {
        const meta = servingsTimeLine(recipe)
        return (
          <UnstyledButton
            key={recipe.id}
            onClick={() => onOpen(recipe)}
            w="100%"
            px={16}
            py={12}
            style={{ borderTop: index === 0 ? 'none' : `1px dotted ${colors.dotted}`, display: 'block' }}
          >
            <Group justify="space-between" align="center" gap={12} wrap="nowrap">
              <Box miw={0}>
                <Text fz={14.5} fw={700} c={colors.ink} truncate style={{ fontFamily: fonts.sans }}>
                  {recipe.title}
                </Text>
                {recipe.source && (
                  <Text fz={12} c={colors.muted} truncate style={{ fontFamily: fonts.sans }}>
                    {recipe.source}
                  </Text>
                )}
              </Box>
              <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                {recipe.tags.map((tag) => (
                  <Text
                    key={tag.toLowerCase()}
                    fz={11}
                    c={colors.inkFaded}
                    px={8}
                    py={2}
                    bg={colors.chip}
                    visibleFrom="sm"
                    style={{ fontFamily: fonts.sans, borderRadius: 20, border: `1px solid ${colors.borderFaint}` }}
                  >
                    {tag}
                  </Text>
                ))}
                {meta && (
                  <Text fz={11.5} c={colors.faint} style={{ fontFamily: fonts.mono, whiteSpace: 'nowrap' }}>
                    {meta}
                  </Text>
                )}
              </Group>
            </Group>
          </UnstyledButton>
        )
      })}
    </Box>
  )
}
