import { Box, Button, Text } from '@mantine/core'
import { Marker, Popup } from 'react-leaflet'
import { useState } from 'react'
import type { Category, Home } from '../../types'
import type { MapMarker } from './derive'
import { ACCENT, colors, fonts } from '../../theme'
import { formatDate, stars } from '../../lib/format'
import { Pill } from '../../components/Pill'
import { CategoryPills } from '../../components/CategoryPills'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MapCanvas, Recenter, emojiIcon } from '../../components/MapCanvas'

interface MapViewProps {
  home: Home
  categories: Category[]
  markers: MapMarker[]
  /** Open the entry modal for the entry behind a pin. */
  onEditEntry: (id: string) => void
}

/** Map filter: 'all', a category id (entry pins), or 'wishlist' (⭐ pins). */
type MapFilter = string

const PLACE_ZOOM = 13

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
}

export function MapView({ home, categories, markers, onEditEntry }: MapViewProps) {
  // Only show categories that actually have pins on the map, so the filter row
  // doesn't list empty categories.
  const shownIds = new Set(markers.filter((m) => m.kind === 'entry').map((m) => m.categoryId))
  const shownCategories = categories.filter((c) => shownIds.has(c.id))
  const hasWishes = markers.some((m) => m.kind === 'wish')

  // Map-local filter: 'all', a category id, or 'wishlist'. Kept here (not in
  // the shared dashboard filter) because 'wishlist' is map-specific. A filter
  // whose pins are gone (category deleted, last pinned entry removed or
  // hidden) would strand an empty map with its pill missing — fall back to
  // 'all' whenever the selection no longer appears in the pill row.
  const [rawFilter, setFilter] = useState<MapFilter>('all')
  const filter =
    rawFilter === 'all' ||
    (rawFilter === 'wishlist' && hasWishes) ||
    shownCategories.some((c) => c.id === rawFilter)
      ? rawFilter
      : 'all'

  const visibleMarkers =
    filter === 'all'
      ? markers
      : filter === 'wishlist'
        ? markers.filter((m) => m.kind === 'wish')
        : markers.filter((m) => m.kind === 'entry' && m.categoryId === filter)

  const hasHome = home.lat !== null && home.lng !== null
  const center: [number, number] = hasHome
    ? [home.lat as number, home.lng as number]
    : visibleMarkers.length > 0
      ? [visibleMarkers[0].lat, visibleMarkers[0].lng]
      : DEFAULT_CENTER
  const zoom = hasHome || visibleMarkers.length > 0 ? PLACE_ZOOM : DEFAULT_ZOOM

  return (
    <>
      {!hasHome && (
        <Text fz={13} c={colors.muted} mt={18} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
          Set a home base under <strong>Manage</strong> to center the map on your city.
        </Text>
      )}

      {/* CATEGORY / WISHLIST FILTER */}
      {(shownCategories.length > 0 || hasWishes) && (
        <CategoryPills categories={shownCategories} value={filter} onChange={setFilter} mt={20}>
          {hasWishes && (
            <Pill
              label="Wishlist"
              active={filter === 'wishlist'}
              activeBg={ACCENT}
              dotColor={filter === 'wishlist' ? '#fff' : ACCENT}
              onClick={() => setFilter('wishlist')}
            />
          )}
        </CategoryPills>
      )}

      {/* MAP */}
      <MapCanvas center={center} zoom={zoom}>
        <Recenter center={center} zoom={zoom} />
        {hasHome && <Marker position={[home.lat as number, home.lng as number]} icon={emojiIcon('🏠')} />}
        {visibleMarkers.map((m) => {
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
      </MapCanvas>
    </>
  )
}
