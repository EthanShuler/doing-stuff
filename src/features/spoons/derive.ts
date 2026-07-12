import type { Spoon } from '../../types'

// Pure data-shaping for the spoon collection — no React in here (same pattern
// as the doing-stuff and tier-list derive modules; covered by derive.test.ts).

/** Grid order: dated spoons newest first, undated ones after (newest logged
 *  first), so the collection reads as a timeline with the unknowns at the end. */
export function sortSpoons(spoons: Spoon[]): Spoon[] {
  return [...spoons].sort((a, b) => {
    if (a.acquiredOn && b.acquiredOn && a.acquiredOn !== b.acquiredOn) {
      return a.acquiredOn < b.acquiredOn ? 1 : -1
    }
    if (Boolean(a.acquiredOn) !== Boolean(b.acquiredOn)) return a.acquiredOn ? -1 : 1
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  })
}

/** One map pin. lat/lng may be nudged off the spoon's stored coords when
 *  several spoons share a place (see the fan-out below). */
export interface SpoonMarker {
  spoon: Spoon
  lat: number
  lng: number
}

// Same-place spoons geocode to identical coords and would stack into one
// unclickable pin. Fanned-out pins sit on a circle of this radius (degrees of
// latitude, ~40m) around the shared point — far enough apart to click at
// street zoom, close enough to read as "the same city" at country zoom.
const FAN_RADIUS = 0.00035

// Coords within ~11m (4 decimals) count as the same place — geocoding the
// same text twice can wobble slightly.
const coordKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`

/**
 * Map pins for every locatable spoon. Groups sharing (nearly) the same coords
 * fan out in a small circle so each photo pin stays individually visible and
 * clickable. Deterministic: groups are keyed by rounded coords and ordered by
 * the sort above, so the same data always yields the same pin layout.
 */
export function spoonMarkers(spoons: Spoon[]): SpoonMarker[] {
  const groups = new Map<string, Spoon[]>()
  for (const spoon of sortSpoons(spoons)) {
    if (spoon.lat === null || spoon.lng === null) continue
    const key = coordKey(spoon.lat, spoon.lng)
    const group = groups.get(key)
    if (group) group.push(spoon)
    else groups.set(key, [spoon])
  }

  const markers: SpoonMarker[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      const [spoon] = group
      markers.push({ spoon, lat: spoon.lat!, lng: spoon.lng! })
      continue
    }
    // Longitude degrees shrink with latitude — stretch by 1/cos so the fan
    // renders as a circle, not a squashed ellipse.
    const lngStretch = 1 / Math.max(0.2, Math.cos((group[0].lat! * Math.PI) / 180))
    group.forEach((spoon, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / group.length
      markers.push({
        spoon,
        lat: spoon.lat! + FAN_RADIUS * Math.sin(angle),
        lng: spoon.lng! + FAN_RADIUS * lngStretch * Math.cos(angle),
      })
    })
  }
  return markers
}

/** South-west / north-east corners enclosing every pin (Leaflet fitBounds
 *  input), or null when nothing is locatable yet. */
export function markerBounds(markers: SpoonMarker[]): [[number, number], [number, number]] | null {
  if (markers.length === 0) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const m of markers) {
    minLat = Math.min(minLat, m.lat)
    maxLat = Math.max(maxLat, m.lat)
    minLng = Math.min(minLng, m.lng)
    maxLng = Math.max(maxLng, m.lng)
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}
