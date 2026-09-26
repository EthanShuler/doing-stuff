import { useState } from 'react'
import { TextInput } from '@mantine/core'
import { colors, fonts, text } from '../../theme'

/**
 * A borderless one-line add field at the foot of a subsection / a day: Enter
 * adds a title-only item. The field clears right away (so Enter-Enter can't
 * double-add) and gets its text back if the write failed. Focus stays put, so
 * several can go in one after another.
 */
export function QuickAdd({
  placeholder,
  ariaLabel,
  onAdd,
  compact = false,
}: {
  placeholder: string
  ariaLabel: string
  /** Resolves false when the write failed. */
  onAdd: (title: string) => Promise<boolean>
  /** The smaller variant for a weekend card's day column. */
  compact?: boolean
}) {
  const [value, setValue] = useState('')

  const submit = async () => {
    const title = value.trim()
    if (!title) return
    setValue('')
    const ok = await onAdd(title)
    if (!ok) setValue((current) => current || title)
  }

  return (
    <TextInput
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void submit()
        }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      variant="unstyled"
      size={compact ? 'xs' : 'sm'}
      styles={{
        input: {
          fontFamily: fonts.sans,
          fontSize: compact ? text.caption : text.small,
          color: colors.ink,
          paddingLeft: 0,
          // The theme's Input override draws a hairline on every variant;
          // this field sits flush inside its panel.
          border: 'none',
          background: 'transparent',
        },
      }}
    />
  )
}
