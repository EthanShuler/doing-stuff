import type { Session } from '@supabase/supabase-js'
import { Center } from '@mantine/core'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import type { Screen, TierKind } from './types'
import { useSession } from './data/useSession'
import { useSpace } from './data/useSpace'
import { colors, fonts } from './theme'
import { AppLayout } from './layout/AppLayout'
import { AuthScreen } from './components/AuthScreen'
import { ComingSoon } from './components/ComingSoon'
import { DoingStuffPage } from './features/doing-stuff/DoingStuffPage'
import { TierListPage } from './features/tier-list/TierListPage'

/** Full-screen centered message — used for loading and fatal errors. */
function Splash({ text }: { text: string }) {
  return (
    <Center mih="100vh" bg={colors.pageBg} c={colors.muted} p={24} ta="center" style={{ fontFamily: fonts.sans }}>
      {text}
    </Center>
  )
}

export default function App() {
  const { session, loading, configured } = useSession()

  // While the initial session resolves, hold the screen so we don't flash the
  // login form on a hard reload.
  if (configured && loading) {
    return <Splash text="Loading…" />
  }

  // No keys, or not logged in → show the auth screen. (Without keys, the
  // AuthScreen's calls are no-ops; configure .env.local to enable login.)
  if (configured && !session) {
    return <AuthScreen />
  }

  return <AuthedApp session={session} configured={configured} />
}

/** Post-login: resolve the shared space, then hand each feature its route.
 *  The shell (header + feature nav) wraps everything. */
function AuthedApp({ session, configured }: { session: Session | null; configured: boolean }) {
  const { spaceId, loading: spaceLoading, error: spaceError } = useSpace(session)
  const userId = session?.user.id ?? null

  if (configured && spaceError) {
    return <Splash text={`Couldn't load your space: ${spaceError}`} />
  }
  if (configured && spaceLoading) {
    return <Splash text="Loading your space…" />
  }

  // All four doing-stuff routes render the same component (same position in
  // the tree), so its store — and realtime channel — survive screen switches.
  const doingStuff = (screen: Screen) => (
    <DoingStuffPage screen={screen} spaceId={spaceId} userId={userId} configured={configured} />
  )

  // Same trick for the tier lists: /movies, /tv, and /books render one
  // component, so its store survives switching kinds — the board just
  // re-derives.
  const tierList = (kind: TierKind) => (
    <TierListPage kind={kind} spaceId={spaceId} userId={userId} configured={configured} />
  )

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={doingStuff('log')} />
          <Route path="/wishlist" element={doingStuff('wishlist')} />
          <Route path="/map" element={doingStuff('map')} />
          <Route path="/calendar" element={doingStuff('calendar')} />
          <Route path="/movies" element={tierList('movie')} />
          <Route path="/tv" element={tierList('tv')} />
          <Route path="/books" element={tierList('book')} />
          <Route
            path="/french-toast"
            element={<ComingSoon title="French toast" blurb="The definitive french toast ranking, coming soon." />}
          />
          <Route
            path="/parks"
            element={<ComingSoon title="National parks" blurb="Tracking the 63 together, coming soon." />}
          />
          <Route
            path="/spoons"
            element={<ComingSoon title="Spoon map" blurb="The souvenir spoon collection, mapped. Coming soon." />}
          />
          <Route
            path="/board-games"
            element={<ComingSoon title="Board games" blurb="The board game collection and rankings, coming soon." />}
          />
          <Route
            path="/ice-cream"
            element={<ComingSoon title="Ice cream" blurb="Local flavors, favorite pints, and where to find them. Coming soon." />}
          />
          <Route
            path="/recipes"
            element={<ComingSoon title="Recipes" blurb="The recipes we actually make, coming soon." />}
          />
          <Route
            path="/cats"
            element={<ComingSoon title="Cat photo wall" blurb="A wall of our cats. Coming soon." />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
