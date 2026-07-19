import { useState } from 'react'
import { Anchor, Box, Button, Group, Text, Title, UnstyledButton } from '@mantine/core'
import type { Profile, Recipe } from '../../types'
import { colors, fieldLabelStyle, fonts } from '../../theme'
import { formatDateWithYear, localDateOf } from '../../lib/format'
import { displayNameFor } from '../../lib/profile'
import { ingredientLines, servingsTimeLine, stepBlocks } from './derive'
import { RecipePhoto } from './RecipeGrid'

/**
 * The full recipe page (/recipes/:id) — built to be cooked from on a
 * counter-propped phone. Tapping an ingredient strikes it through (in the
 * bowl); tapping a step dims it (done). Both are ephemeral component state:
 * nothing is stored, and the parent keys this component by recipe id so the
 * marks reset when you open a different recipe.
 */
export function RecipeDetail({
  recipe,
  profiles,
  onBack,
  onEdit,
}: {
  recipe: Recipe
  profiles: Profile[]
  onBack: () => void
  onEdit: () => void
}) {
  const ingredients = ingredientLines(recipe.ingredients)
  const steps = stepBlocks(recipe.steps)
  const meta = servingsTimeLine(recipe)

  const [crossedIngredients, setCrossedIngredients] = useState<Set<number>>(new Set)
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set)
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<number>>>, index: number) =>
    set((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  const author = displayNameFor(profiles.find((p) => p.id === recipe.createdBy))
  const byline = [author && `Added by ${author}`, formatDateWithYear(localDateOf(recipe.createdAt))]
    .filter(Boolean)
    .join(' · ')

  return (
    <Box>
      {/* Header row: back to the index, edit on the right. */}
      <Group justify="space-between" align="center" mt={18} mb={4}>
        <UnstyledButton
          onClick={onBack}
          style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: colors.muted }}
        >
          ← All recipes
        </UnstyledButton>
        <Button variant="secondary" size="compact-sm" radius={8} onClick={onEdit}>
          Edit recipe
        </Button>
      </Group>

      <Title order={2} fz={34} lh={1.15} style={{ fontFamily: fonts.serif }}>
        {recipe.title}
      </Title>

      {(meta || recipe.source) && (
        <Text fz={14} c={colors.inkFaded} mt={6} style={{ fontFamily: fonts.sans }}>
          {meta}
          {meta && recipe.source ? ' · ' : ''}
          {recipe.sourceUrl ? (
            <Anchor href={recipe.sourceUrl} target="_blank" rel="noreferrer" c={colors.inkFaded} underline="always">
              {recipe.source || recipe.sourceUrl}
            </Anchor>
          ) : (
            recipe.source
          )}
        </Text>
      )}

      {recipe.tags.length > 0 && (
        <Group gap={6} mt={10}>
          {recipe.tags.map((tag) => (
            <Text
              key={tag.toLowerCase()}
              fz={11.5}
              c={colors.inkFaded}
              px={9}
              py={2}
              bg={colors.chip}
              style={{ fontFamily: fonts.sans, borderRadius: 20, border: `1px solid ${colors.borderFaint}` }}
            >
              {tag}
            </Text>
          ))}
        </Group>
      )}

      {recipe.imageUrl && (
        <Box mt={18} maw={560} style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${colors.cardBorder}` }}>
          <RecipePhoto imageUrl={recipe.imageUrl} title={recipe.title} height={280} />
        </Box>
      )}

      {/* Ingredients + steps: side by side with room, stacked on a phone. */}
      <Group mt={28} gap={36} align="flex-start" wrap="wrap">
        {ingredients.length > 0 && (
          <Box style={{ flex: '1 1 240px', maxWidth: 360 }}>
            <Text component="span" style={fieldLabelStyle}>
              Ingredients
            </Text>
            {ingredients.map((line, index) => {
              const crossed = crossedIngredients.has(index)
              return (
                <UnstyledButton
                  key={index}
                  onClick={() => toggle(setCrossedIngredients, index)}
                  display="block"
                  w="100%"
                  py={5}
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 14.5,
                    lineHeight: 1.45,
                    color: crossed ? colors.faint : colors.ink,
                    textDecoration: crossed ? 'line-through' : 'none',
                  }}
                >
                  {line}
                </UnstyledButton>
              )
            })}
            <Text fz={11.5} c={colors.faint} mt={8} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
              Tap an ingredient once it's in.
            </Text>
          </Box>
        )}

        {steps.length > 0 && (
          <Box style={{ flex: '2 1 300px', minWidth: 0 }}>
            <Text component="span" style={fieldLabelStyle}>
              Steps
            </Text>
            {steps.map((step, index) => {
              const done = doneSteps.has(index)
              return (
                <UnstyledButton
                  key={index}
                  onClick={() => toggle(setDoneSteps, index)}
                  display="block"
                  w="100%"
                  py={8}
                  style={{ opacity: done ? 0.4 : 1 }}
                >
                  <Group gap={12} align="flex-start" wrap="nowrap">
                    <Text
                      fz={13}
                      fw={700}
                      c={colors.muted}
                      w={26}
                      h={26}
                      bg={colors.chip}
                      ta="center"
                      lh="26px"
                      style={{ fontFamily: fonts.mono, borderRadius: '50%', flexShrink: 0 }}
                    >
                      {index + 1}
                    </Text>
                    <Text
                      fz={14.5}
                      c={colors.inkFaded}
                      lh={1.55}
                      style={{
                        fontFamily: fonts.sans,
                        whiteSpace: 'pre-line',
                        textDecoration: done ? 'line-through' : 'none',
                      }}
                    >
                      {step}
                    </Text>
                  </Group>
                </UnstyledButton>
              )
            })}
          </Box>
        )}

        {ingredients.length === 0 && steps.length === 0 && (
          <Text fz={14} c={colors.muted} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
            Not written out yet — edit the recipe to add ingredients and steps.
          </Text>
        )}
      </Group>

      {recipe.notes && (
        <Box mt={28} maw={640} p="14px 18px" bg="#fff" style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 12 }}>
          <Text component="span" style={fieldLabelStyle}>
            Our notes
          </Text>
          <Text fz={14} c={colors.inkFaded} lh={1.55} style={{ fontFamily: fonts.sans, whiteSpace: 'pre-line' }}>
            {recipe.notes}
          </Text>
        </Box>
      )}

      <Text fz={12} c={colors.faint} mt={30} style={{ fontFamily: fonts.sans }}>
        {byline}
      </Text>
    </Box>
  )
}
