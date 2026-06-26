import { Box, Button, Group, Text, Title } from '@mantine/core'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import type { Home, Screen } from '../types'
import type { MapMarker } from '../data/derive'
import { ACCENT, colors, fonts } from '../theme'
import { formatDate, stars } from '../lib/format'
import { HeaderActions } from './HeaderActions'

interface MapViewProps {
  title: string
  home: Home
  markers: MapMarker[]
  screen: Screen
  onScreenChange: (screen: Screen) => void
  onNewEntry: () => void
  onManage: () => void
  /** Open the entry modal for the entry behind a pin. */
  onEditEntry: (id: string) => void
}

// Fallback center when neither a home nor any pin is set (continental US),
// zoomed out — see CENTER/ZOOM below.
const DEFAULT_CENTER: [number, number] = [39.5, -98.35]
const PLACE_ZOOM = 13
const DEFAULT_ZOOM = 4

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
}

/** A Leaflet marker drawn as a plain emoji (avoids Leaflet's default image
 *  assets, which break under bundlers, and gives us the activity's icon). */
function emojiIcon(emoji: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="font-size:26px;line-height:1;text-align:center;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35))">${emoji}</div>`,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -28],
  })
}

const HOME_ICON = emojiIcon('🏠')

/** Keeps the map centered as the resolved center changes (e.g. home is set
 *  while the map is open). Recenters only when the coordinates actually move. */
function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [map, center[0], center[1], zoom])
  return null
}

export function MapView({
  title,
  home,
  markers,
  screen,
  onScreenChange,
  onNewEntry,
  onManage,
  onEditEntry,
}: MapViewProps) {
  const hasHome = home.lat !== null && home.lng !== null
  const center: [number, number] = hasHome
    ? [home.lat as number, home.lng as number]
    : markers.length > 0
      ? [markers[0].lat, markers[0].lng]
      : DEFAULT_CENTER
  const zoom = hasHome || markers.length > 0 ? PLACE_ZOOM : DEFAULT_ZOOM

  return (
    <Box mih="100vh" bg={colors.pageBg} c={colors.ink} pt={48} pb={80} px={24} style={{ fontFamily: fonts.sans }}>
      <Box maw={1100} mx="auto">
        {/* HEADER */}
        <Group
          justify="space-between"
          align="flex-end"
          gap={24}
          wrap="wrap"
          pb={22}
          style={{ borderBottom: '1px dotted rgba(120,100,80,0.4)' }}
        >
          <Box>
            <Title order={1} fz={42} lh={1} style={{ letterSpacing: '-0.01em' }}>
              {title}
            </Title>
          </Box>
          <HeaderActions screen={screen} onScreenChange={onScreenChange} onManage={onManage} onAdd={onNewEntry} />
        </Group>

        {!hasHome && (
          <Text fz={13} c={colors.muted} mt={18} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
            Set a home base under <strong>Manage</strong> to center the map on your city.
          </Text>
        )}

        {/* MAP */}
        <Box
          mt={20}
          style={{
            height: 'min(70vh, 680px)',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 16,
            overflow: 'hidden',
            // Trap Leaflet's internal pane z-indexes (up to ~700) in their own
            // stacking context so they can't paint over modals (which portal to
            // <body>); without this, the entry/manage modals open behind the map.
            isolation: 'isolate',
          }}
        >
          <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <Recenter center={center} zoom={zoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
            />
            {hasHome && <Marker position={[home.lat as number, home.lng as number]} icon={HOME_ICON} />}
            {markers.map((m) => {
              // Wishlist pins: text + place only, no actions (text-only popup).
              if (m.kind === 'wish') {
                return (
                  <Marker key={m.id} position={[m.lat, m.lng]} icon={emojiIcon(m.emoji)}>
                    <Popup>
                      <Box style={{ fontFamily: fonts.sans, minWidth: 160 }}>
                        <Text c="clay.6" mb={4} style={eyebrowStyle}>
                          Wishlist
                        </Text>
                        <Text fz={15} fw={700} c={colors.ink} mb={m.address ? 2 : 0}>
                          {m.title}
                        </Text>
                        {m.address && (
                          <Text fz={12} c={colors.muted}>
                            {m.address}
                          </Text>
                        )}
                      </Box>
                    </Popup>
                  </Marker>
                )
              }
              const star = stars(m.rating)
              return (
                <Marker key={m.id} position={[m.lat, m.lng]} icon={emojiIcon(m.emoji)}>
                  <Popup>
                    <Box style={{ fontFamily: fonts.sans, minWidth: 160 }}>
                      <Text fz={15} fw={700} c={colors.ink} mb={2}>
                        {m.title}
                      </Text>
                      <Text fz={12} c={colors.muted} mb={6}>
                        {m.activityName} · {formatDate(m.date)}
                      </Text>
                      <Text fz={14} mb={8} style={{ lineHeight: 1 }}>
                        <span style={{ color: ACCENT }}>{star.filled}</span>
                        <span style={{ color: colors.starEmpty }}>{star.empty}</span>
                      </Text>
                      <Button size="compact-xs" variant="default" radius={8} onClick={() => onEditEntry(m.id)}>
                        Edit
                      </Button>
                    </Box>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </Box>
      </Box>
    </Box>
  )
}
