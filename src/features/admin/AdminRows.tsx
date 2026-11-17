import type { ReactNode } from 'react'
import { Box, Group, Text, UnstyledButton } from '@mantine/core'
import { colors, fonts, radii, text } from '../../theme'
import {
  type AdminSpace,
  type AdminUser,
  featureSummary,
  lastSignInLabel,
  membersLine,
  spacesOfUser,
  userLabel,
} from './derive'
import { SpaceChip, WordTag } from './parts'

/** The bordered panel of dense rows both screens use. */
function RowPanel({ children }: { children: ReactNode }) {
  return (
    <Box
      mt={24}
      bg={colors.surface}
      style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: radii.card, overflow: 'hidden' }}
    >
      {children}
    </Box>
  )
}

function Row({ first, onClick, children }: { first: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <UnstyledButton
      onClick={onClick}
      w="100%"
      px={16}
      py={11}
      style={{ borderTop: first ? 'none' : `1px dotted ${colors.dotted}`, display: 'block' }}
    >
      {/* Wraps on a phone: the right-hand facts drop under the name. */}
      <Group justify="space-between" align="center" gap="6px 14px" wrap="wrap">
        {children}
      </Group>
    </UnstyledButton>
  )
}

/** People: name · tags, email under it; their spaces and last sign-in on the
 *  right. A row opens that person. */
export function PeopleList({
  users,
  spaces,
  onOpen,
}: {
  users: AdminUser[]
  spaces: AdminSpace[]
  onOpen: (user: AdminUser) => void
}) {
  return (
    <RowPanel>
      {users.map((user, index) => {
        const label = userLabel(user)
        const theirSpaces = spacesOfUser(user, spaces)
        return (
          <Row key={user.id} first={index === 0} onClick={() => onOpen(user)}>
            <Box miw={0} style={{ flex: '1 1 220px' }}>
              <Group gap={7} wrap="wrap" align="center">
                <Text fz={text.lead} fw={700} c={colors.ink} style={{ fontFamily: fonts.sans }}>
                  {label}
                </Text>
                {user.isAdmin && <WordTag>Admin</WordTag>}
                {!user.hasPassword && <WordTag strong>No password yet</WordTag>}
              </Group>
              <Text fz={text.caption} c={colors.muted} truncate style={{ fontFamily: fonts.sans }}>
                {user.email}
              </Text>
            </Box>
            <Group gap={6} wrap="wrap" align="center" style={{ flex: '0 1 auto' }}>
              {theirSpaces.length ? (
                theirSpaces.map((space) => <SpaceChip key={space.id}>{space.name}</SpaceChip>)
              ) : (
                <Text fz={text.caption} c={colors.faint} fs="italic">
                  No spaces
                </Text>
              )}
              <Text
                fz={text.caption}
                c={colors.faint}
                ml={4}
                style={{ fontFamily: fonts.mono, whiteSpace: 'nowrap' }}
                title="Last sign-in"
              >
                last in: {lastSignInLabel(user.lastSignInAt)}
              </Text>
            </Group>
          </Row>
        )
      })}
    </RowPanel>
  )
}

/** Spaces: name, members under it; the feature summary on the right. A row
 *  opens the space. */
export function SpaceList({
  spaces,
  users,
  onOpen,
}: {
  spaces: AdminSpace[]
  users: AdminUser[]
  onOpen: (space: AdminSpace) => void
}) {
  return (
    <RowPanel>
      {spaces.map((space, index) => (
        <Row key={space.id} first={index === 0} onClick={() => onOpen(space)}>
          <Box miw={0} style={{ flex: '1 1 220px' }}>
            <Text fz={text.lead} fw={700} c={colors.ink} style={{ fontFamily: fonts.sans }}>
              {space.name}
            </Text>
            <Text fz={text.caption} c={colors.muted} style={{ fontFamily: fonts.sans }}>
              {membersLine(space, users)}
            </Text>
          </Box>
          <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.mono, whiteSpace: 'nowrap' }}>
            {featureSummary(space.enabledFeatures)}
          </Text>
        </Row>
      ))}
    </RowPanel>
  )
}
