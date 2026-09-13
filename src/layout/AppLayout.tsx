import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { AppShell, Burger, Button, Group, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, useLocation } from 'react-router'
import { ACCENT, colors, fonts, radii, text } from '../theme'
import { supabase } from '../lib/supabase'
import { Splash } from '../components/Splash'

/** Top-level features behind the shell nav — one entry per feature, not one
 *  per route. Doing Stuff spans four routes and Tier Lists four kinds (an
 *  in-page picker chooses between them, see ListPicker); a match also claims
 *  its sub-paths (so /recipes/:id lights up Recipes — '/' is exempt or it
 *  would claim everything). The unbuilt placeholder routes (/french-toast,
 *  /board-games, /cats) still exist in App.tsx but are off the nav. */
const FEATURES = [
  { label: 'Doing Stuff', path: '/', matches: ['/', '/wishlist', '/map', '/calendar'] },
  { label: 'Tier Lists', path: '/movies', matches: ['/movies', '/tv', '/books', '/ice-cream', '/tiers'] },
  { label: 'Parks', path: '/parks', matches: ['/parks'] },
  { label: 'Spoons', path: '/spoons', matches: ['/spoons'] },
  { label: 'Little Guys', path: '/little-guys', matches: ['/little-guys'] },
  { label: 'Recipes', path: '/recipes', matches: ['/recipes'] },
  { label: 'Music Practice', path: '/music-practice', matches: ['/music-practice'] },
]

const isActive = (matches: string[], pathname: string) =>
  matches.some((m) => m === pathname || (m !== '/' && pathname.startsWith(`${m}/`)))

/** The persistent chrome: header with the site name, feature nav, and sign-out.
 *  Seven nav items need ~920px, so the drawer holds them until `md`. */
export function AppLayout({ children }: { children: ReactNode }) {
  const [navOpened, { toggle, close }] = useDisclosure(false)
  const { pathname } = useLocation()

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'md', collapsed: { desktop: true, mobile: !navOpened } }}
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
              hiddenFrom="md"
              size="sm"
              color={colors.muted}
              aria-label="Toggle navigation"
            />
            <Text
              component={Link}
              to="/"
              onClick={close}
              fz={19}
              fw={500}
              c={colors.ink}
              style={{
                fontFamily: fonts.serif,
                fontStyle: 'italic',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              cajubinile.com
            </Text>
            <Group gap={4} visibleFrom="md" wrap="nowrap">
              {FEATURES.map((feature) => (
                <FeatureLink
                  key={feature.path}
                  label={feature.label}
                  path={feature.path}
                  active={isActive(feature.matches, pathname)}
                  onNavigate={close}
                />
              ))}
            </Group>
          </Group>
          {supabase && (
            <Button variant="secondary" size="compact-sm" onClick={() => supabase!.auth.signOut()}>
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
            path={feature.path}
            active={isActive(feature.matches, pathname)}
            onNavigate={close}
            block
          />
        ))}
      </AppShell.Navbar>

      {/* The routes are lazy chunks (see App.tsx); the boundary lives here so
          the header/nav stay mounted while one loads. react-router wraps
          in-app navigations in a transition, so this fallback is really only
          seen on a hard load of a route. */}
      <AppShell.Main>
        <Suspense fallback={<Splash text="Loading…" mih="60vh" />}>{children}</Suspense>
      </AppShell.Main>
    </AppShell>
  )
}

function FeatureLink({
  label,
  path,
  active,
  onNavigate,
  block,
}: {
  label: string
  path: string
  active: boolean
  /** Closes the mobile drawer after a pick (a no-op on desktop). */
  onNavigate: () => void
  block?: boolean
}) {
  return (
    <UnstyledButton
      component={Link}
      to={path}
      onClick={onNavigate}
      px={block ? 12 : 11}
      py={block ? 10 : 6}
      style={{
        fontFamily: fonts.sans,
        fontSize: text.small,
        fontWeight: 600,
        color: active ? colors.ink : colors.muted,
        borderRadius: radii.chip,
        background: active ? colors.chip : 'transparent',
        boxShadow: active ? `inset 0 -2px 0 ${ACCENT}` : undefined,
        whiteSpace: 'nowrap',
        width: block ? '100%' : undefined,
        textAlign: block ? 'left' : undefined,
        textDecoration: 'none',
        display: 'block',
      }}
    >
      {label}
    </UnstyledButton>
  )
}
