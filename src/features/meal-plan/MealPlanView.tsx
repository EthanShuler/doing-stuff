import { Box, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import type { Meal, MealPlanDay, Recipe } from '../../types'
import { colors, fonts, radii, text } from '../../theme'
import { formatDate, today } from '../../lib/format'
import { DayPopover } from './DayPopover'
import { MEALS, dayName, leftoverSources, mealLabel, mealName, mealsBySlot, recipeOf, slotKey } from './derive'
import type { MealChoice } from './useMealPlanStore'

/** The week as seven dense rows, Sunday first: day · lunch / dinner. Tapping
 *  a meal opens its DayPopover; a recipe meal also gets a ↗ to its recipe
 *  page. */
export function MealPlanView({
  week,
  days,
  recipes,
  onPick,
  onClear,
  onOpenRecipe,
}: {
  week: string[]
  days: MealPlanDay[]
  /** Every recipe, A–Z. */
  recipes: Recipe[]
  onPick: (date: string, meal: Meal, choice: MealChoice) => void
  onClear: (date: string, meal: Meal) => void
  onOpenRecipe: (id: string) => void
}) {
  const bySlot = mealsBySlot(days)
  const now = today()

  return (
    <Box
      mt={24}
      bg={colors.surface}
      style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: radii.card, overflow: 'hidden' }}
    >
      {week.map((date, index) => {
        const isToday = date === now
        const past = date < now
        return (
          <Group
            key={date}
            data-meal-day={date}
            gap={0}
            wrap="nowrap"
            align="stretch"
            style={{ borderTop: index === 0 ? 'none' : `1px dotted ${colors.dotted}`, opacity: past ? 0.6 : 1 }}
          >
            <Box w={80} pl={16} pr={0} py={10} style={{ flexShrink: 0 }}>
              <Text fz={text.lead} fw={isToday ? 800 : 600} c={colors.ink} lh={1.2} style={{ fontFamily: fonts.serif }}>
                {dayName(date)}
              </Text>
              <Text fz={text.tiny} c={colors.faint} style={{ fontFamily: fonts.mono }}>
                {isToday ? 'today' : formatDate(date)}
              </Text>
            </Box>
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              {MEALS.map((meal) => {
                const day = bySlot.get(slotKey(date, meal))
                const recipe = day ? recipeOf(day, recipes) : null
                return (
                  <Group key={meal} data-meal-slot={meal} gap={0} wrap="nowrap" align="stretch" style={{ flex: 1 }}>
                    <DayPopover
                      date={date}
                      meal={meal}
                      current={day}
                      recipes={recipes}
                      sources={leftoverSources(days, recipes, date, meal)}
                      onPick={(choice) => onPick(date, meal, choice)}
                      onClear={() => onClear(date, meal)}
                    >
                      <Group gap={10} wrap="nowrap" px={12} py={6} align="baseline">
                        <Text
                          w={52}
                          fz={text.tiny}
                          c={colors.muted}
                          tt="uppercase"
                          style={{ fontFamily: fonts.mono, letterSpacing: '0.04em', flexShrink: 0 }}
                        >
                          {mealName(meal)}
                        </Text>
                        {day ? (
                          <Text
                            fz={text.body}
                            fw={day.kind === 'recipe' ? 700 : 500}
                            c={day.kind === 'recipe' && recipe ? colors.ink : colors.inkFaded}
                            truncate
                            style={{ fontFamily: fonts.sans, fontStyle: day.kind === 'leftovers' ? 'italic' : 'normal' }}
                          >
                            {mealLabel(day, recipes, days)}
                          </Text>
                        ) : (
                          <Text fz={text.body} c={colors.faint} style={{ fontFamily: fonts.sans }}>
                            + Plan {meal}
                          </Text>
                        )}
                      </Group>
                    </DayPopover>
                    {recipe && (
                      <UnstyledButton
                        onClick={() => onOpenRecipe(recipe.id)}
                        aria-label={`Open ${recipe.title}`}
                        title="Open recipe"
                        px={16}
                        style={{ color: colors.muted, fontSize: text.lead, flexShrink: 0 }}
                      >
                        ↗
                      </UnstyledButton>
                    )}
                  </Group>
                )
              })}
            </Stack>
          </Group>
        )
      })}
    </Box>
  )
}
