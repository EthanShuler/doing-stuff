import type { ReactNode } from 'react'
import { AppShell, Burger, Button, Group, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useLocation, useNavigate } from 'react-router'
import { ACCENT, colors, fonts } from '../theme'
import { supabase } from '../lib/supabase'

/** Top-level features behind the shell nav. Doing Stuff spans four routes;
 *  a match also claims its sub-paths (so /recipes/:id lights up Recipes —
 *  '/' is exempt or it would claim everything). */
const FEATURES = [
  { label: 'Doing Stuff', path: '/', matches: ['/', '/wishlist', '/map', '/calendar'] },
  { label: 'Movies', path: '/movies', matches: ['/movies'] },
  { label: 'TV', path: '/tv', matches: ['/tv'] },
  { label: 'Books', path: '/books', matches: ['/books'] },
  { label: 'French Toast', path: '/french-toast', matches: ['/french-toast'] },
  { label: 'Parks', path: '/parks', matches: ['/parks'] },
  { label: 'Spoons', path: '/spoons', matches: ['/spoons'] },
  { label: 'Board Games', path: '/board-games', matches: ['/board-games'] },
  { label: 'Ice Cream', path: '/ice-cream', matches: ['/ice-cream'] },
  { label: 'Recipes', path: '/recipes', matches: ['/recipes'] },
  { label: 'Cats', path: '/cats', matches: ['/cats'] },
]

const isActive = (matches: string[], pathname: string) =>
  matches.some((m) => m === pathname || (m !== '/' && pathname.startsWith(`${m}/`)))

/** The persistent chrome: header with the site name, feature nav, and sign-out.
 *  On phones the nav collapses into a burger-toggled drawer. */
export function AppLayout({ children }: { children: ReactNode }) {
  const [navOpened, { toggle, close }] = useDisclosure(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const go = (path: string) => {
    navigate(path)
    close()
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { desktop: true, mobile: !navOpened } }}
      padding={0}
      styles={{
        header: { background: colors.pageBg, borderBottom: `1px dotted ${colors.dotted}` },
        navbar: { background: colors.pageBg, borderRight: `1px dotted ${colors.dotted}` },
        main: { background: colors.pageBg },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px={20} justify="space-between" wrap="nowrap">
          <Group gap={20} wrap="nowrap">
            <Burger
              opened={navOpened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color={colors.muted}
              aria-label="Toggle navigation"
            />
            <Text
              fz={19}
              fw={500}
              c={colors.ink}
              style={{ fontFamily: fonts.serif, fontStyle: 'italic', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}
            >
              cajubinile.com
            </Text>
            <Group gap={4} visibleFrom="sm" wrap="nowrap">
              {FEATURES.map((feature) => (
                <FeatureLink
                  key={feature.path}
                  label={feature.label}
                  active={isActive(feature.matches, pathname)}
                  onClick={() => go(feature.path)}
                />
              ))}
            </Group>
          </Group>
          {supabase && (
            <Button
              variant="subtle"
              onClick={() => supabase!.auth.signOut()}
              fz={12}
              fw={600}
              radius={9}
              px={10}
              c={colors.muted}
            >
              Sign out
            </Button>
          )}
        </Group>
      </AppShell.Header>

      {/* Mobile-only feature nav (hidden on desktop via collapsed above). */}
      <AppShell.Navbar p={14}>
        {FEATURES.map((feature) => (
          <FeatureLink
            key={feature.path}
            label={feature.label}
            active={isActive(feature.matches, pathname)}
            onClick={() => go(feature.path)}
            block
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}

function FeatureLink({
  label,
  active,
  onClick,
  block,
}: {
  label: string
  active: boolean
  onClick: () => void
  block?: boolean
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      px={block ? 12 : 11}
      py={block ? 10 : 6}
      style={{
        fontFamily: fonts.sans,
        fontSize: 13,
        fontWeight: 600,
        color: active ? colors.ink : colors.muted,
        borderRadius: 9,
        background: active ? colors.chip : 'transparent',
        boxShadow: active ? `inset 0 -2px 0 ${ACCENT}` : undefined,
        whiteSpace: 'nowrap',
        width: block ? '100%' : undefined,
        textAlign: block ? 'left' : undefined,
      }}
    >
      {label}
    </UnstyledButton>
  )
}
