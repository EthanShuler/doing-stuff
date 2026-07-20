// Visual theme ported verbatim from the Claude Design "Compass" direction.
// Earthy palette: terracotta clay, sage green, warm paper.

export interface PaletteSwatch {
  /** Solid accent — dots, active pills, primary buttons. */
  color: string
  /** Pale background tint for stat cards. */
  tint: string
  /** Darker ink for text on a tint. */
  ink: string
}

export const palette: PaletteSwatch[] = [
  { color: 'oklch(0.6 0.09 150)', tint: 'oklch(0.95 0.03 150)', ink: 'oklch(0.42 0.06 150)' },
  { color: 'oklch(0.62 0.13 45)', tint: 'oklch(0.95 0.045 50)', ink: 'oklch(0.5 0.1 45)' },
  { color: 'oklch(0.56 0.1 290)', tint: 'oklch(0.94 0.035 290)', ink: 'oklch(0.46 0.07 288)' },
  { color: 'oklch(0.66 0.11 75)', tint: 'oklch(0.95 0.04 80)', ink: 'oklch(0.5 0.08 72)' },
  { color: 'oklch(0.6 0.07 240)', tint: 'oklch(0.94 0.028 240)', ink: 'oklch(0.45 0.05 240)' },
  { color: 'oklch(0.62 0.1 15)', tint: 'oklch(0.95 0.035 15)', ink: 'oklch(0.5 0.08 12)' },
]

/** Primary brand accent (terracotta) — used across buttons and highlights. */
export const ACCENT = 'oklch(0.62 0.13 45)'
export const ACCENT_HOVER = 'oklch(0.56 0.13 45)'
export const DANGER = 'oklch(0.55 0.14 25)'
/** ACCENT's colorblind-safe counterpart for UI where color CARRIES MEANING
 *  (status pins/dots): Ethan is red-green colorblind, so meaningful pairs must
 *  be blue vs orange (plus a shape/lightness cue), never terracotta vs sage. */
export const ACCENT_BLUE = 'oklch(0.55 0.12 250)'
/** A lighter tint of ACCENT_BLUE for a secondary highlighted surface (e.g. the
 *  inner ring of the selected circle-of-fifths wedge) — kept legible against
 *  the solid ACCENT_BLUE beside it. */
export const ACCENT_BLUE_SOFT = 'oklch(0.72 0.08 250)'

export const fonts = {
  sans: "'Plus Jakarta Sans', sans-serif",
  serif: "'Newsreader', serif",
  mono: "'Spline Sans Mono', monospace",
}

/** The app's single border/tint hue (warm brown) at a given opacity. Use the
 *  named tokens in `colors` for the recurring weights; reach for this directly
 *  only for one-off decorative alphas. */
export const warmBorder = (alpha: number) => `rgba(120,100,80,${alpha})`

export const colors = {
  pageBg: 'oklch(0.972 0.013 78)',
  ink: '#3a352e',
  /** Softer ink — secondary button labels, list metadata. */
  inkSoft: '#5c574e',
  /** Faded ink — descriptions and table body text. */
  inkFaded: '#6b665e',
  muted: '#8a857c',
  faint: '#a8a298',
  cardBorder: warmBorder(0.13),
  dotted: warmBorder(0.3),
  /** Hairline on chips, pills, and segmented controls. */
  borderFaint: warmBorder(0.12),
  /** Dashed empty-state / placeholder borders. */
  dashedBorder: warmBorder(0.28),
  /** The heavier dotted rule under each page's control bar. */
  rule: warmBorder(0.4),
  chip: '#f3f0ea',
  /** Warm neutral fill for stat cards / info panels, a touch deeper than pageBg. */
  cardTint: 'oklch(0.96 0.018 78)',
  starEmpty: '#ddd6c9',
}

/** Safe fallback color for entries whose category was deleted. */
export const FALLBACK_COLOR = '#ccc'

/** Uppercase muted field label — what Mantine inputs get via mantineTheme's
 *  InputWrapper override; use this directly on non-Mantine fields (the rating
 *  row, the repeat history heading) so every label reads the same. */
export const fieldLabelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: colors.muted,
  marginBottom: 7,
} as const

export function swatchFor(colorIndex: number): PaletteSwatch {
  return palette[colorIndex] ?? palette[0]
}
