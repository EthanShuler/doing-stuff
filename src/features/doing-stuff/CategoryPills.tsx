import type { ReactNode } from 'react'
import { Group, Stack } from '@mantine/core'
import type { Activity, Category } from '../../types'
import { colors, swatchFor } from '../../theme'
import { Pill, TriPill } from '../../components/Pill'
import type { EntryFilter } from './derive'
import { cycleCategory, entryFilterActive, NO_ENTRY_FILTER } from './derive'
import { cycleTri } from '../../lib/triFilter'

/** The filter rows shared by the Log, Calendar, and Map screens: "All" plus a
 *  tri-state pill per category, then — once a category is included — a second
 *  row of its activities (the subcategory filter). Extra pills (the map's
 *  Wishlist) render after the categories via `children`; a caller with extra
 *  pills passes `allActive` / `onClear` so "All" accounts for them too. */
export function CategoryPills({
  categories,
  activities,
  filter,
  onChange,
  allActive,
  onClear,
  mt,
  children,
}: {
  categories: Category[]
  activities: Activity[]
  filter: EntryFilter
  onChange: (filter: EntryFilter) => void
  allActive?: boolean
  onClear?: () => void
  mt?: number
  children?: ReactNode
}) {
  const included = categories.filter((c) => filter.categories[c.id] === 'include')
  const subPills = included.flatMap((category) =>
    activities.filter((a) => a.categoryId === category.id).map((activity) => ({ activity, category })),
  )
  const cycleActivity = (id: string, direction: 'forward' | 'back') =>
    onChange({ ...filter, activities: cycleTri(filter.activities, id, direction) })

  return (
    <Stack gap={8} mt={mt}>
      <Group gap={8} wrap="wrap">
        <Pill
          label="All"
          active={allActive ?? !entryFilterActive(filter)}
          activeBg={colors.ink}
          onClick={onClear ?? (() => onChange(NO_ENTRY_FILTER))}
        />
        {categories.map((category) => {
          const swatch = swatchFor(category.colorIndex)
          return (
            <TriPill
              key={category.id}
              label={category.name}
              state={filter.categories[category.id]}
              activeBg={swatch.color}
              dot={swatch.color}
              onCycle={() => onChange(cycleCategory(filter, category.id, 'forward', activities))}
              onCycleBack={() => onChange(cycleCategory(filter, category.id, 'back', activities))}
            />
          )
        })}
        {children}
      </Group>
      {/* Subcategories: only under an included category, and only when that
          narrows anything (a lone activity pill would be a no-op). */}
      {subPills.length > 1 && (
        <Group gap={6} wrap="wrap">
          {subPills.map(({ activity, category }) => (
            <TriPill
              key={activity.id}
              label={activity.emoji ? `${activity.emoji} ${activity.name}` : activity.name}
              state={filter.activities[activity.id]}
              activeBg={swatchFor(category.colorIndex).color}
              onCycle={() => cycleActivity(activity.id, 'forward')}
              onCycleBack={() => cycleActivity(activity.id, 'back')}
            />
          ))}
        </Group>
      )}
    </Stack>
  )
}
