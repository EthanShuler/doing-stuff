import { useEffect, useRef, useState } from 'react'
import { Box, Button, Group, NumberInput, SegmentedControl, Stack, Text } from '@mantine/core'
import { ACCENT_BLUE, ACCENT_BLUE_SOFT, colors, fonts, warmBorder } from '../../theme'
import { formatDate, formatDateWithYear, today } from '../../lib/format'
import { CIRCLE, daysDescending, isCirclePos, previousDay, type CircleKey } from './derive'
import { useBassoonStore } from './useBassoonStore'

/** Props for the wheel rendering. */
type WheelProps = {
  /** Today's already-logged position, or null (solid highlight). */
  saved: number | null
  /** Unsaved pending pick when it differs from `saved`, else null (dashed). */
  pending: number | null
  /** The pending key for the center readout, or null. */
  chosen: CircleKey | null
  /** Whether the center readout reflects a saved (vs unsaved) pick. */
  isSaved: boolean
  onSelect: (pos: number) => void
}

type SubView = 'today' | 'history'

export function Bassoon({ spaceId, userId }: { spaceId: string | null; userId: string | null }) {
  const store = useBassoonStore(spaceId, userId)
  const [view, setView] = useState<SubView>('today')

  const t = today()
  const logged = store.days.find((d) => d.date === t) ?? null // today's saved row, or null
  const savedPos = logged?.position ?? null
  const previous = previousDay(store.days, t) // last practiced before today

  // Local pending pick — nothing is written until "Log today" is pressed, so
  // just tapping the wheel never posts. Pre-filled (carried forward) from
  // today's saved row if any, else the last practiced day's key + tempo.
  const [pendingPos, setPendingPos] = useState<number | null>(null)
  const [pendingTempo, setPendingTempo] = useState<number | ''>('')
  const touched = useRef(false) // don't clobber the user's edits when days load

  const carryPos = logged?.position ?? previous?.position ?? null
  const carryTempo = logged?.tempo ?? previous?.tempo ?? null
  useEffect(() => {
    if (touched.current) return
    setPendingPos(carryPos)
    setPendingTempo(carryTempo ?? '')
  }, [carryPos, carryTempo])

  const pick = (pos: number) => {
    touched.current = true
    setPendingPos(pos)
  }
  const editTempo = (value: number | string) => {
    touched.current = true
    setPendingTempo(value === '' ? '' : Number(value))
  }

  const chosen = pendingPos !== null && isCirclePos(pendingPos) ? CIRCLE[pendingPos] : null
  const pendingTempoNum = pendingTempo === '' ? null : pendingTempo
  const savedMatches = logged !== null && logged.position === pendingPos && (logged.tempo ?? null) === pendingTempoNum
  const canLog = pendingPos !== null && !savedMatches

  return (
    <Stack align="center" gap={16} mt={16}>
      <SegmentedControl
        size="xs"
        value={view}
        onChange={(value) => setView(value as SubView)}
        data={[
          { label: 'Today', value: 'today' },
          { label: 'History', value: 'history' },
        ]}
      />

      {view === 'today' ? (
        <Stack align="center" gap={16} w="100%">
          <Text
            fz={12}
            fw={600}
            c={colors.muted}
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            Circle of Fifths
          </Text>

          <WheelSvg
            saved={pendingPos === savedPos ? savedPos : null}
            pending={pendingPos !== savedPos ? pendingPos : null}
            chosen={chosen}
            isSaved={pendingPos === savedPos && logged !== null}
            onSelect={pick}
          />

          <Group gap={10} align="flex-end" justify="center">
            <NumberInput
              label="Tempo"
              placeholder="BPM"
              value={pendingTempo}
              onChange={editTempo}
              min={20}
              max={400}
              step={2}
              suffix=" BPM"
              w={140}
              hideControls={false}
            />
            <Button onClick={() => store.logDay(pendingPos as number, pendingTempoNum)} disabled={!canLog}>
              {savedMatches ? '✓ Logged today' : logged ? 'Update today' : 'Log today'}
            </Button>
          </Group>

          {/* Faint context line under the controls. */}
          <Text fz={13} c={colors.faint} ta="center">
            {logged && isCirclePos(logged.position)
              ? `Logged today: ${CIRCLE[logged.position].major}${logged.tempo ? ` · ${logged.tempo} BPM` : ''}`
              : previous && isCirclePos(previous.position)
                ? `Last practiced: ${CIRCLE[previous.position].major}${previous.tempo ? ` · ${previous.tempo} BPM` : ''} · ${formatDate(previous.date)}`
                : 'Pick a key and tempo, then log your practice.'}
          </Text>
        </Stack>
      ) : (
        <History days={store.days} />
      )}

      {store.error && (
        <Text fz={13} c={colors.inkSoft}>
          Couldn't save — {store.error}
        </Text>
      )}
    </Stack>
  )
}

