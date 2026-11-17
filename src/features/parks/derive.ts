import type { ParkVisit, Profile } from '../../types'
import type { Park, ParkRegion } from './parks'
import { PARK_REGIONS } from './parks'
import { ACCENT, ACCENT_BLUE } from '../../theme'
import { displayNameFor } from '../../lib/profile'
import { compareDatedDesc } from '../../lib/format'
import type { TriFilterState } from '../../lib/triFilter'
import { triMatcher } from '../../lib/triFilter'

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
  return [...visits].sort((a, b) => compareDatedDesc(a.date, a.createdAt, b.date, b.createdAt))
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

/** Filter pill keys besides member ids (uuids, so they never collide). */
export const TOGETHER = 'together'
export const UNVISITED = 'unvisited'

/** A park's filter keys: every member who's been, 'together' for a shared
 *  trip, 'unvisited' for nobody yet. */
export function parkKeys(status: ParkStatus | undefined): string[] {
  if (!status || status.visitorIds.length === 0) return [UNVISITED]
  return status.together ? [...status.visitorIds, TOGETHER] : status.visitorIds
}

/** The map + list status filter — tri-state pills (src/lib/triFilter.ts), so
 *  "Avery's parks, minus the shared trips" is Avery on, Together excluded. */
export function filterParks(
  parks: Park[],
  statuses: Map<string, ParkStatus>,
  filter: TriFilterState,
): Park[] {
  const matches = triMatcher(filter)
  return parks.filter((p) => matches(parkKeys(statuses.get(p.code))))
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

// --- Group mode: a space with three or more members. ---
//
// The two-person design above (person-fixed blue/orange, the Together ring,
// the Separately split) doesn't scale past a pair, so a bigger space gets a
// simpler model: one "whose map" viewer at a time — everyone, or one member —
// and every park is just visited or not for that viewer. Visited is the
// solid blue dot, not yet the small faint one (size + opacity as well as hue,
// so it never leans on color alone).

/** True when Parks should run in group mode (more than two members). */
export function isGroupSpace(memberIds: string[]): boolean {
  return memberIds.length > 2
}

/** The whose-map picker's choice: everyone, or one member's id (a uuid, so
 *  it can't collide with the 'everyone' sentinel). */
export const EVERYONE = 'everyone'
export type GroupViewer = string

/** The group filter's other key (UNVISITED above is the first). */
export const VISITED = 'visited'

/** Whether a park counts as visited on this viewer's map: anyone has been
 *  (Everyone), or that member has. */
export function groupVisited(status: ParkStatus | undefined, viewer: GroupViewer): boolean {
  if (!status) return false
  return viewer === EVERYONE ? status.visitorIds.length > 0 : status.visitorIds.includes(viewer)
}

/** A park's group-mode filter keys for this viewer. */
export function groupParkKeys(status: ParkStatus | undefined, viewer: GroupViewer): string[] {
  return [groupVisited(status, viewer) ? VISITED : UNVISITED]
}

/** filterParks for group mode: the All / Visited / Unvisited pills, read
 *  against the chosen viewer. */
export function filterGroupParks(
  parks: Park[],
  statuses: Map<string, ParkStatus>,
  viewer: GroupViewer,
  filter: TriFilterState,
): Park[] {
  const matches = triMatcher(filter)
  return parks.filter((p) => matches(groupParkKeys(statuses.get(p.code), viewer)))
}

/** Names of every member who has been (join order), whichever map is on
 *  screen. */
export function visitorNames(status: ParkStatus | undefined, members: Member[]): string[] {
  if (!status) return []
  return members.filter((m) => status.visitorIds.includes(m.id)).map((m) => m.name || 'Member')
}

/** The popup / list-row line: "Visited by Avery, Sam" or "Not visited yet". */
export function groupStatusLine(status: ParkStatus | undefined, members: Member[]): string {
  const names = visitorNames(status, members)
  return names.length > 0 ? `Visited by ${names.join(', ')}` : 'Not visited yet'
}
