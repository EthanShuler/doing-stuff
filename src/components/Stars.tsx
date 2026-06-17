import { Rating } from '@mantine/core'
import { ACCENT, colors } from '../theme'

interface StarsProps {
  rating: number
  /** Tweaks the glyph size between the card (15px) and table (13px) layouts. */
  fontSize?: number
}

/** Read-only star rating: filled stars in the accent color, rest in faint. */
export function Stars({ rating, fontSize = 15 }: StarsProps) {
  return (
    <Rating
      value={rating}
      count={5}
      readOnly
      fullSymbol={<span style={{ color: ACCENT, fontSize }}>★</span>}
      emptySymbol={<span style={{ color: colors.starEmpty, fontSize }}>★</span>}
    />
  )
}
