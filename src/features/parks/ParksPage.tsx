import { lazy, Suspense, useMemo, useState } from 'react'
import { Button, Group, SegmentedControl, Select, Text } from '@mantine/core'
import { colors, fonts, text } from '../../theme'
import { ControlBar } from '../../components/ControlBar'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { Splash } from '../../components/Splash'
import { useParkStore } from './useParkStore'
import type { Park } from './parks'
import { PARKS } from './parks'
import type { GroupViewer, Member } from './derive'
import {
  buildMembers,
  EVERYONE,
  filterGroupParks,
  filterParks,
  isGroupSpace,
  parkStats,
  parkStatuses,
  TOGETHER,
  UNVISITED,
  VISITED,
} from './derive'
import { pickKeys, useTriFilter } from '../../lib/triFilter'
import type { DotVariant } from './StatusDot'
import { StatusDot, togetherVariant } from './StatusDot'

// Leaflet only ships to whoever opens the map (module scope — see the note
// in DoingStuffPage).
const ParkMap = lazy(() => import('./ParkMap').then((m) => ({ default: m.ParkMap })))
import { ParkList } from './ParkList'
import { ParkFilterPills } from './ParkFilterPills'
import { ParkModal } from './ParkModal'
import { LogVisitModal } from './LogVisitModal'

type Screen = 'map' | 'list'

function Stat({ variant, label }: { variant?: DotVariant; label: string }) {
  return (
    <Group gap={8} wrap="nowrap">
      {variant && <StatusDot variant={variant} />}
      <Text fz={text.small} fw={600} c={colors.inkSoft} style={{ fontFamily: fonts.sans, whiteSpace: 'nowrap' }}>
        {label}
      </Text>
    </Group>
  )
}

/** Group mode's whose-map picker: Everyone, then each member in join order.
 *  A segmented control while it fits (four choices), a Select beyond that. */
function ViewerPicker({
  members,
  value,
  onChange,
}: {
  members: Member[]
  value: GroupViewer
  onChange: (viewer: GroupViewer) => void
}) {
  const data = [
    { label: 'Everyone', value: EVERYONE },
    ...members.map((m) => ({ label: m.name || 'Member', value: m.id })),
  ]
  if (data.length <= 4) {
    return <SegmentedControl aria-label="Whose map" value={value} onChange={onChange} data={data} />
  }
  return (
    <Select
      aria-label="Whose map"
      data={data}
      value={value}
      onChange={(next) => onChange(next ?? EVERYONE)}
      allowDeselect={false}
      w={170}
    />
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

  // Group mode (3+ members): whose map is on screen. Page state, so it
  // survives the Map/List switch; a member who has left falls back to
  // Everyone rather than stranding an all-faint map.
  const group = isGroupSpace(store.memberIds)
  const [viewerPick, setViewerPick] = useState<GroupViewer>(EVERYONE)
  const viewer = store.memberIds.includes(viewerPick) ? viewerPick : EVERYONE

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

  // Status pills, shared by the map and the list. A member who has left the
  // space loses their pill, so their key is pruned rather than stranding a
  // filter nobody can see. Group mode has its own two keys (Visited /
  // Unvisited, read against the viewer); pruning to them drops the pair
  // mode's member/Together keys if the space grows past two, and back.
  const filter = useTriFilter()
  const activeFilter = pickKeys(
    filter.state,
    group ? [VISITED, UNVISITED] : [...store.memberIds, TOGETHER, UNVISITED],
  )
  const shownParks = useMemo(
    () =>
      group
        ? filterGroupParks(PARKS, statuses, viewer, activeFilter)
        : filterParks(PARKS, statuses, activeFilter),
    [group, statuses, viewer, activeFilter],
  )
  const filters = (
    <ParkFilterPills
      group={group}
      members={members}
      filter={activeFilter}
      onCycle={filter.cycle}
      onCycleBack={filter.cycleBack}
      onClear={filter.clear}
    />
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
              {group && <ViewerPicker members={members} value={viewer} onChange={setViewerPick} />}
              {/* The scoreboard: parks each member has set foot in — plus,
                  for one or two people, parks visited on the same trip. Group
                  mode drops Together and the person colors. */}
              {!loadingData && group && (
                <Group gap={16} wrap="wrap">
                  {members.map((m) => (
                    <Stat key={m.id} label={`${m.name || 'Member'} ${stats.perMember[m.id] ?? 0}/${stats.total}`} />
                  ))}
                </Group>
              )}
              {!loadingData && !group && (
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
            <ParkMap
              parks={shownParks}
              statuses={statuses}
              members={members}
              viewer={group ? viewer : null}
              filters={filters}
              onOpen={setDetailPark}
            />
          </Suspense>
        ) : (
          <ParkList
            parks={shownParks}
            statuses={statuses}
            members={members}
            viewer={group ? viewer : null}
            filters={filters}
            onOpen={setDetailPark}
          />
        )}
      </PageFrame>

      <ParkModal
        park={detailPark}
        visits={detailVisits}
        members={members}
        group={group}
        onAdd={store.addVisit}
        onUpdate={store.updateVisit}
        onDelete={store.deleteVisit}
        onClose={() => setDetailPark(null)}
      />

      <LogVisitModal
        opened={logOpen}
        members={members}
        group={group}
        onSave={store.addVisit}
        onClose={() => setLogOpen(false)}
      />
    </>
  )
}
