import { Box, Button, Text } from '@mantine/core'
import { Marker, Popup } from 'react-leaflet'
import type L from 'leaflet'
import type { Spoon } from '../../types'
import type { SpoonMarker } from './derive'
import { markerBounds } from './derive'
import { ACCENT, colors, fonts } from '../../theme'
import { formatDateWithYear } from '../../lib/format'
import { FitToPins, MapCanvas, cachedDivIcon } from '../../components/MapCanvas'
import { SPOON_EMOJI, SpoonPhoto } from './SpoonGrid'

/** A Leaflet marker drawn as a small circular photo of the spoon (or a 🥄 when
 *  there's no photo) — a divIcon, like the doing-stuff emoji pins, so Leaflet's
 *  bundler-hostile default image assets never load. */
function spoonIcon(imageUrl: string): L.DivIcon {
  return cachedDivIcon(`spoon:${imageUrl}`, () => {
    const ring = `width:44px;height:44px;border-radius:50%;border:2.5px solid ${ACCENT};background:#fff;overflow:hidden;box-shadow:0 2px 6px rgba(40,30,20,0.35);display:flex;align-items:center;justify-content:center`
    const inner = imageUrl
      ? // Public bucket / object URLs only — still keep quotes out of the attribute.
        `<img src="${imageUrl.replace(/"/g, '%22')}" style="width:100%;height:100%;object-fit:cover" alt=""/>`
      : `<div style="font-size:22px;line-height:1">${SPOON_EMOJI}</div>`
    return {
      html: `<div style="${ring}">${inner}</div>`,
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -24],
    }
  })
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

      <MapCanvas>
        <FitToPins bounds={bounds} />
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
      </MapCanvas>
    </>
  )
}
