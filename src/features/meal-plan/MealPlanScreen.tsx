import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, SegmentedControl, Text } from '@mantine/core'
import { useNavigate } from 'react-router'
import type { Recipe } from '../../types'
import { colors, fonts, text } from '../../theme'
import { today } from '../../lib/format'
import { ControlBar } from '../../components/ControlBar'
import { addDays, groceryGroups, plannedCount, weekDays, weekLabel, weekStart } from './derive'
import { GroceryModal } from './GroceryModal'
import { MealPlanView } from './MealPlanView'
import type { MealPlanStore } from './useMealPlanStore'

type Week = 'this' | 'next'

/** The Recipes feature's Meal plan screen (/recipes/plan): a This week /
 *  Next week toggle, the seven dinner rows, and the grocery step. The store
 *  lives on RecipesPage, so it survives switching to the cookbook and back. */
export function MealPlanScreen({
  store,
  recipes,
  screenToggle,
}: {
  store: MealPlanStore
  /** Every recipe, A–Z. */
  recipes: Recipe[]
  /** The Cookbook / Meal plan switcher, first in the control bar. */
  screenToggle: ReactNode
}) {
  const navigate = useNavigate()
  const [week, setWeek] = useState<Week>('this')
  const start = addDays(weekStart(today()), week === 'next' ? 7 : 0)
  const days = weekDays(start)

  // Each opening remounts the modal (its key), so its checklist re-seeds
  // from the current week.
  const [grocerySession, setGrocerySession] = useState(0)
  const [groceryOpen, setGroceryOpen] = useState(false)
  const openGroceries = () => {
    setGrocerySession((n) => n + 1)
    setGroceryOpen(true)
  }

  return (
    <>
      <ControlBar
        left={
          <>
            {screenToggle}
            <SegmentedControl
              value={week}
              onChange={(value) => setWeek(value as Week)}
              data={[
                { label: 'This week', value: 'this' },
                { label: 'Next week', value: 'next' },
              ]}
            />
            <Text fz={text.small} c={colors.muted} style={{ fontFamily: fonts.sans }}>
              {weekLabel(start)} · {plannedCount(store.days, days)} of 7 planned
            </Text>
          </>
        }
        right={<Button onClick={openGroceries}>🛒 Plan groceries</Button>}
      />

      <MealPlanView
        week={days}
        days={store.days}
        recipes={recipes}
        onPick={(date, choice) => void store.setDay(date, choice)}
        onClear={(date) => void store.clearDay(date)}
        onOpenRecipe={(id) => navigate(`/recipes/${id}`)}
      />

      <GroceryModal
        key={grocerySession}
        opened={groceryOpen}
        groups={groceryGroups(store.days, days, recipes, store.staples)}
        staples={store.staples}
        onAddStaple={(name) => void store.addStaple(name)}
        onRemoveStaple={(id) => void store.removeStaple(id)}
        onSend={store.sendGroceries}
        onOpenList={(listId) => navigate(`/lists/${listId}`)}
        onClose={() => setGroceryOpen(false)}
      />
    </>
  )
}
