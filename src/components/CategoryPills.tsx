import type { ReactNode } from 'react'
import { Group } from '@mantine/core'
import type { Category } from '../types'
import { colors, swatchFor } from '../theme'
import { Pill } from './Pill'

/** The "All" pill plus one pill per category — the filter row shared by the
 *  Log, Calendar, and Map screens. Extra pills (e.g. the map's Wishlist)
 *  render after the categories via `children`. */
export function CategoryPills({
  categories,
  value,
  onChange,
  mt,
  children,
}: {
  categories: Category[]
  /** 'all' or a category id (callers may add their own values via children). */
  value: string
  onChange: (id: string) => void
  mt?: number
  children?: ReactNode
}) {
  return (
    <Group gap={8} wrap="wrap" mt={mt}>
      <Pill label="All" active={value === 'all'} activeBg={colors.ink} onClick={() => onChange('all')} />
      {categories.map((category) => {
        const swatch = swatchFor(category.colorIndex)
        const active = value === category.id
        return (
          <Pill
            key={category.id}
            label={category.name}
            active={active}
            activeBg={swatch.color}
            dotColor={active ? '#fff' : swatch.color}
            onClick={() => onChange(category.id)}
          />
        )
      })}
      {children}
    </Group>
  )
}
