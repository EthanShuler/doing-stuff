import { lazy } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import type { Screen, TierKind } from './types'
import { useSession } from './data/useSession'
import { useSpace } from './data/useSpace'
import { AppLayout } from './layout/AppLayout'
import { AuthScreen } from './components/AuthScreen'
import { ComingSoon } from './components/ComingSoon'
import { Splash } from './components/Splash'

// Each feature is its own async chunk, so a hard load of / doesn't ship the
// tier boards, the maps, or dnd-kit. These MUST stay at module scope: a
// lazy() call inside the component would mint a new component type on every
// render, remounting the page (and its store + realtime channel) constantly.
// AppLayout holds the Suspense boundary, so the shell never unmounts.
const DoingStuffPage = lazy(() =>
  import('./features/doing-stuff/DoingStuffPage').then((m) => ({ default: m.DoingStuffPage })),
)
const TierListPage = lazy(() =>
  import('./features/tier-list/TierListPage').then((m) => ({ default: m.TierListPage })),
)
const ListsPage = lazy(() => import('./features/lists/ListsPage').then((m) => ({ default: m.ListsPage })))
const SpoonsPage = lazy(() => import('./features/spoons/SpoonsPage').then((m) => ({ default: m.SpoonsPage })))
const ParksPage = lazy(() => import('./features/parks/ParksPage').then((m) => ({ default: m.ParksPage })))
const RecipesPage = lazy(() => import('./features/recipes/RecipesPage').then((m) => ({ default: m.RecipesPage })))
const MusicPracticePage = lazy(() =>
  import('./features/music-practice/MusicPracticePage').then((m) => ({ default: m.MusicPracticePage })),
)
const LittleGuysPage = lazy(() =>
  import('./features/little-guys/LittleGuysPage').then((m) => ({ default: m.LittleGuysPage })),
)

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

  // Same trick for the tier lists: /movies, /tv, /books, /ice-cream and
  // /tiers/:id render one component, so its store survives switching boards —
  // the board just re-derives. No kind = the custom-list route, which reads
  // the list id out of the URL.
  const tierList = (kind?: TierKind) => (
    <TierListPage kind={kind} spaceId={spaceId} userId={userId} configured={configured} />
  )

  // And again for the Lists feature: /lists/movies, /lists/tv, /lists/books
  // and /lists/:id render one component, so its store survives switching
  // lists. No kind = the free-form route, which reads the list id out of the
  // URL.
  const lists = (kind?: 'movie' | 'tv' | 'book') => (
    <ListsPage kind={kind} spaceId={spaceId} userId={userId} configured={configured} />
  )

  const recipes = <RecipesPage spaceId={spaceId} configured={configured} />

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
          <Route path="/ice-cream" element={tierList('ice-cream')} />
          {/* Space-defined boards. Same element type in the same slot as the
              four above, so switching between them keeps the store alive; an
              unknown id redirects from inside the page (after its load). */}
          <Route path="/tiers/:id" element={tierList()} />
          {/* Lists: the want-to lists. /lists on its own picks the first one. */}
          <Route path="/lists" element={<Navigate to="/lists/movies" replace />} />
          <Route path="/lists/movies" element={lists('movie')} />
          <Route path="/lists/tv" element={lists('tv')} />
          <Route path="/lists/books" element={lists('book')} />
          {/* Space-defined lists. Same element type in the same slot as the
              three above; an unknown id redirects from inside the page. */}
          <Route path="/lists/:id" element={lists()} />
          <Route
            path="/french-toast"
            element={<ComingSoon title="French toast" blurb="The definitive french toast ranking, coming soon." />}
          />
          <Route path="/parks" element={<ParksPage spaceId={spaceId} userId={userId} configured={configured} />} />
          <Route path="/spoons" element={<SpoonsPage spaceId={spaceId} configured={configured} />} />
          <Route
            path="/little-guys"
            element={<LittleGuysPage spaceId={spaceId} userId={userId} configured={configured} />}
          />
          <Route
            path="/board-games"
            element={<ComingSoon title="Board games" blurb="The board game collection and rankings, coming soon." />}
          />
          {/* The recipe index and the per-recipe page render one component
              (same tree position), so the store survives opening a recipe. */}
          <Route path="/recipes" element={recipes} />
          <Route path="/recipes/:id" element={recipes} />
          <Route
            path="/cats"
            element={<ComingSoon title="Cat photo wall" blurb="A wall of our cats. Coming soon." />}
          />
          <Route path="/music-practice" element={<MusicPracticePage spaceId={spaceId} userId={userId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
