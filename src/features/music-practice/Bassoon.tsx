import { Box, Stack, Text } from '@mantine/core'
import { ACCENT_BLUE, colors, fonts, warmBorder } from '../../theme'
import { formatDate, today } from '../../lib/format'
import { CIRCLE, keyForDate, previousDay, type CircleKey } from './derive'
import { useBassoonStore } from './useBassoonStore'

/** Props for the wheel rendering. */
type WheelProps = {
  /** Today's chosen position, or null (solid highlight). */
  active: number | null
  /** Carry-forward hint position when today is unset, else null (dashed hint). */
  carry: number | null
  /** Today's key for the center readout, or null. */
  chosen: CircleKey | null
  onSelect: (pos: number) => void
}

export function Bassoon({ spaceId, userId }: { spaceId: string | null; userId: string | null }) {
  const store = useBassoonStore(spaceId, userId)

  const t = today()
  const active = keyForDate(store.days, t) // today's pick, or null if not set yet
  const previous = previousDay(store.days, t) // last practiced before today
  // On a fresh day, pre-highlight the last key as a hint — but don't log it.
  const carry = active === null ? previous?.position ?? null : null
  const chosen = active !== null ? CIRCLE[active] : null

  return (
    <Stack align="center" gap={16} mt={16}>
      <Text
        fz={12}
        fw={600}
        c={colors.muted}
        style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
      >
        Circle of Fifths
      </Text>

      <WheelSvg active={active} carry={carry} chosen={chosen} onSelect={store.setTodayKey} />

      {/* Faint context line under the wheel. */}
      <Text fz={13} c={colors.faint} mt={4}>
        {previous
          ? `Last practiced: ${CIRCLE[previous.position].major} · ${formatDate(previous.date)}`
          : 'Tap a key to start tracking your practice.'}
      </Text>

      {store.error && (
        <Text fz={13} c={colors.inkSoft}>
          Couldn't save — {store.error}
        </Text>
      )}
    </Stack>
  )
}

/** The center readout (today's key or the prompt), overlaid in the wheel's
 *  hole. pointerEvents none so taps fall through to the wedges beneath. */
function CenterReadout({ chosen }: { chosen: CircleKey | null }) {
  return (
    <Box
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      {chosen ? (
        <>
          <Text fz={11} c={colors.faint} style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Today
          </Text>
          <Text fz={48} lh={1.05} c={colors.ink} style={{ fontFamily: fonts.serif }}>
            {chosen.major}
          </Text>
          <Text fz={13} c={colors.inkSoft}>
            {chosen.minor} · {chosen.keySig}
          </Text>
        </>
      ) : (
        <Text fz={15} c={colors.muted} style={{ fontFamily: fonts.serif }}>
          Pick today's key
        </Text>
      )}
    </Box>
  )
}

// --- SVG pie-wedge wheel ----------------------------------------------------

const VIEW = 400 // svg user-space (viewBox); rendered box is SVG_SIZE
const SVG_SIZE = 380
const CX = VIEW / 2
// Three concentric bands: majors (outer), key signatures (thin middle),
// relative minors (inner), around the center readout hole.
const R_OUTER = 192 // outer rim
const R_MAJOR_IN = 138 // major band: R_MAJOR_IN → R_OUTER
const R_SIG_IN = 116 // key-signature band: R_SIG_IN → R_MAJOR_IN
const R_HOLE = 78 // minor band: R_HOLE → R_SIG_IN, then the hole

/** A tint of ACCENT_BLUE for the active wedge's inner (minor) band — lighter
 *  than the outer so the rings stay legible when selected. */
const ACTIVE_INNER = 'oklch(0.72 0.08 250)'

const rad = (deg: number) => (deg * Math.PI) / 180
const pointAt = (r: number, deg: number): [number, number] => [
  CX + r * Math.cos(rad(deg)),
  CX + r * Math.sin(rad(deg)),
]

/** Path for an annular sector (ring slice) from `ri`→`ro`, `a0`→`a1` degrees. */
function annularSector(ri: number, ro: number, a0: number, a1: number): string {
  const [x0, y0] = pointAt(ro, a0)
  const [x1, y1] = pointAt(ro, a1)
  const [x2, y2] = pointAt(ri, a1)
  const [x3, y3] = pointAt(ri, a0)
  // 30° slices, so large-arc-flag is always 0; outer arc sweeps +, inner −.
  return `M${x0} ${y0} A${ro} ${ro} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${ri} ${ri} 0 0 0 ${x3} ${y3} Z`
}

function WheelSvg({ active, carry, chosen, onSelect }: WheelProps) {
  return (
    <Box style={{ position: 'relative', width: SVG_SIZE, height: SVG_SIZE }}>
      <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${VIEW} ${VIEW}`} role="group" aria-label="Circle of fifths">
        {CIRCLE.map((k) => {
          // Slot centered at 12 o'clock for C, clockwise; ±15° half-slice.
          const c = k.pos * 30 - 90
          const a0 = c - 15
          const a1 = c + 15
          const isActive = active === k.pos
          const isCarry = carry === k.pos

          const [majX, majY] = pointAt((R_MAJOR_IN + R_OUTER) / 2 + 2, c)
          const [sigX, sigY] = pointAt((R_SIG_IN + R_MAJOR_IN) / 2, c)
          const [minX, minY] = pointAt((R_HOLE + R_SIG_IN) / 2, c)

          const stroke = isCarry ? ACCENT_BLUE : warmBorder(0.35)
          const strokeWidth = isCarry ? 2.5 : 1
          const dash = isCarry ? '5 4' : undefined

          return (
            <g
              key={k.pos}
              onClick={() => onSelect(k.pos)}
              role="button"
              aria-label={`${k.major} major, ${k.keySig}`}
              aria-pressed={isActive}
              style={{ cursor: 'pointer' }}
            >
              {/* Major (outer) band */}
              <path
                d={annularSector(R_MAJOR_IN, R_OUTER, a0, a1)}
                fill={isActive ? ACCENT_BLUE : '#fff'}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
              {/* Key-signature band (between major and minor) */}
              <path
                d={annularSector(R_SIG_IN, R_MAJOR_IN, a0, a1)}
                fill={isActive ? ACCENT_BLUE : colors.chip}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
              {/* Minor (inner) band */}
              <path
                d={annularSector(R_HOLE, R_SIG_IN, a0, a1)}
                fill={isActive ? ACTIVE_INNER : colors.cardTint}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
              {/* Labels (upright — readable at all 12 positions) */}
              <text
                x={majX}
                y={majY}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={fonts.serif}
                fontSize={k.major.includes('/') ? 15 : 20}
                fontWeight={600}
                fill={isActive ? '#fff' : colors.ink}
              >
                {k.major}
              </text>
              <text
                x={sigX}
                y={sigY}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={fonts.sans}
                fontSize={10}
                fill={isActive ? '#fff' : colors.muted}
              >
                {k.keySig}
              </text>
              <text
                x={minX}
                y={minY}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={fonts.sans}
                fontSize={k.minor.includes('/') ? 10 : 12}
                fill={isActive ? '#fff' : colors.inkSoft}
              >
                {k.minor}
              </text>
            </g>
          )
        })}

        {/* Center hole (kept clear for the readout overlay). */}
        <circle cx={CX} cy={CX} r={R_HOLE} fill={colors.pageBg} stroke={warmBorder(0.2)} strokeWidth={1} />
      </svg>

      <CenterReadout chosen={chosen} />
    </Box>
  )
}
