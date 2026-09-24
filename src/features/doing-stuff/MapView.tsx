import { Box, Button, Text } from '@mantine/core'
import { Marker, Popup } from 'react-leaflet'
import { useState } from 'react'
import type { Activity, Category, Home } from '../../types'
import type { EntryFilter, MapMarker } from './derive'
import { entryFilterActive, entryMatcher, NO_ENTRY_FILTER, pruneEntryFilter } from './derive'
import type { CycleDirection, TriFilterState } from '../../lib/triFilter'
import { cycleTri } from '../../lib/triFilter'
import { ACCENT, colors, fonts } from '../../theme'
import { formatDate, stars } from '../../lib/format'
import { TriPill } from '../../components/Pill'
import { CategoryPills } from './CategoryPills'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MapCanvas, Recenter, emojiIcon } from '../../components/MapCanvas'

interface MapViewProps {
  home: Home
  categories: Category[]
  activities: Activity[]
  markers: MapMarker[]
  /** Open the entry modal for the entry behind a pin. */
  onEditEntry: (id: string) => void
}

const PLACE_ZOOM = 13

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
}

export function MapView({ home, categories, activities, markers, onEditEntry }: MapViewProps) {
  // Only show categories that actually have pins on the map, so the filter row
  // doesn't list empty categories.
  const shownIds = new Set(markers.filter((m) => m.kind === 'entry').map((m) => m.categoryId))
  const shownCategories = categories.filter((c) => shownIds.has(c.id))
  const pinnedActivityIds = new Set(markers.filter((m) => m.kind === 'entry').map((m) => m.activityId))
  const pinnedActivities = activities.filter((a) => pinnedActivityIds.has(a.id))
  const hasWishes = markers.some((m) => m.kind === 'wish')

  // Map-local filter: the category/activity pills plus a Wishlist pill. Kept
  // here (not in the shared dashboard filter) because the Wishlist pill is
  // map-specific. Pills whose pins are gone (category deleted, last pinned
  // entry removed or hidden) are pruned, so a stale include can't strand an
  // empty map with its pill missing.
  const [rawFilter, setFilter] = useState<EntryFilter>(NO_ENTRY_FILTER)
  const [wishFilter, setWishFilter] = useState<TriFilterState>({})
  const filter = pruneEntryFilter(rawFilter, shownCategories, pinnedActivities)
  const wish = hasWishes ? wishFilter.wishlist : undefined
  const match = entryMatcher(filter, activities)
  const categoryIncludes = Object.values(filter.categories).includes('include')

  // Includes are OR across both halves: with only Wishlist included the entry
  // pins hide, with only categories included the ⭐ pins do.
  const visibleMarkers = markers.filter((m) =>
    m.kind === 'wish'
      ? wish === 'include' || (wish === undefined && !categoryIncludes)
      : match(m.categoryId, m.activityId) && (categoryIncludes || wish !== 'include'),
  )
  const clearFilter = () => {
    setFilter(NO_ENTRY_FILTER)
    setWishFilter({})
  }
  const cycleWish = (direction: CycleDirection) => setWishFilter((prev) => cycleTri(prev, 'wishlist', direction))

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
        <CategoryPills
          categories={shownCategories}
          activities={pinnedActivities}
          filter={filter}
          onChange={setFilter}
          allActive={!entryFilterActive(filter) && wish === undefined}
          onClear={clearFilter}
          mt={20}
        >
          {hasWishes && (
            <TriPill
              label="Wishlist"
              state={wish}
              activeBg={ACCENT}
              dot={ACCENT}
              onCycle={() => cycleWish('forward')}
              onCycleBack={() => cycleWish('back')}
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
