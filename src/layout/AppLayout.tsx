import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { AppShell, Burger, Button, Group, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, useLocation } from 'react-router'
import { ACCENT, colors, fonts, radii, text } from '../theme'
import { supabase } from '../lib/supabase'
import { Splash } from '../components/Splash'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { FEATURES, isActive } from './features'

/** The persistent chrome: header with the site name, feature nav, and sign-out.
 *  The ten nav items need ~950px, plus the brand and, live, Sign out — past
 *  `md` (992px) once Alignment made it ten — so the drawer holds them until
 *  `lg` (1200px). */
export function AppLayout({ children }: { children: ReactNode }) {
  const [navOpened, { toggle, close }] = useDisclosure(false)
  const { pathname } = useLocation()

  return (
    // Safe areas: index.html sets viewport-fit=cover, so on a phone (and
    // above all as a home-screen app) the page runs under the notch, the
    // home indicator and — in landscape — the side cutouts. The header grows
    // by the top inset and pads it away; main and the drawer pad the rest.
    // Every env() is 0 in a normal desktop browser, so nothing moves there.
    <AppShell
      header={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      navbar={{ width: 220, breakpoint: 'lg', collapsed: { desktop: true, mobile: !navOpened } }}
      padding={0}
      styles={{
        header: {
          background: colors.pageBg,
          borderBottom: `1px dotted ${colors.dotted}`,
          paddingTop: 'env(safe-area-inset-top)',
        },
        navbar: {
          background: colors.pageBg,
          borderRight: `1px dotted ${colors.dotted}`,
          padding: 14,
          paddingLeft: 'max(14px, env(safe-area-inset-left))',
          paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
        },
        // The navbar never offsets main (collapsed on desktop, an overlay
        // below lg), so these side paddings don't fight Mantine's own.
        main: {
          background: colors.pageBg,
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
      }}
    >
      <AppShell.Header>
        <Group
          h="100%"
          justify="space-between"
          wrap="nowrap"
          style={{
            paddingLeft: 'max(20px, env(safe-area-inset-left))',
            paddingRight: 'max(20px, env(safe-area-inset-right))',
          }}
        >
          <Group gap={20} wrap="nowrap">
            <Burger
              opened={navOpened}
              onClick={toggle}
              hiddenFrom="lg"
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
            <Group gap={4} visibleFrom="lg" wrap="nowrap">
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
      <AppShell.Navbar>
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
          seen on a hard load of a route. The error boundary sits outside it
          for the same reason: a page that throws (or a chunk that fails to
          load) keeps the shell, and navigating away resets it. */}
      <AppShell.Main>
        <ErrorBoundary resetKey={pathname} mih="60vh">
          <Suspense fallback={<Splash text="Loading…" mih="60vh" />}>{children}</Suspense>
        </ErrorBoundary>
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
