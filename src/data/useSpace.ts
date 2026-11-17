import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { enabledFeatures, type Feature } from '../layout/features'
import { SEED_IS_ADMIN, SEED_SPACES } from './seedSpaces'

/** One space the signed-in user belongs to. */
export interface SpaceInfo {
  id: string
  name: string
  /** Feature keys (see layout/features.ts) this space shows. null = every
   *  feature, including ones added later (the home space). */
  enabledFeatures: string[] | null
}

interface Snapshot {
  /** In membership join order (earliest first). */
  spaces: SpaceInfo[]
  isAdmin: boolean
}

export interface SpaceState {
  spaces: SpaceInfo[]
  /** The space on screen. null while loading, on error, or for a user (only
   *  ever the admin — anyone else gets NoSpaceScreen) who's in no space. */
  current: SpaceInfo | null
  /** The id to hand the feature stores: the live space id, or null in keyless
   *  seed mode (null is what tells a store to use its seed). */
  dataSpaceId: string | null
  /** The current space's features, in nav order (empty without a space). */
  features: Feature[]
  isAdmin: boolean
  /** True only for the first load; `reload()` refreshes in place. */
  loading: boolean
  error: string | null
  switchTo: (spaceId: string) => void
  /** Re-reads memberships, names and features (e.g. after an admin edit)
   *  without flipping `loading`, so the app stays mounted. Rejects on
   *  failure and leaves the previous state in place. */
  reload: () => Promise<void>
}

// Remembers which space this user last picked on this device. A per-viewer
// convenience only, so every access tolerates storage being unavailable.
const storageKey = (userId: string | null) => `cajubinile.space.${userId ?? 'seed'}`
function readStoredSpace(userId: string | null): string | null {
  try {
    return localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}
function storeSpace(userId: string | null, spaceId: string) {
  try {
    localStorage.setItem(storageKey(userId), spaceId)
  } catch {
    // ignore — the choice just won't survive a reload
  }
}

const messageOf = (err: unknown): string =>
  err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
    ? err.message
    : 'Could not load your spaces.'

// A fresh copy each time, so an in-memory admin seed that edits SEED_SPACES
// in place shows up on reload() (a new array → a re-render).
const seedSnapshot = (): Snapshot => ({
  spaces: SEED_SPACES.map((s) => ({ ...s, enabledFeatures: s.enabledFeatures && [...s.enabledFeatures] })),
  isAdmin: SEED_IS_ADMIN,
})

/** Every space the user belongs to (RLS scopes both sides to their own
 *  memberships), in join order, plus whether they're the admin. */
async function fetchSnapshot(userId: string): Promise<Snapshot> {
  const client = supabase
  if (!client) throw new Error('Supabase not configured.')
  const [members, admin] = await Promise.all([
    client
      .from('space_members')
      .select('created_at, spaces(id, name, enabled_features)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    client.rpc('is_admin'),
  ])
  if (members.error) throw members.error
  if (admin.error) throw admin.error
  const spaces = (members.data ?? []).flatMap(({ spaces: s }) =>
    s ? [{ id: s.id, name: s.name, enabledFeatures: s.enabled_features }] : [],
  )
  return { spaces, isAdmin: admin.data === true }
}

/**
 * Resolves the spaces the signed-in user belongs to and which one is on
 * screen. Spaces and memberships are admin-managed (the admin page / RPCs);
 * nothing here creates one, so a login with no membership simply gets
 * `spaces: []` (App shows NoSpaceScreen unless they're the admin).
 *
 * The current space is the one last picked on this device, else the earliest
 * membership. App keys this hook's caller by user id, so `userId` is fixed for
 * the hook's lifetime.
 */
export function useSpace(session: Session | null, configured: boolean): SpaceState {
  const userId = session?.user.id ?? null
  const live = configured && Boolean(supabase)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => (live ? { spaces: [], isAdmin: false } : seedSnapshot()))
  const [currentId, setCurrentId] = useState<string | null>(() => readStoredSpace(userId))
  const [loading, setLoading] = useState(live && userId !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!live || !userId) return
    let cancelled = false
    fetchSnapshot(userId)
      .then(
        (next) => {
          if (!cancelled) setSnapshot(next)
        },
        (err: unknown) => {
          if (!cancelled) setError(messageOf(err))
        },
      )
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [live, userId])

  const { spaces, isAdmin } = snapshot
  // A remembered id that's no longer ours (removed from the space, another
  // account on this device) falls back to the earliest membership.
  const current = spaces.find((s) => s.id === currentId) ?? spaces[0] ?? null

  const switchTo = (spaceId: string) => {
    setCurrentId(spaceId)
    storeSpace(userId, spaceId)
  }

  const reload = async () => {
    const next = live && userId ? await fetchSnapshot(userId) : seedSnapshot()
    setSnapshot(next)
  }

  return {
    spaces,
    current,
    dataSpaceId: live ? (current?.id ?? null) : null,
    features: current ? enabledFeatures(current.enabledFeatures) : [],
    isAdmin,
    loading,
    error,
    switchTo,
    reload,
  }
}

export const SpaceContext = createContext<SpaceState | null>(null)

/** The current space, its features, the user's other spaces, and the
 *  switch / reload actions. Provided by App.tsx around the router. */
export function useSpaceContext(): SpaceState {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useSpaceContext used outside SpaceContext')
  return ctx
}

/** Is this feature (a `key` from layout/features.ts) on in the current space? */
export function useFeatureEnabled(key: string): boolean {
  return useSpaceContext().features.some((f) => f.key === key)
}
