// Mantine theme override that mirrors the earthy "Compass" direction defined in
// src/theme.ts. Keeping both files in sync: theme.ts stays the source of truth for
// raw palette values (and the data-driven category colors); this file translates
// the brand accent + fonts into the shape Mantine expects so its components inherit
// the same look without per-component overrides.

import { createTheme, Input, InputWrapper, type MantineColorsTuple } from '@mantine/core'
import { colors, fonts } from './theme'

// Terracotta "clay" accent scale. Index 6 is the brand ACCENT (oklch 0.62 0.13 45)
// and index 7 the hover shade (0.56 0.13 45), matching theme.ts so Mantine's default
// filled/hover states land exactly on the existing accent.
const clay: MantineColorsTuple = [
  'oklch(0.97 0.02 45)',
  'oklch(0.94 0.04 48)',
  'oklch(0.88 0.06 48)',
  'oklch(0.81 0.09 47)',
  'oklch(0.73 0.11 46)',
  'oklch(0.67 0.12 45)',
  'oklch(0.62 0.13 45)',
  'oklch(0.56 0.13 45)',
  'oklch(0.5 0.1 45)',
  'oklch(0.43 0.09 45)',
]

export const mantineTheme = createTheme({
  primaryColor: 'clay',
  primaryShade: 6,
  colors: { clay },
  fontFamily: fonts.sans,
  fontFamilyMonospace: fonts.mono,
  defaultRadius: 10,
  headings: {
    fontFamily: fonts.serif,
    fontWeight: '500',
  },
  components: {
    // Uppercase, muted, mono-spaced field labels — ported from the old
    // `labelStyle` so every form across the app reads the same.
    InputWrapper: InputWrapper.extend({
      styles: {
        label: {
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: colors.muted,
          marginBottom: 7,
        },
      },
    }),
    // Field chrome: warm hairline border + the design's 9px radius.
    Input: Input.extend({
      styles: {
        input: {
          borderColor: 'rgba(120,100,80,0.25)',
          borderRadius: 9,
          color: colors.ink,
        },
      },
    }),
  },
})
