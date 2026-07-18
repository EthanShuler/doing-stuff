import type { ParkVisit, Profile } from '../../types'
import type { Park, ParkRegion } from './parks'
import { PARK_REGIONS } from './parks'
import { ACCENT, ACCENT_BLUE } from '../../theme'
import { displayNameFor } from '../../lib/profile'

// Pure data-shaping for the parks tracker — no React in here (same pattern as
// the other features' derive modules; covered by derive.test.ts).

/** A space member with their person-fixed pin color. */
export interface Member {
  id: string
  name: string
  color: string
}

// Person-fixed colors by membership join order: the space's first member
// (its creator) is blue, the second orange — the same assignment on both
// logins, so "the blue pins" always means the same person. Blue vs orange is
// the red-green-colorblind-safe pair (Ethan); combined states are shape-coded
// on top of color — together = a RING (first member's color around the
// second's), separately = a half-and-half SPLIT — so every status survives
// hue-blindness and grayscale.
export const MEMBER_COLORS = [ACCENT_BLUE, ACCENT]

/** Join the ordered membership to profiles: one Member per space member, in
 *  join order, each with their fixed color. Ids without a profile still get a
 *  slot (blank name) so colors never shift while profiles load. */
export function buildMembers(memberIds: string[], profiles: Profile[]): Member[] {
  return memberIds.map((id, i) => ({
    id,
    name: displayNameFor(profiles.find((p) => p.id === id)),
    color: MEMBER_COLORS[i] ?? MEMBER_COLORS[MEMBER_COLORS.length - 1],
  }))
}

/** History order within a park: dated trips newest first, undated ones after
 *  (newest logged first) — same convention as the spoon grid. */
export function sortVisits(visits: ParkVisit[]): ParkVisit[] {
  return [...visits].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1
    if (Boolean(a.date) !== Boolean(b.date)) return a.date ? -1 : 1
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  })
}

/** Everything the UI needs to know about one park's visit history. */
export interface ParkStatus {
  /** This park's visits, in sortVisits order. */
  visits: ParkVisit[]
  /** Members (join order) with at least one visit — non-member attendee ids
   *  (e.g. someone who later left) are ignored throughout. */
  visitorIds: string[]
  /** True when some single trip carried every member — "we went together".
   *  Rows marked `separate` never count: they're the one-row shorthand for
   *  "we've both been, on different trips". */
  together: boolean
}

/** Group visits by park code and derive each park's status. Parks with no
 *  visits simply have no map entry. */
export function parkStatuses(visits: ParkVisit[], memberIds: string[]): Map<string, ParkStatus> {
  const byPark = new Map<string, ParkVisit[]>()
  for (const visit of visits) {
    const group = byPark.get(visit.parkCode)
    if (group) group.push(visit)
    else byPark.set(visit.parkCode, [visit])
  }

  const statuses = new Map<string, ParkStatus>()
  for (const [code, group] of byPark) {
    const attended = (id: string) => group.some((v) => v.attendeeIds.includes(id))
    statuses.set(code, {
      visits: sortVisits(group),
      visitorIds: memberIds.filter(attended),
      together:
        memberIds.length > 1 &&
        group.some((v) => !v.separate && memberIds.every((id) => v.attendeeIds.includes(id))),
    })
  }
  return statuses
}

export interface ParkStats {
  /** Member id → number of parks they've been to. */
  perMember: Record<string, number>
  /** Parks with at least one all-member trip. */
  together: number
  total: number
}

export function parkStats(
  statuses: Map<string, ParkStatus>,
  memberIds: string[],
  total: number,
): ParkStats {
  const perMember: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]))
  let together = 0
  for (const status of statuses.values()) {
    for (const id of status.visitorIds) perMember[id] += 1
    if (status.together) together += 1
  }
  return { perMember, together, total }
}

/** List/legend filter: everything, one member's parks, shared trips, or the
 *  ones still to conquer. */
export type ParkFilter = 'all' | 'together' | 'unvisited' | { memberId: string }

export function filterParks(
  parks: Park[],
  statuses: Map<string, ParkStatus>,
  filter: ParkFilter,
): Park[] {
  if (filter === 'all') return parks
  if (filter === 'unvisited') return parks.filter((p) => !statuses.has(p.code))
  if (filter === 'together') return parks.filter((p) => statuses.get(p.code)?.together)
  return parks.filter((p) => statuses.get(p.code)?.visitorIds.includes(filter.memberId))
}

/** The list view's region sections, in the canonical region order. Parks keep
 *  their dataset order (alphabetical within a region); empty regions (under a
 *  filter) drop out. */
export function groupByRegion(parks: Park[]): { region: ParkRegion; parks: Park[] }[] {
  return PARK_REGIONS.map((region) => ({
    region,
    parks: parks.filter((p) => p.region === region),
  })).filter((group) => group.parks.length > 0)
}

/** What a park's map pin encodes: nobody yet, a shared trip, everyone but on
 *  different trips ('separate' — whether logged as one flagged row or as one
 *  solo row per person), or exactly which member has been. A park whose only
 *  visits carry no current member (edge case: attendees who left the space)
 *  reads as unvisited on the map — its history is still in the detail modal. */
export type ParkPin = 'none' | 'together' | 'separate' | { memberId: string }

export function parkPin(status: ParkStatus | undefined, memberIds: string[]): ParkPin {
  if (!status || status.visitorIds.length === 0) return 'none'
  if (status.together) return 'together'
  if (memberIds.length > 1 && status.visitorIds.length === memberIds.length) return 'separate'
  return { memberId: status.visitorIds[0] }
}

/** One member's fixed color, with a safe fallback while profiles load. */
export function memberColor(memberId: string, members: Member[]): string {
  return members.find((m) => m.id === memberId)?.color ?? MEMBER_COLORS[0]
}
