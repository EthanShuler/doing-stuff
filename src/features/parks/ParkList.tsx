import type { ReactNode } from 'react'
import { Box, Group, Text, UnstyledButton } from '@mantine/core'
import { colors, fonts } from '../../theme'
import type { Park } from './parks'
import type { Member, ParkStatus } from './derive'
import { groupByRegion } from './derive'
import { StatusDot } from './StatusDot'

/** The region-grouped list of `parks` (already filtered by the page's pills). */
export function ParkList({
  parks,
  statuses,
  members,
  filters,
  onOpen,
}: {
  parks: Park[]
  statuses: Map<string, ParkStatus>
  members: Member[]
  /** The filter pill row, owned by the page so it survives the Map/List switch. */
  filters: ReactNode
  onOpen: (park: Park) => void
}) {
  const groups = groupByRegion(parks)

  return (
    <>
      {filters}

      {groups.length === 0 && (
        <Text fz={13} c={colors.muted} mt={24} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
          Nothing here yet.
        </Text>
      )}

      {groups.map(({ region, parks }) => (
        <Box key={region} mt={26}>
          <Text
            fz={11}
            fw={600}
            c={colors.muted}
            pb={8}
            style={{
              fontFamily: fonts.mono,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              borderBottom: `1px dotted ${colors.rule}`,
            }}
          >
            {region} · {parks.length}
          </Text>
          {parks.map((park) => {
            const status = statuses.get(park.code)
            const visited = (status?.visitorIds.length ?? 0) > 0
            return (
              <UnstyledButton
                key={park.code}
                onClick={() => onOpen(park)}
                w="100%"
                px={4}
                py={11}
                style={{ borderBottom: `1px dotted ${colors.dotted}` }}
              >
                <Group justify="space-between" gap={10} wrap="nowrap">
                  <Box style={{ minWidth: 0 }}>
                    <Text fz={15} fw={600} c={visited ? colors.ink : colors.inkFaded} truncate style={{ fontFamily: fonts.sans }}>
                      {park.name}
                    </Text>
                    <Text fz={12} c={colors.muted} style={{ fontFamily: fonts.sans }}>
                      {park.states} · est. {park.established}
                    </Text>
                  </Box>
                  <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                    {status && status.visits.length > 1 && (
                      <Text fz={12} c={colors.muted} style={{ fontFamily: fonts.mono }}>
                        ×{status.visits.length}
                      </Text>
                    )}
                    {status?.together && (
                      <Text
                        fz={11}
                        fw={600}
                        px={9}
                        py={3}
                        c={colors.onAccent}
                        style={{ background: colors.ink, borderRadius: 20, fontFamily: fonts.sans }}
                      >
                        together
                      </Text>
                    )}
                    {members
                      .filter((m) => status?.visitorIds.includes(m.id))
                      .map((m) => (
                        <StatusDot key={m.id} variant={{ kind: 'solid', color: m.color }} size={11} title={m.name} />
                      ))}
                    {!visited && <StatusDot variant={{ kind: 'faint' }} size={11} />}
                  </Group>
                </Group>
              </UnstyledButton>
            )
          })}
        </Box>
      ))}
    </>
  )
}
