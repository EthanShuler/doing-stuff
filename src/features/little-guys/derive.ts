import type { LittleGuy, Profile } from '../../types'
import { displayNameFor } from '../../lib/profile'
import { fuzzyMatch } from '../../lib/fuzzy'

// Pure data-shaping for the little guy collection — no React in here (same
// pattern as the other features' derive modules; covered by derive.test.ts).

/** The owner filter's value: OWNER_ALL, OWNER_UNASSIGNED, or a member's user id
 *  (a uuid, so it can never collide with the two sentinels). */
export type OwnerFilter = string
export const OWNER_ALL = 'all'
export const OWNER_UNASSIGNED = 'unassigned'

/** Sentinel the modal's owner Select uses for "nobody in particular" — a
 *  Mantine Select can't carry null as an option value. */
export const NO_OWNER = 'none'

/** A space member as the owner picker and filter pills see them. Built from the
 *  join-ordered member ids so the pill order is stable while profiles load. */
export interface Member {
  id: string
  /** Display label, '' when their profile hasn't loaded (callers fall back). */
  name: string
}

export function buildMembers(memberIds: string[], profiles: Profile[]): Member[] {
  return memberIds.map((id) => ({ id, name: displayNameFor(profiles.find((p) => p.id === id)) }))
}

/** A member's label with the shared fallback for a not-yet-loaded profile. */
export const memberLabel = (member: Member | undefined): string => member?.name || 'Member'

/** Whose little guy he is, for a card's byline. null owner (or an owner who has
 *  since left the space) reads as "nobody in particular". */
export function ownerLabel(guy: LittleGuy, members: Member[]): string {
  if (!guy.ownerId) return 'Nobody in particular'
  const member = members.find((m) => m.id === guy.ownerId)
  return member ? memberLabel(member) : 'Someone else'
}

/** Shelf order: alphabetical by name (case/accent-insensitive), createdAt
 *  tiebreak so two guys with the same name keep a stable order. */
export function sortLittleGuys(guys: LittleGuy[]): LittleGuy[] {
  return [...guys].sort(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
      a.createdAt.localeCompare(b.createdAt),
  )
}

/** The collection filter: fuzzy name search (shared with the Log dashboard and
 *  the recipe index) plus the owner pills. */
export function filterLittleGuys(guys: LittleGuy[], search: string, owner: OwnerFilter): LittleGuy[] {
  let result = guys
  if (search.trim()) {
    result = result.filter((guy) => fuzzyMatch(guy.name, search))
  }
  if (owner === OWNER_ALL) return result
  if (owner === OWNER_UNASSIGNED) return result.filter((guy) => !guy.ownerId)
  return result.filter((guy) => guy.ownerId === owner)
}

/** One owner filter pill: its value, label, and how many guys it would show. */
export interface OwnerOption {
  value: OwnerFilter
  label: string
  count: number
}

/**
 * The owner pill row: "All" first, then one pill per member in join order, then
 * an "Nobody in particular" pill — that last one only when some guy actually
 * lacks an owner, so the usual two-member collection stays a three-pill row.
 */
export function ownerOptions(guys: LittleGuy[], members: Member[]): OwnerOption[] {
  const options: OwnerOption[] = [{ value: OWNER_ALL, label: 'All', count: guys.length }]
  for (const member of members) {
    options.push({
      value: member.id,
      label: memberLabel(member),
      count: guys.filter((guy) => guy.ownerId === member.id).length,
    })
  }
  const ownerless = guys.filter((guy) => !guy.ownerId).length
  if (ownerless > 0) {
    options.push({ value: OWNER_UNASSIGNED, label: 'Nobody in particular', count: ownerless })
  }
  return options
}

/** The header count line: "12 little guys" (singular at one, blank at none —
 *  the empty state says it better). */
export function countLine(guys: LittleGuy[]): string {
  if (guys.length === 0) return ''
  return `${guys.length} little ${guys.length === 1 ? 'guy' : 'guys'}`
}
