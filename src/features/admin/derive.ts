import { enabledFeatures, FEATURES } from '../../layout/features'
import { formatDateWithYear, localDateOf } from '../../lib/format'

// Pure data shaping for the admin page: joins between accounts and spaces,
// row labels, form validation, and the membership merge every save goes
// through. No React, no Supabase — see derive.test.ts.

/** One login, as `admin_list_users()` returns it. */
export interface AdminUser {
  id: string
  email: string
  /** null = never set (labels fall back to the email's local part). */
  displayName: string | null
  /** null = never signed in. */
  lastSignInAt: string | null
  /** false until they've used a set-password link. */
  hasPassword: boolean
  isAdmin: boolean
  /** Their memberships, in join order. */
  spaceIds: string[]
  /** What they go by in a space where that differs from `displayName`
   *  (space id → name). A space with no entry uses the display name. */
  spaceNames: Record<string, string>
}

/** One space, as `admin_list_spaces()` returns it. */
export interface AdminSpace {
  id: string
  name: string
  /** null = every feature, including future ones; an array = an allow-list. */
  enabledFeatures: string[] | null
  /** In join order. */
  memberIds: string[]
}

/** A person's short label: display name, else the email's local part. */
export function userLabel(user: Pick<AdminUser, 'displayName' | 'email'>): string {
  const name = user.displayName?.trim()
  if (name) return name
  return user.email.split('@')[0] || user.email || 'Unnamed'
}

/** What a person is called inside one space: their name there, else their
 *  usual label. */
export function userLabelIn(user: Pick<AdminUser, 'displayName' | 'email' | 'spaceNames'>, spaceId: string): string {
  return user.spaceNames[spaceId]?.trim() || userLabel(user)
}

/** The per-space names a form changed: one entry per space in `spaceIds`
 *  whose trimmed name differs from the baseline ('' = back to the display
 *  name). Spaces outside `spaceIds` are skipped — no membership, no name. */
export function spaceNameChanges(
  baseline: Readonly<Record<string, string>>,
  draft: Readonly<Record<string, string>>,
  spaceIds: readonly string[],
): { spaceId: string; name: string }[] {
  return spaceIds.flatMap((spaceId) => {
    const name = (draft[spaceId] ?? '').trim()
    return name === (baseline[spaceId] ?? '').trim() ? [] : [{ spaceId, name }]
  })
}

/** The spaces a person belongs to, in their join order, for the row chips.
 *  An id with no matching space (a race with another tab) is skipped. */
export function spacesOfUser(user: AdminUser, spaces: readonly AdminSpace[]): AdminSpace[] {
  const byId = new Map(spaces.map((s) => [s.id, s]))
  return user.spaceIds.flatMap((id) => {
    const space = byId.get(id)
    return space ? [space] : []
  })
}

/** A space's member labels — as that space names them — in join order. */
export function memberNames(space: AdminSpace, users: readonly AdminUser[]): string[] {
  const byId = new Map(users.map((u) => [u.id, u]))
  return space.memberIds.flatMap((id) => {
    const user = byId.get(id)
    return user ? [userLabelIn(user, space.id)] : []
  })
}

/** The members line of a space row. */
export function membersLine(space: AdminSpace, users: readonly AdminUser[]): string {
  const names = memberNames(space, users)
  return names.length ? names.join(', ') : 'No members'
}

/** "All features" for a null allow-list, else a count of the features that
 *  still exist ("1 feature", "4 features", "No features"). */
export function featureSummary(allow: readonly string[] | null): string {
  if (allow === null) return 'All features'
  const n = enabledFeatures(allow).length
  if (n === 0) return 'No features'
  return n === 1 ? '1 feature' : `${n} features`
}

/** A person's last sign-in as a date ("Nov 3, 2026"), or "Never". Local
 *  date, never a slice of the UTC timestamp. */
export function lastSignInLabel(lastSignInAt: string | null): string {
  return lastSignInAt ? formatDateWithYear(localDateOf(lastSignInAt)) : 'Never'
}

// The same shape the admin Edge Function checks — a typo should fail here,
// before a round trip.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  return trimmed.length <= 254 && EMAIL.test(trimmed)
}

/** Why a space name can't be saved, or null when it can. */
export function spaceNameError(name: string): string | null {
  return name.trim() ? null : 'A space needs a name.'
}

/** The one-time link a person opens to set their password (parsed by the
 *  `/set-password` screen). The token rides in the fragment, so it never
 *  reaches a server log. */
export function setPasswordLink(origin: string, tokenHash: string): string {
  return `${origin}/set-password#token_hash=${encodeURIComponent(tokenHash)}`
}

/** Add or remove one id, keeping the list's order (a new id goes last). */
export function toggleId(ids: readonly string[], id: string, on: boolean): string[] {
  if (on) return ids.includes(id) ? [...ids] : [...ids, id]
  return ids.filter((x) => x !== id)
}

/** Same ids, ignoring order — did a checkbox list actually change? */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}

/**
 * The membership list to send to a "set exactly" RPC. The modal edited a
 * snapshot (`baseline` → `desired`); `fresh` is what the database holds right
 * now. Only this modal's own changes are applied on top of `fresh`, so a
 * change made elsewhere since the modal opened (another tab, the other
 * screen) survives instead of being replayed away.
 */
export function mergeMembership(
  fresh: readonly string[],
  baseline: readonly string[],
  desired: readonly string[],
): string[] {
  const removed = new Set(baseline.filter((id) => !desired.includes(id)))
  const kept = fresh.filter((id) => !removed.has(id))
  const added = desired.filter((id) => !baseline.includes(id) && !kept.includes(id))
  return [...kept, ...added]
}

/** Every feature key, in nav order. */
export const ALL_FEATURE_KEYS: string[] = FEATURES.map((f) => f.key)

/** The space modal's feature checkboxes, from a stored allow-list: "All" on
 *  for null; otherwise the known keys ticked, in nav order. */
export function featureDraft(allow: readonly string[] | null): { all: boolean; keys: string[] } {
  if (allow === null) return { all: true, keys: [...ALL_FEATURE_KEYS] }
  return { all: false, keys: ALL_FEATURE_KEYS.filter((k) => allow.includes(k)) }
}

/** What `admin_save_space` stores for the checkboxes: null for "All
 *  features, including future ones", else the ticked keys in nav order. */
export function featuresToSave(all: boolean, keys: readonly string[]): string[] | null {
  if (all) return null
  return ALL_FEATURE_KEYS.filter((k) => keys.includes(k))
}
