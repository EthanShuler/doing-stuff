import { Box, Button, Text, UnstyledButton } from '@mantine/core'
import { Link } from 'react-router'
import { EmptyCard } from '../components/EmptyCard'
import { PageFrame } from '../components/PageFrame'
import { useSpaceContext } from '../data/useSpace'
import { colors, fonts, text } from '../theme'

/** The landing page (`/`): an index of the current space's features, so any
 *  of them is a single tap from home — on a phone the header nav is otherwise
 *  behind the burger. No store, nothing to load. Two columns of ruled rows on
 *  a wide screen, one on a phone. A space with no features (or the admin in
 *  no space) gets an empty state instead. */
export function HomePage() {
  const { current, features, isAdmin } = useSpaceContext()

  if (features.length === 0) {
    const title = current ? 'Nothing here yet' : 'You’re not in a space yet'
    const blurb = current
      ? isAdmin
        ? 'This space has no features turned on. Pick some on the Admin page.'
        : 'This space has no features turned on yet. Ask Ethan to add some.'
      : 'Add yourself to a space on the Admin page.'
    return (
      <PageFrame maw={900}>
        <title>cajubinile.com</title>
        <EmptyCard mt={0} title={title} blurb={blurb}>
          {isAdmin && (
            <Button component={Link} to="/admin" variant="secondary">
              Open Admin
            </Button>
          )}
        </EmptyCard>
      </PageFrame>
    )
  }

  return (
    <PageFrame maw={900}>
      <title>cajubinile.com</title>
      <Box
        component="nav"
        aria-label="Features"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          columnGap: 48,
        }}
      >
        {features.map((f) => (
          <UnstyledButton
            key={f.path}
            component={Link}
            to={f.path}
            py={13}
            style={{
              borderBottom: `1px dotted ${colors.rule}`,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
            }}
          >
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text fz={22} fw={500} c={colors.ink} lh={1.15} style={{ fontFamily: fonts.serif }}>
                {f.label}
              </Text>
              <Text mt={2} fz={text.small} c={colors.muted} lh={1.3}>
                {f.blurb}
              </Text>
            </Box>
            <Text fz={18} c={colors.faint} aria-hidden>
              →
            </Text>
          </UnstyledButton>
        ))}
      </Box>
    </PageFrame>
  )
}
