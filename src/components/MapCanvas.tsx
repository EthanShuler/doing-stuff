import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Box } from '@mantine/core'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { colors } from '../theme'

// Shared Leaflet primitives for every feature map (doing-stuff, spoons, parks):
// the framed map container with the CARTO Voyager tiles, the two camera
// helpers, and a divIcon cache. Each feature keeps its own markers, popups,
// and derive logic — only the repeated plumbing lives here.

/** Fallback framing when nothing better is known: the continental US, zoomed
 *  out far enough to read as "the whole country". */
export const DEFAULT_CENTER: [number, number] = [39.5, -98.35]
export const DEFAULT_ZOOM = 4

/**
 * The app's map frame: bordered rounded box + MapContainer + tile layer.
 * `center`/`zoom` are the initial camera only (Leaflet ignores later changes) —
 * pass `<Recenter>` or `<FitToPins>` as children to move it afterwards.
 */
export function MapCanvas({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  children,
}: {
  center?: [number, number]
  zoom?: number
  children: ReactNode
}) {
  return (
    <Box
      mt={20}
      style={{
        height: 'min(75vh, 950px)',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 16,
        overflow: 'hidden',
        // Trap Leaflet's internal pane z-indexes (up to ~700) in their own
        // stacking context so they can't paint over modals (which portal to
        // <body>); without this, modals open behind the map.
        isolation: 'isolate',
      }}
    >
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        {children}
      </MapContainer>
    </Box>
  )
}

/** Keeps the map centered as the resolved center changes (e.g. home is set
 *  while the map is open). Recenters only when the coordinates actually move. */
export function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [map, center[0], center[1], zoom])
  return null
}

/** Frames a set of pins once when the map opens: every pin in view, whether
 *  that's one city or three continents. Deliberately not re-run on edits —
 *  the view shouldn't yank while browsing (feature maps remount on each visit
 *  to their screen, so new pins are framed next time). */
export function FitToPins({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 })
  }, [map])
  return null
}

// DivIcons are immutable, so every feature caches them by key — this avoids
// allocating a fresh L.DivIcon per marker per render. One shared cache, with
// callers prefixing their keys by convention (the html itself is the key).
const iconCache = new Map<string, L.DivIcon>()

/** Build (or reuse) a divIcon for `key`. `make` runs only on a cache miss. */
export function cachedDivIcon(key: string, make: () => L.DivIconOptions): L.DivIcon {
  let icon = iconCache.get(key)
  if (!icon) {
    icon = L.divIcon(make())
    iconCache.set(key, icon)
  }
  return icon
}

/** A Leaflet marker drawn as a plain emoji (avoids Leaflet's default image
 *  assets, which break under bundlers, and lets pins carry activity icons). */
export function emojiIcon(emoji: string): L.DivIcon {
  return cachedDivIcon(`emoji:${emoji}`, () => ({
    html: `<div style="font-size:26px;line-height:1;text-align:center;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35))">${emoji}</div>`,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -28],
  }))
}
