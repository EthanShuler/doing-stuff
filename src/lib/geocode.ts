// Address → coordinates via OpenStreetMap's free Nominatim API. No key, no
// server (called straight from the browser) — fits the app's Supabase-only,
// Cloudflare-Pages posture. We geocode on SAVE and store the resulting lat/lng
// on the row, so the map never geocodes at render time.
//
// Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/):
//   • max ~1 request/second  • identify yourself  • cache results.
// A two-person app that geocodes only when an address changes stays well inside
// this; callers MUST avoid geocoding on every keystroke.

export interface GeoPoint {
  lat: number
  lng: number
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

/**
 * Resolve a free-text address to a point. Returns null when the address is
 * blank, unmatched, or the request fails — callers treat null as "save the
 * address text but leave it off the map" (never throws, never blocks a save).
 */
export async function geocode(address: string): Promise<GeoPoint | null> {
  const query = address.trim()
  if (!query) return null

  try {
    // Ask for several candidates with address breakdowns. Nominatim often ranks
    // a vague street/area centroid above the exact building, so limit=1 would
    // grab the wrong point (and collide with other addresses on the same street);
    // we pick the best candidate ourselves below.
    const url = `${ENDPOINT}?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: {
        // Identify the app per Nominatim policy. (Browsers ignore a manual
        // User-Agent, but Referer is sent automatically; this is best-effort.)
        Accept: 'application/json',
      },
    })
    if (!res.ok) return null
    const results = (await res.json()) as Array<{
      lat: string
      lon: string
      address?: { house_number?: string }
    }>
    if (!results.length) return null
    // Prefer a candidate resolved to an actual house number (building-level);
    // fall back to Nominatim's top hit when none carry one.
    const best = results.find((r) => r.address?.house_number) ?? results[0]
    const point = { lat: Number(best.lat), lng: Number(best.lon) }
    if (Number.isNaN(point.lat) || Number.isNaN(point.lng)) return null
    return point
  } catch {
    return null
  }
}
