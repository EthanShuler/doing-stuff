import { lazy } from 'react'
import type { ReactElement } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import type { Screen, TierKind } from './types'
import { useSession } from './data/useSession'
import { SpaceContext, useSpace } from './data/useSpace'
import { AppLayout } from './layout/AppLayout'
import { HomePage } from './layout/HomePage'
import { AuthScreen } from './components/AuthScreen'
import { ComingSoon } from './components/ComingSoon'
import { NoSpaceScreen } from './components/NoSpaceScreen'
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
const SeasonsPage = lazy(() => import('./features/seasons/SeasonsPage').then((m) => ({ default: m.SeasonsPage })))
const LittleGuysPage = lazy(() =>
  import('./features/little-guys/LittleGuysPage').then((m) => ({ default: m.LittleGuysPage })),
)
const AlignmentPage = lazy(() =>
  import('./features/alignment/AlignmentPage').then((m) => ({ default: m.AlignmentPage })),
)
const AdminPage = lazy(() => import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))

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

  // Keyed by user: a sign-out → sign-in as someone else starts from a clean
  // slate (their spaces, their remembered pick) instead of the last user's.
  return <AuthedApp key={session?.user.id ?? 'seed'} session={session} configured={configured} />
}

/** Post-login: resolve the user's spaces, then hand each feature its route.
 *  The shell (header + feature nav + account menu) wraps everything. */
function AuthedApp({ session, configured }: { session: Session | null; configured: boolean }) {
  const space = useSpace(session, configured)
  const { current, dataSpaceId: spaceId, features } = space
  const userId = session?.user.id ?? null

  if (configured && space.error) {
    return <Splash text={`Couldn't load your space: ${space.error}`} />
  }
  if (configured && space.loading) {
    return <Splash text="Loading your space…" />
  }
  // Spaces are admin-managed, so a login in none has nothing to show. The
  // admin still gets the shell (and /admin) to put themselves somewhere.
  if (configured && space.spaces.length === 0 && !space.isAdmin) {
    return <NoSpaceScreen />
  }

  // A feature the current space hasn't turned on: its routes bounce to the
  // hub (which never lists it, so no loop). Presentation only — RLS doesn't
  // know about features.
  const enabled = new Set(features.map((f) => f.key))
  const gate = (key: string, element: ReactElement) => (enabled.has(key) ? element : <Navigate to="/" replace />)

  // All four doing-stuff routes render the same component (same position in
  // the tree), so its store — and realtime channel — survive screen switches.
  const doingStuff = (screen: Screen) =>
    gate('doing-stuff', <DoingStuffPage screen={screen} spaceId={spaceId} userId={userId} configured={configured} />)

  // Same trick for the tier lists: /movies, /tv, /books and
  // /tiers/:id render one component, so its store survives switching boards —
  // the board just re-derives. No kind = the custom-list route, which reads
  // the list id out of the URL.
  const tierList = (kind?: TierKind) =>
    gate('tier-lists', <TierListPage kind={kind} spaceId={spaceId} userId={userId} configured={configured} />)

  // And again for the Lists feature: /lists/movies, /lists/tv, /lists/books
  // and /lists/:id render one component, so its store survives switching
  // lists. No kind = the free-form route, which reads the list id out of the
  // URL.
  const lists = (kind?: 'movie' | 'tv' | 'book') =>
    gate('lists', <ListsPage kind={kind} spaceId={spaceId} userId={userId} configured={configured} />)

  // Seasons: /seasons (forwards to the current season) and /seasons/:id
  // render one component, so the store survives switching seasons.
  const seasons = gate('seasons', <SeasonsPage spaceId={spaceId} userId={userId} configured={configured} />)

  const recipes = gate('recipes', <RecipesPage spaceId={spaceId} configured={configured} />)

  // Alignment charts: /alignment (forwards to the first chart) and
  // /alignment/:id render one component, so the store survives switching charts.
  const alignment = gate('alignment', <AlignmentPage spaceId={spaceId} userId={userId} configured={configured} />)

  return (
    <SpaceContext value={space}>
      <BrowserRouter>
        <AppLayout>
          {/* Keyed by space: switching spaces remounts every page, so each
              store drops the old space's rows and re-subscribes to the new
              one instead of briefly showing (or writing to) the wrong space. */}
          <Routes key={current?.id ?? 'none'}>
            {/* The hub: one row per enabled feature. Static and tiny, so not lazy. */}
            <Route path="/" element={<HomePage />} />
            {/* Not a feature, so ungated: the page itself bounces anyone but
                the admin. */}
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/log" element={doingStuff('log')} />
            <Route path="/wishlist" element={doingStuff('wishlist')} />
            <Route path="/map" element={doingStuff('map')} />
            <Route path="/calendar" element={doingStuff('calendar')} />
            <Route path="/movies" element={tierList('movie')} />
            <Route path="/tv" element={tierList('tv')} />
            <Route path="/books" element={tierList('book')} />
            {/* Space-defined boards (ice cream lives here too). Same element
                type in the same slot as the three above, so switching between
                them keeps the store alive; an unknown id redirects from inside
                the page (after its load). */}
            <Route path="/tiers/:id" element={tierList()} />
            {/* Lists: the want-to lists. /lists on its own picks the first one. */}
            <Route path="/lists" element={gate('lists', <Navigate to="/lists/movies" replace />)} />
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
            <Route
              path="/parks"
              element={gate('parks', <ParksPage spaceId={spaceId} userId={userId} configured={configured} />)}
            />
            <Route path="/spoons" element={gate('spoons', <SpoonsPage spaceId={spaceId} configured={configured} />)} />
            <Route
              path="/little-guys"
              element={gate(
                'little-guys',
                <LittleGuysPage spaceId={spaceId} userId={userId} configured={configured} />,
              )}
            />
            <Route
              path="/board-games"
              element={<ComingSoon title="Board games" blurb="The board game collection and rankings, coming soon." />}
            />
            {/* The recipe index and the per-recipe page render one component
                (same tree position), so the store survives opening a recipe. */}
            <Route path="/recipes" element={recipes} />
            <Route path="/recipes/plan" element={recipes} />
            <Route path="/recipes/:id" element={recipes} />
            <Route
              path="/cats"
              element={<ComingSoon title="Cat photo wall" blurb="A wall of our cats. Coming soon." />}
            />
            <Route path="/seasons" element={seasons} />
            <Route path="/seasons/:id" element={seasons} />
            <Route path="/alignment" element={alignment} />
            <Route path="/alignment/:id" element={alignment} />
            <Route
              path="/music-practice"
              element={gate('music-practice', <MusicPracticePage spaceId={spaceId} userId={userId} />)}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </SpaceContext>
  )
}