// --- History ----------------------------------------------------------------

/** A dated log of every practice day: key + tempo, newest first. */
function History({ days }: { days: ReturnType<typeof useBassoonStore>['days'] }) {
  const rows = daysDescending(days).filter((d) => isCirclePos(d.position))

  if (rows.length === 0) {
    return (
      <Text fz={14} c={colors.faint} mt={12} ta="center">
        No practice logged yet.
      </Text>
    )
  }

  return (
    <Stack gap={0} w="100%" maw={460}>
      {rows.map((d) => {
        const k = CIRCLE[d.position]
        return (
          <Group
            key={d.id}
            justify="space-between"
            align="center"
            wrap="nowrap"
            py={12}
            style={{ borderTop: `1px dotted ${warmBorder(0.25)}` }}
          >
            <Text fz={13} c={colors.muted} w={100} style={{ flexShrink: 0 }}>
              {formatDateWithYear(d.date)}
            </Text>
            <Text fz={20} c={colors.ink} style={{ fontFamily: fonts.serif, flex: 1 }}>
              {k.major}
            </Text>
            <Text fz={14} c={d.tempo ? colors.ink : colors.faint} style={{ flexShrink: 0, fontFamily: fonts.mono }}>
              {d.tempo ? `${d.tempo} BPM` : '—'}
            </Text>
          </Group>
        )
      })}
    </Stack>
  )
}

/** The center readout (the pending key or the prompt), overlaid in the wheel's
 *  hole. pointerEvents none so taps fall through to the wedges beneath. */
function CenterReadout({ chosen, isSaved }: { chosen: CircleKey | null; isSaved: boolean }) {
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
            {isSaved ? 'Today' : 'Selected'}
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

function WheelSvg({ saved, pending, chosen, isSaved, onSelect }: WheelProps) {
  return (
    <Box style={{ position: 'relative', width: SVG_SIZE, height: SVG_SIZE }}>
      <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${VIEW} ${VIEW}`} role="group" aria-label="Circle of fifths">
        {CIRCLE.map((k) => {
          // Slot centered at 12 o'clock for C, clockwise; ±15° half-slice.
          const c = k.pos * 30 - 90
          const a0 = c - 15
          const a1 = c + 15
          const isActive = saved === k.pos // logged today (solid fill)
          const isPending = pending === k.pos // unsaved pick (dashed outline)

          const [majX, majY] = pointAt((R_MAJOR_IN + R_OUTER) / 2 + 2, c)
          const [sigX, sigY] = pointAt((R_SIG_IN + R_MAJOR_IN) / 2, c)
          const [minX, minY] = pointAt((R_HOLE + R_SIG_IN) / 2, c)

          const stroke = isPending ? ACCENT_BLUE : warmBorder(0.35)
          const strokeWidth = isPending ? 2.5 : 1
          const dash = isPending ? '5 4' : undefined

          return (
            <g
              key={k.pos}
              onClick={() => onSelect(k.pos)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(k.pos)
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`${k.major} major, ${k.keySig}`}
              aria-pressed={isActive || isPending}
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
                fill={isActive ? ACCENT_BLUE_SOFT : colors.cardTint}
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

      <CenterReadout chosen={chosen} isSaved={isSaved} />
    </Box>
  )
}
