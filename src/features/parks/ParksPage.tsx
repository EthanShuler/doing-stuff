import { lazy, Suspense, useMemo, useState } from 'react'
import { Button, Group, SegmentedControl, Text } from '@mantine/core'
import { colors, fonts, text } from '../../theme'
import { ControlBar } from '../../components/ControlBar'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { Splash } from '../../components/Splash'
import { useParkStore } from './useParkStore'
import type { Park } from './parks'
import { PARKS } from './parks'
import { buildMembers, parkStats, parkStatuses } from './derive'
import type { DotVariant } from './StatusDot'
import { StatusDot, togetherVariant } from './StatusDot'

// Leaflet only ships to whoever opens the map (module scope — see the note
// in DoingStuffPage).
const ParkMap = lazy(() => import('./ParkMap').then((m) => ({ default: m.ParkMap })))
import { ParkList } from './ParkList'
import { ParkModal } from './ParkModal'
import { LogVisitModal } from './LogVisitModal'

type Screen = 'map' | 'list'

function Stat({ variant, label }: { variant: DotVariant; label: string }) {
  return (
    <Group gap={8} wrap="nowrap">
      <StatusDot variant={variant} />
      <Text fz={text.small} fw={600} c={colors.inkSoft} style={{ fontFamily: fonts.sans, whiteSpace: 'nowrap' }}>
        {label}
      </Text>
    </Group>
  )
}

/** The 63-national-parks tracker: all of them on a map (or a region-grouped
 *  list), colored by who's been, with per-trip logging. One route (/parks)
 *  with an in-page screen toggle — the store survives the switch. */
export function ParksPage({
  spaceId,
  userId,
  configured,
}: {
  spaceId: string | null
  userId: string | null
  configured: boolean
}) {
  const store = useParkStore(spaceId, userId)
  const [screen, setScreen] = useState<Screen>('map')

  const [detailPark, setDetailPark] = useState<Park | null>(null)
  const [logOpen, setLogOpen] = useState(false)

  const members = useMemo(
    () => buildMembers(store.memberIds, store.profiles),
    [store.memberIds, store.profiles],
  )
  const statuses = useMemo(
    () => parkStatuses(store.visits, store.memberIds),
    [store.visits, store.memberIds],
  )
  const stats = useMemo(
    () => parkStats(statuses, store.memberIds, PARKS.length),
    [statuses, store.memberIds],
  )

  const detailVisits = useMemo(
    () => (detailPark ? store.visits.filter((v) => v.parkCode === detailPark.code) : []),
    [store.visits, detailPark],
  )

  // The scoreboard is derived from the visits, so it waits with the content
  // rather than flashing an honest-looking 0/63.
  const loadingData = configured && store.loading

  return (
    <>
      <title>Parks · cajubinile.com</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <PageFrame>
        <ControlBar
          left={
            <>
              <SegmentedControl
                value={screen}
                onChange={(value) => setScreen(value as Screen)}
                data={[
                  { label: 'Map', value: 'map' },
                  { label: 'List', value: 'list' },
                ]}
              />
              {/* The scoreboard: parks each of you has set foot in, and parks
                  you've been to on the same trip. */}
              {!loadingData && (
                <Group gap={16} wrap="wrap">
                  {members.map((m) => (
                    <Stat
                      key={m.id}
                      variant={{ kind: 'solid', color: m.color }}
                      label={`${m.name || 'Member'} ${stats.perMember[m.id] ?? 0}/${stats.total}`}
                    />
                  ))}
                  {members.length > 1 && (
                    <Stat variant={togetherVariant(members)} label={`Together ${stats.together}/${stats.total}`} />
                  )}
                </Group>
              )}
            </>
          }
          right={<Button onClick={() => setLogOpen(true)}>+ Log visit</Button>}
        />

        {loadingData ? (
          <Splash text="Loading your space…" mih="40vh" />
        ) : screen === 'map' ? (
          <Suspense fallback={<Splash text="Loading the map…" mih="50vh" />}>
            <ParkMap statuses={statuses} members={members} onOpen={setDetailPark} />
          </Suspense>
        ) : (
          <ParkList statuses={statuses} members={members} onOpen={setDetailPark} />
        )}
      </PageFrame>

      <ParkModal
        park={detailPark}
        visits={detailVisits}
        members={members}
        onAdd={store.addVisit}
        onUpdate={store.updateVisit}
        onDelete={store.deleteVisit}
        onClose={() => setDetailPark(null)}
      />

      <LogVisitModal
        opened={logOpen}
        members={members}
        onSave={store.addVisit}
        onClose={() => setLogOpen(false)}
      />
    </>
  )
}
