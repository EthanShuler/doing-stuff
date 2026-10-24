import { Box, Group, Text, UnstyledButton } from '@mantine/core'
import type { MealPlanDay, Recipe } from '../../types'
import { colors, fonts, radii, text } from '../../theme'
import { formatDate, today } from '../../lib/format'
import { DayPopover } from './DayPopover'
import { dayName, daysByDate, leftoverSources, mealLabel, recipeOf } from './derive'
import type { MealChoice } from './useMealPlanStore'

/** The week as seven dense rows, Sunday first: day · dinner. Tapping a row
 *  opens its DayPopover; a recipe day also gets a ↗ to its recipe page. */
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
  onPick: (date: string, choice: MealChoice) => void
  onClear: (date: string) => void
  onOpenRecipe: (id: string) => void
}) {
  const byDate = daysByDate(days)
  const now = today()

  return (
    <Box
      mt={24}
      bg={colors.surface}
      style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: radii.card, overflow: 'hidden' }}
    >
      {week.map((date, index) => {
        const day = byDate.get(date)
        const recipe = day ? recipeOf(day, recipes) : null
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
            <DayPopover
              date={date}
              current={day}
              recipes={recipes}
              sources={leftoverSources(days, recipes, date)}
              onPick={(choice) => onPick(date, choice)}
              onClear={() => onClear(date)}
            >
              <Group gap={14} wrap="nowrap" px={16} py={12} align="center">
                <Box w={64} style={{ flexShrink: 0 }}>
                  <Text fz={text.lead} fw={isToday ? 800 : 600} c={colors.ink} lh={1.2} style={{ fontFamily: fonts.serif }}>
                    {dayName(date)}
                  </Text>
                  <Text fz={text.tiny} c={colors.faint} style={{ fontFamily: fonts.mono }}>
                    {isToday ? 'today' : formatDate(date)}
                  </Text>
                </Box>
                {day ? (
                  <Text
                    fz={text.lead}
                    fw={day.kind === 'recipe' ? 700 : 500}
                    c={day.kind === 'recipe' && recipe ? colors.ink : colors.inkFaded}
                    truncate
                    style={{ fontFamily: fonts.sans, fontStyle: day.kind === 'leftovers' ? 'italic' : 'normal' }}
                  >
                    {mealLabel(day, recipes, days)}
                  </Text>
                ) : (
                  <Text fz={text.body} c={colors.faint} style={{ fontFamily: fonts.sans }}>
                    + Plan dinner
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
    </Box>
  )
}
