import { Box, Text, UnstyledButton } from '@mantine/core'
import { Link } from 'react-router'
import { PageFrame } from '../components/PageFrame'
import { colors, fonts, text } from '../theme'
import { FEATURES } from './features'

/** The landing page (`/`): an index of the features, so any of them is a
 *  single tap from home — on a phone the header nav is otherwise behind the
 *  burger. Static: no store, no data, nothing to load. Two columns of ruled
 *  rows on a wide screen, one on a phone. */
export function HomePage() {
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
        {FEATURES.map((f) => (
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
