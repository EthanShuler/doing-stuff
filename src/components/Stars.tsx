import { ACCENT, colors } from '../theme'
import { stars } from '../lib/format'

interface StarsProps {
  rating: number
  /** Letter-spacing varies between the card (2px) and table (1px) layouts. */
  letterSpacing?: number
  fontSize?: number
}

/** Read-only star rating: filled stars in the accent color, rest in faint. */
export function Stars({ rating, letterSpacing = 2, fontSize = 15 }: StarsProps) {
  const { filled, empty } = stars(rating)
  return (
    <div style={{ fontSize, letterSpacing: `${letterSpacing}px`, whiteSpace: 'nowrap' }}>
      <span style={{ color: ACCENT }}>{filled}</span>
      <span style={{ color: colors.starEmpty }}>{empty}</span>
    </div>
  )
}
