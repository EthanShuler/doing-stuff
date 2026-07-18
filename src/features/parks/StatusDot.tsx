import { Box } from '@mantine/core'
import { colors } from '../../theme'
import type { Member, ParkPin } from './derive'
import { memberColor } from './derive'

// The one place a park status becomes pixels — used by the stats strip, the
// map legend, and the list rows, and mirrored by ParkMap's divIcon HTML.
// Status is never hue-alone (Ethan is red-green colorblind): members are the
// blue/orange safe pair, together is a RING (blue around orange), separately
// a half-and-half SPLIT, unvisited faint — all distinct in grayscale too.

export type DotVariant =
  | { kind: 'solid'; color: string }
  | { kind: 'ring'; outer: string; inner: string }
  | { kind: 'split'; left: string; right: string }
  | { kind: 'faint' }

/** The variant that draws a given map-pin state. */
export function pinVariant(pin: ParkPin, members: Member[]): DotVariant {
  if (pin === 'none') return { kind: 'faint' }
  if (pin === 'together') return togetherVariant(members)
  if (pin === 'separate') return separateVariant(members)
  return { kind: 'solid', color: memberColor(pin.memberId, members) }
}

export const togetherVariant = (members: Member[]): DotVariant => ({
  kind: 'ring',
  outer: members[0]?.color ?? colors.faint,
  inner: members[1]?.color ?? colors.faint,
})

export const separateVariant = (members: Member[]): DotVariant => ({
  kind: 'split',
  left: members[0]?.color ?? colors.faint,
  right: members[1]?.color ?? colors.faint,
})

export function StatusDot({ variant, size = 10 }: { variant: DotVariant; size?: number }) {
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0 }
  switch (variant.kind) {
    case 'solid':
      return <Box style={{ ...base, background: variant.color }} />
    case 'ring':
      return (
        <Box
          style={{
            ...base,
            background: variant.inner,
            border: `${Math.max(2, Math.round(size * 0.3))}px solid ${variant.outer}`,
          }}
        />
      )
    case 'split':
      return (
        <Box style={{ ...base, background: `linear-gradient(90deg, ${variant.left} 50%, ${variant.right} 50%)` }} />
      )
    case 'faint':
      return <Box style={{ ...base, background: colors.faint, opacity: 0.55 }} />
  }
}
