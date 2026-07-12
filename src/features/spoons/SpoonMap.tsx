import { useEffect } from 'react'
import { Box, Button, Text } from '@mantine/core'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Spoon } from '../../types'
import type { SpoonMarker } from './derive'
import { markerBounds } from './derive'
import { ACCENT, colors, fonts } from '../../theme'
import { formatDateWithYear } from '../../lib/format'
import { SPOON_EMOJI, SpoonPhoto } from './SpoonGrid'

// Fallback framing when nothing is locatable yet (continental US, zoomed out —
// same as the doing-stuff map's keyless default).
const DEFAULT_CENTER: [number, number] = [39.5, -98.35]
const DEFAULT_ZOOM = 4

/** A Leaflet marker drawn as a small circular photo of the spoon (or a 🥄 when
 *  there's no photo) — a divIcon, like the doing-stuff emoji pins, so Leaflet's
 *  bundler-hostile default image assets never load. Cached per URL: icons are
 *  immutable and this avoids a fresh DivIcon per marker per render. */
const iconCache = new Map<string, L.DivIcon>()
function spoonIcon(imageUrl: string): L.DivIcon {
  let icon = iconCache.get(imageUrl)
  if (!icon) {
    const ring = `width:44px;height:44px;border-radius:50%;border:2.5px solid ${ACCENT};background:#fff;overflow:hidden;box-shadow:0 2px 6px rgba(40,30,20,0.35);display:flex;align-items:center;justify-content:center`
    const inner = imageUrl
      ? // Public bucket / object URLs only — still keep quotes out of the attribute.
        `<img src="${imageUrl.replace(/"/g, '%22')}" style="width:100%;height:100%;object-fit:cover" alt=""/>`
      : `<div style="font-size:22px;line-height:1">${SPOON_EMOJI}</div>`
    icon = L.divIcon({
      html: `<div style="${ring}">${inner}</div>`,
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -24],
    })
    iconCache.set(imageUrl, icon)
  }
  return icon
}

/** Frames the collection once when the map opens: every pin in view, whether
 *  that's one city or three continents. Deliberately not re-run on edits —
 *  the view shouldn't yank while browsing (the map remounts on each visit to
 *  the Map screen, so new pins are framed next time). */
function FitToPins({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 })
  }, [map])
  return null
}

export function SpoonMap({
  markers,
  onEdit,
}: {
  markers: SpoonMarker[]
  onEdit: (spoon: Spoon) => void
}) {
  const bounds = markerBounds(markers)

  return (
    <>
      {markers.length === 0 && (
        <Text fz={13} c={colors.muted} mt={18} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
          No spoons on the map yet — give one a place and it'll pin itself here.
        </Text>
      )}

      <Box
        mt={20}
        style={{
          height: 'min(75vh, 950px)',
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 16,
          overflow: 'hidden',
          // Trap Leaflet's internal pane z-indexes in their own stacking
          // context so they can't paint over modals (see MapView).
          isolation: 'isolate',
        }}
      >
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <FitToPins bounds={bounds} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          {markers.map(({ spoon, lat, lng }) => (
            <Marker key={spoon.id} position={[lat, lng]} icon={spoonIcon(spoon.imageUrl)}>
              <Popup>
                <Box style={{ fontFamily: fonts.sans, width: 180 }}>
                  <Box mb={8} style={{ borderRadius: 10, overflow: 'hidden' }}>
                    <SpoonPhoto imageUrl={spoon.imageUrl} name={spoon.name} height={130} emojiSize={34} />
                  </Box>
                  <Text fz={15} fw={700} c={colors.ink} mb={2}>
                    {spoon.name}
                  </Text>
                  {spoon.place && (
                    <Text fz={12} c={colors.muted}>
                      {spoon.place}
                    </Text>
                  )}
                  {spoon.acquiredOn && (
                    <Text fz={11} c={colors.faint} mt={2} style={{ fontFamily: fonts.mono }}>
                      {formatDateWithYear(spoon.acquiredOn)}
                    </Text>
                  )}
                  {spoon.notes && (
                    <Text fz={12} c={colors.inkFaded} mt={6} lh={1.45}>
                      {spoon.notes}
                    </Text>
                  )}
                  <Button size="compact-xs" variant="default" radius={8} mt={8} onClick={() => onEdit(spoon)}>
                    Edit
                  </Button>
                </Box>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Box>
    </>
  )
}
