import { Box, Button, Group, Text } from '@mantine/core'
import { Marker, Popup } from 'react-leaflet'
import type L from 'leaflet'
import { colors, fonts } from '../../theme'
import { MapCanvas, cachedDivIcon } from '../../components/MapCanvas'
import { formatDateWithYear } from '../../lib/format'
import type { Park } from './parks'
import { PARKS } from './parks'
import type { Member, ParkStatus } from './derive'
import { parkPin } from './derive'
import type { DotVariant } from './StatusDot'
import { StatusDot, pinVariant, separateVariant, togetherVariant } from './StatusDot'

/** The divIcon HTML mirror of StatusDot (Leaflet pins are raw HTML): solid
 *  member dot, together ring, separately split, faint not-yet. Shape + the
 *  blue/orange pair keep every state readable with red-green colorblindness. */
function parkIcon(variant: DotVariant): L.DivIcon {
  const pin = (size: number, style: string, extra = '') =>
    cachedDivIcon(`parkpin:${JSON.stringify(variant)}`, () => ({
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;${style}${extra}"></div>`,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 3)],
    }))

  const shadow = 'box-shadow:0 0 0 2px #fff, 0 1px 5px rgba(40,30,20,0.4);'
  switch (variant.kind) {
    case 'faint':
      return pin(
        12,
        `background:${colors.faint};opacity:0.55;border:1.5px solid rgba(255,255,255,0.9);box-shadow:0 1px 2px rgba(40,30,20,0.2);`,
      )
    case 'solid':
      return pin(19, `background:${variant.color};${shadow}`)
    case 'ring':
      return pin(22, `background:${variant.inner};border:6px solid ${variant.outer};${shadow}`)
    case 'split':
      return pin(19, `background:linear-gradient(90deg, ${variant.left} 50%, ${variant.right} 50%);${shadow}`)
  }
}

/** "Together · Aug 14, 2023" / "Avery + Jordan, separately" / "Avery · 2
 *  visits" / "Not visited yet". */
function statusLine(status: ParkStatus | undefined, members: Member[]): string {
  if (!status || status.visitorIds.length === 0) return 'Not visited yet'
  const names = members
    .filter((m) => status.visitorIds.includes(m.id))
    .map((m) => m.name || 'Member')
    .join(' + ')
  const everyone = members.length > 1 && status.visitorIds.length === members.length
  const who = status.together ? 'Together' : everyone ? `${names}, separately` : names
  const latest = status.visits.find((v) => v.date)
  const count = status.visits.length
  const when = latest ? formatDateWithYear(latest.date!) : 'sometime, long ago'
  return `${who} · ${when}${count > 1 ? ` · ${count} visits` : ''}`
}

function LegendItem({ variant, label }: { variant: DotVariant; label: string }) {
  return (
    <Group gap={7} wrap="nowrap">
      <StatusDot variant={variant} />
      <Text fz={12} fw={600} c={colors.inkSoft} style={{ fontFamily: fonts.sans }}>
        {label}
      </Text>
    </Group>
  )
}

export function ParkMap({
  statuses,
  members,
  onOpen,
}: {
  statuses: Map<string, ParkStatus>
  members: Member[]
  onOpen: (park: Park) => void
}) {
  const memberIds = members.map((m) => m.id)

  return (
    <>
      {/* Legend: who owns which color, and the two shape-coded combined
          states. Person-fixed, so it reads the same on both logins. */}
      <Group gap={20} mt={18} wrap="wrap">
        {members.map((m) => (
          <LegendItem key={m.id} variant={{ kind: 'solid', color: m.color }} label={m.name || 'Member'} />
        ))}
        {members.length > 1 && <LegendItem variant={togetherVariant(members)} label="Together" />}
        {members.length > 1 && <LegendItem variant={separateVariant(members)} label="Separately" />}
        <LegendItem variant={{ kind: 'faint' }} label="Not yet" />
      </Group>

      {/* Continental-US default framing; Alaska, Hawaiʻi, and the territories
          are a pan away. */}
      <MapCanvas>
        {PARKS.map((park) => {
          const status = statuses.get(park.code)
          return (
            <Marker
              key={park.code}
              position={[park.lat, park.lng]}
              icon={parkIcon(pinVariant(parkPin(status, memberIds), members))}
            >
              <Popup>
                <Box style={{ fontFamily: fonts.sans, minWidth: 170 }}>
                  <Text fz={15} fw={700} c={colors.ink} mb={2}>
                    {park.name}
                  </Text>
                  <Text fz={12} c={colors.muted} mb={6}>
                    {park.states} · {statusLine(status, members)}
                  </Text>
                  <Button size="compact-xs" variant="default" radius={8} onClick={() => onOpen(park)}>
                    Details
                  </Button>
                </Box>
              </Popup>
            </Marker>
          )
        })}
      </MapCanvas>
    </>
  )
}
