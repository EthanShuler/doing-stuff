import { SEED_PROFILES } from '../../data/spaceSync'
import { SEED_FRIEND_PROFILE, SEED_MEMBERS, SEED_SPACE_NAMES, SEED_SPACES } from '../../data/seedSpaces'
import type { AdminSpace, AdminUser } from './derive'

// Keyless seed mode's admin data. Module-level and edited in place, like
// SEED_SPACES, so what the admin does survives leaving /admin and coming back
// (until a reload). Memberships live in SEED_MEMBERS (by space); a person's
// `spaceIds` are derived from it on every snapshot.

type SeedAccount = Omit<AdminUser, 'spaceIds' | 'spaceNames'>

const [avery, jordan] = SEED_PROFILES

/** The feature seeds' two members, plus one account that's in no space and
 *  has never set a password (what a freshly created account looks like), and
 *  Friends' third member (who makes Parks a group there). */
export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    id: avery.id,
    email: avery.email ?? 'avery@example.com',
    displayName: avery.displayName,
    lastSignInAt: '2026-11-16T18:30:00Z',
    hasPassword: true,
    isAdmin: true,
  },
  {
    id: jordan.id,
    email: jordan.email ?? 'jordan@example.com',
    displayName: jordan.displayName,
    lastSignInAt: '2026-11-12T14:05:00Z',
    hasPassword: true,
    isAdmin: false,
  },
  { id: 'u3', email: 'sam@example.com', displayName: 'Sam', lastSignInAt: null, hasPassword: false, isAdmin: false },
  {
    id: SEED_FRIEND_PROFILE.id,
    email: SEED_FRIEND_PROFILE.email ?? 'riley@example.com',
    displayName: SEED_FRIEND_PROFILE.displayName,
    lastSignInAt: '2026-11-02T20:15:00Z',
    hasPassword: true,
    isAdmin: false,
  },
]

/** Fresh copies of the seed's users and spaces, shaped like the RPCs'. */
export function seedSnapshot(): { users: AdminUser[]; spaces: AdminSpace[] } {
  const spaces = SEED_SPACES.map((s) => ({
    id: s.id,
    name: s.name,
    enabledFeatures: s.enabledFeatures && [...s.enabledFeatures],
    memberIds: [...(SEED_MEMBERS[s.id] ?? [])],
  }))
  const users = SEED_ACCOUNTS.map((a) => {
    const spaceIds = spaces.filter((s) => s.memberIds.includes(a.id)).map((s) => s.id)
    const spaceNames: Record<string, string> = {}
    for (const id of spaceIds) {
      const name = SEED_SPACE_NAMES[id]?.[a.id]
      if (name) spaceNames[id] = name
    }
    return { ...a, spaceIds, spaceNames }
  })
  return { users, spaces }
}

/** admin_set_user_spaces, in memory: put `userId` in exactly `spaceIds`. */
export function seedSetUserSpaces(userId: string, spaceIds: readonly string[]) {
  for (const space of SEED_SPACES) {
    const members = SEED_MEMBERS[space.id] ?? []
    const want = spaceIds.includes(space.id)
    const has = members.includes(userId)
    if (want && !has) SEED_MEMBERS[space.id] = [...members, userId]
    if (!want && has) SEED_MEMBERS[space.id] = members.filter((id) => id !== userId)
  }
  seedPruneSpaceNames()
}

/** admin_set_space_display_name, in memory ('' clears it). */
export function seedSetSpaceName(spaceId: string, userId: string, name: string) {
  if (!(SEED_MEMBERS[spaceId] ?? []).includes(userId)) throw new Error('They are not in that space.')
  const names = { ...SEED_SPACE_NAMES[spaceId] }
  if (name.trim()) names[userId] = name.trim()
  else delete names[userId]
  SEED_SPACE_NAMES[spaceId] = names
}

/** A name lives on the membership row, so it goes when the membership does. */
export function seedPruneSpaceNames() {
  for (const [spaceId, names] of Object.entries(SEED_SPACE_NAMES)) {
    const members = SEED_MEMBERS[spaceId] ?? []
    SEED_SPACE_NAMES[spaceId] = Object.fromEntries(Object.entries(names).filter(([userId]) => members.includes(userId)))
  }
}
