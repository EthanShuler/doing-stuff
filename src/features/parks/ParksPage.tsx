import { useMemo, useState } from 'react'
import { Box, Button, Group, SegmentedControl, Text } from '@mantine/core'
import { colors, fonts } from '../../theme'
import { FloatingBanner } from '../../components/FloatingBanner'
import { Splash } from '../../components/Splash'
import { useParkStore } from './useParkStore'
import type { Park } from './parks'
import { PARKS } from './parks'
import { buildMembers, parkStats, parkStatuses } from './derive'
import type { DotVariant } from './StatusDot'
import { StatusDot, togetherVariant } from './StatusDot'
import { ParkMap } from './ParkMap'
import { ParkList } from './ParkList'
import { ParkModal } from './ParkModal'
import { LogVisitModal } from './LogVisitModal'

type Screen = 'map' | 'list'

function Stat({ variant, label }: { variant: DotVariant; label: string }) {
  return (
    <Group gap={8} wrap="nowrap">
      <StatusDot variant={variant} />
      <Text fz={13} fw={600} c={colors.inkSoft} style={{ fontFamily: fonts.sans, whiteSpace: 'nowrap' }}>
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

  if (configured && store.loading) {
    return <Splash text="Loading your space…" mih="60vh" />
  }

  return (
    <>
      <title>Parks · cajubinile.com</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        <Box maw={1200} mx="auto">
          <Group
            justify="space-between"
            align="center"
            gap={12}
            wrap="wrap"
            pb={18}
            style={{ borderBottom: `1px dotted ${colors.rule}` }}
          >
            <Group gap={18} wrap="wrap">
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
            </Group>
            <Button onClick={() => setLogOpen(true)} radius={10}>
              + Log visit
            </Button>
          </Group>

          {screen === 'map' ? (
            <ParkMap statuses={statuses} members={members} onOpen={setDetailPark} />
          ) : (
            <ParkList statuses={statuses} members={members} onOpen={setDetailPark} />
          )}
        </Box>
      </Box>

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
