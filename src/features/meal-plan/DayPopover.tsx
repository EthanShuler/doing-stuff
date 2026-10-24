import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Button, Group, Popover, Select, Text, TextInput, UnstyledButton } from '@mantine/core'
import type { MealPlanDay, Recipe } from '../../types'
import { ACCENT, colors, fieldLabelStyle, fonts, radii, shadows, text } from '../../theme'
import { formatDate } from '../../lib/format'
import { dayName, recipeOf } from './derive'
import type { MealChoice } from './useMealPlanStore'

/**
 * Tap a day to plan its dinner: a searchable recipe dropdown, a free-text
 * field, and a chip per earlier cook to eat leftovers of. Picking any of
 * them saves and closes; "Clear day" empties it.
 */
export function DayPopover({
  date,
  current,
  recipes,
  sources,
  onPick,
  onClear,
  children,
}: {
  date: string
  /** What the day holds now (undefined = nothing planned). */
  current: MealPlanDay | undefined
  /** Every recipe, A–Z. */
  recipes: Recipe[]
  /** Earlier recipe days this one can eat leftovers of (leftoverSources). */
  sources: MealPlanDay[]
  onPick: (choice: MealChoice) => void
  onClear: () => void
  /** The trigger's visible content. */
  children: ReactNode
}) {
  const [opened, setOpened] = useState(false)
  const [draftText, setDraftText] = useState('')

  const open = () => {
    setDraftText(current?.kind === 'text' ? current.text : '')
    setOpened(true)
  }

  const pick = (choice: MealChoice) => {
    setOpened(false)
    onPick(choice)
  }

  const saveText = () => {
    if (draftText.trim()) pick({ kind: 'text', text: draftText })
  }

  const label = `${dayName(date)} · ${formatDate(date)}`

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={320}
      trapFocus
      returnFocus
      styles={{
        dropdown: {
          background: colors.surface,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: radii.panel,
          boxShadow: shadows.popover,
          padding: 14,
          fontFamily: fonts.sans,
        },
      }}
    >
      <Popover.Target>
        <UnstyledButton
          onClick={() => (opened ? setOpened(false) : open())}
          aria-label={`Plan ${label}`}
          aria-haspopup="dialog"
          style={{ textAlign: 'left', minWidth: 0, flex: 1, display: 'block' }}
        >
          {children}
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown>
        {/* Initial focus lands on the heading, not the recipe Select — a
            focused Select opens its dropdown over the rest of the popover
            (and, on a phone, the keyboard). */}
        <Text
          data-autofocus
          tabIndex={-1}
          fz={text.lead}
          c={colors.ink}
          lh={1.25}
          mb={12}
          style={{ fontFamily: fonts.serif, outline: 'none' }}
        >
          {label}
        </Text>

        <Select
          label="Recipe"
          placeholder="Search our recipes…"
          searchable
          nothingFoundMessage="No recipe by that name"
          data={recipes.map((r) => ({ value: r.id, label: r.title }))}
          value={current?.kind === 'recipe' ? current.recipeId : null}
          onChange={(id) => id && pick({ kind: 'recipe', recipeId: id })}
          comboboxProps={{ withinPortal: false }}
          mb={12}
        />

        <TextInput
          label="Something else"
          placeholder="Pizza night, eating out…"
          value={draftText}
          onChange={(event) => setDraftText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              saveText()
            }
          }}
          rightSectionWidth={52}
          rightSection={
            draftText.trim() ? (
              <Button variant="subtle" size="compact-xs" c={colors.inkSoft} onClick={saveText}>
                Set
              </Button>
            ) : null
          }
          mb={12}
        />

        <Box mb={12}>
          <span style={fieldLabelStyle}>Leftovers</span>
          <Group gap={6} wrap="wrap">
            {sources.map((source) => (
              <LeftoverChip
                key={source.id}
                selected={current?.kind === 'leftovers' && current.leftoversOf === source.id}
                onClick={() => pick({ kind: 'leftovers', leftoversOf: source.id })}
              >
                {recipeOf(source, recipes)?.title} ({dayName(source.day)})
              </LeftoverChip>
            ))}
            <LeftoverChip
              selected={current?.kind === 'leftovers' && current.leftoversOf === null}
              onClick={() => pick({ kind: 'leftovers', leftoversOf: null })}
            >
              {sources.length > 0 ? 'Other leftovers' : 'Leftovers'}
            </LeftoverChip>
          </Group>
        </Box>

        {current && (
          <Button
            variant="secondary"
            size="compact-sm"
            onClick={() => {
              setOpened(false)
              onClear()
            }}
          >
            Clear day
          </Button>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}

/** One leftovers choice. Selected = filled with a ✓ (never color alone). */
function LeftoverChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      aria-pressed={selected}
      style={{
        fontFamily: fonts.sans,
        fontSize: text.caption,
        fontWeight: selected ? 700 : 500,
        padding: '4px 10px',
        borderRadius: 20,
        background: selected ? ACCENT : colors.chip,
        color: selected ? colors.onAccent : colors.inkSoft,
        border: `1px solid ${selected ? ACCENT : colors.borderFaint}`,
      }}
    >
      {selected && '✓ '}
      {children}
    </UnstyledButton>
  )
}
