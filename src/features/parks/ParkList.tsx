import { useState } from 'react'
import { Box, Group, Text, UnstyledButton } from '@mantine/core'
import { colors, fonts } from '../../theme'
import { Pill } from '../../components/Pill'
import type { Park } from './parks'
import { PARKS } from './parks'
import type { Member, ParkFilter, ParkStatus } from './derive'
import { filterParks, groupByRegion } from './derive'

/** Pill row value: 'all' | 'together' | 'unvisited' | a member id. */
type FilterValue = string

function toFilter(value: FilterValue): ParkFilter {
  if (value === 'all' || value === 'together' || value === 'unvisited') return value
  return { memberId: value }
}

export function ParkList({
  statuses,
  members,
  onOpen,
}: {
  statuses: Map<string, ParkStatus>
  members: Member[]
  onOpen: (park: Park) => void
}) {
  const [filter, setFilter] = useState<FilterValue>('all')
  const groups = groupByRegion(filterParks(PARKS, statuses, toFilter(filter)))

  return (
    <>
      {/* STATUS FILTER */}
      <Group gap={8} mt={20} wrap="wrap">
        <Pill label="All" active={filter === 'all'} activeBg={colors.ink} onClick={() => setFilter('all')} />
        {members.map((m) => (
          <Pill
            key={m.id}
            label={m.name || 'Member'}
            active={filter === m.id}
            activeBg={m.color}
            dotColor={filter === m.id ? '#fff' : m.color}
            onClick={() => setFilter(m.id)}
          />
        ))}
        {members.length > 1 && (
          <Pill
            label="Together"
            active={filter === 'together'}
            activeBg={colors.ink}
            onClick={() => setFilter('together')}
          />
        )}
        <Pill
          label="Unvisited"
          active={filter === 'unvisited'}
          activeBg={colors.muted}
          onClick={() => setFilter('unvisited')}
        />
      </Group>

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
                        c="#fff"
                        style={{ background: colors.ink, borderRadius: 20, fontFamily: fonts.sans }}
                      >
                        together
                      </Text>
                    )}
                    {members
                      .filter((m) => status?.visitorIds.includes(m.id))
                      .map((m) => (
                        <Box key={m.id} w={11} h={11} title={m.name} style={{ borderRadius: '50%', background: m.color }} />
                      ))}
                    {!visited && (
                      <Box w={11} h={11} style={{ borderRadius: '50%', background: colors.faint, opacity: 0.45 }} />
                    )}
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
