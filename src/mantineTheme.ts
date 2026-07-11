// Mantine theme override that mirrors the earthy "Compass" direction defined in
// src/theme.ts. Keeping both files in sync: theme.ts stays the source of truth for
// raw palette values (and the data-driven category colors); this file translates
// the brand accent + fonts into the shape Mantine expects so its components inherit
// the same look without per-component overrides.

import { Button, createTheme, Input, InputWrapper, SegmentedControl, type MantineColorsTuple } from '@mantine/core'
import { colors, fieldLabelStyle, fonts, warmBorder } from './theme'

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
    // Uppercase, muted field labels — the shared style also used directly on
    // non-Mantine fields (see fieldLabelStyle in theme.ts).
    InputWrapper: InputWrapper.extend({
      styles: {
        label: fieldLabelStyle,
      },
    }),
    // App-wide custom button variants:
    //   • "secondary" — the transparent hairline-bordered action next to a
    //     primary button (Cancel, Manage, Today).
    //   • "chip" — the chip-toned inline add/save buttons in ManageModal.
    Button: Button.extend({
      vars: (_theme, props) => {
        if (props.variant === 'secondary') {
          return {
            root: {
              '--button-bg': 'transparent',
              '--button-hover': warmBorder(0.06),
              '--button-color': colors.inkSoft,
              '--button-bd': `1px solid ${colors.dotted}`,
            },
          }
        }
        if (props.variant === 'chip') {
          return {
            root: {
              '--button-bg': colors.chip,
              '--button-hover': '#ece8df',
              '--button-color': colors.inkSoft,
              '--button-bd': `1px solid ${warmBorder(0.18)}`,
              '--button-fz': '13px',
            },
          }
        }
        return { root: {} }
      },
    }),
    // The chip-toned toggle used for every screen/mode switcher.
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { radius: 9 },
      styles: {
        root: { background: colors.chip, border: `1px solid ${colors.borderFaint}`, padding: 3 },
        label: { fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: colors.muted },
      },
    }),
    // Field chrome: warm hairline border + the design's 9px radius.
    Input: Input.extend({
      styles: {
        input: {
          borderColor: warmBorder(0.25),
          borderRadius: 9,
          color: colors.ink,
        },
      },
    }),
  },
})
