import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ListKey, Profile, Tier, TierItem, TierList, TierPlacement, TierCompletion, TierUserTags } from '../../types'
import { supabase } from '../../lib/supabase'
import { firstGrapheme } from '../../lib/text'
import { renormalizedPositions } from '../../lib/order'
import { datesArePersonal, dropItemRows, itemIdsOnList, keyOf, kindColumn, listIdOf, listKeyFor, normalizeTags, placementOwner, planTierPulls, sumTierPullSummaries, tierPullSummaryLine } from './derive'
import type { TierPullData, TierPullOptions, TierPullSummary } from './derive'
import type { ListDraft } from './ListModal'
import { PROFILE_COLUMNS, SEED_PROFILES, SEED_SELF_ID, errorMessage, idFactory, syncTable, toProfile, upsertById, useSpaceSync } from '../../data/spaceSync'
import type { ProfileRow } from '../../data/spaceSync'
import { seedPullFetch } from '../../data/seedPullSource'

// Data seam for the tier lists, mirroring useActivityStore's two modes:
//   • Supabase keys present → live: reads/writes `tier_items` + `tier_placements`
//     (+ `tier_item_completions` for books) scoped to the space. The pool is
//     shared; placements and completions are per-person (RLS lets members read
//     each other's but write only their own).
//   • No keys → in-memory seed so the boards can be developed offline.
//
// The store holds items of ALL kinds and placements/completions of ALL users;
// the page derives one (kind, viewer) board at a time, so switching Movies ↔
// TV ↔ Books or You ↔ Partner never refetches.
//
// A `shared` custom list has ONE board instead of one per member: its
// placements carry user_id = null (the DB's unique index treats nulls as
// equal, so it's still one row per item) and RLS lets either member write
// them. The placement actions take a `shared` flag and address those rows.
//
// The "we're done with this" date splits by kind (see datesArePersonal in
// derive.ts): movies/TV/custom lists carry one SHARED `done_on` on the item;
// books ignore it and track each member's OWN `done_on` in
// `tier_item_completions`. Same column name on both sides on purpose.
//
// Tags split the same way: `tier_items.tags` are SHARED; each member's own
// tags live in `tier_item_user_tags` (one row per item per member, members
// read all, write only their own). The page only ever shows the viewer's.

export interface Snapshot {
  /** The space's own lists ("Fruits"), in creation order. */
  lists: TierList[]
  items: TierItem[]
  placements: TierPlacement[]
  completions: TierCompletion[]
  userTags: TierUserTags[]
  profiles: Profile[]
  /** This space's members, in join order (the board picker's order). */
  memberIds: string[]
}

function seed(): Snapshot {
  return {
    profiles: SEED_PROFILES,
    memberIds: SEED_PROFILES.map((p) => p.id),
    // One space-defined list, so /tiers/:id and the picker are demoable
    // offline exactly like the built-ins.
    lists: [
      // Ice cream is a space-defined list like any other (it used to be a
      // built-in kind — the 2026-09-13 migration converted it).
      { id: 'l0', name: 'Ice Cream', emoji: '🍦', noun: 'flavor', shared: false, copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-01T08:00:00Z' },
      { id: 'l1', name: 'Fruits', emoji: '🍎', noun: 'fruit', shared: false, copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-09T09:00:00Z' },
      // A SHARED list too: one board both members rank (null-owner placements).
      { id: 'l2', name: 'Board games', emoji: '🎲', noun: 'game', shared: true, copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-10T09:00:00Z' },
    ],
    // A few items carry tags so the filter pills are demoable offline.
    items: [
      { id: 'm1', kind: 'movie', title: 'Spirited Away', imageUrl: '', doneOn: '2026-06-01', tags: ['fantasy', 'ghibli'], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-01T09:00:00Z' },
      { id: 'm2', kind: 'movie', title: 'The Princess Bride', imageUrl: '', doneOn: '2026-06-02', tags: ['fantasy'], creator: '', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-02T09:00:00Z' },
      { id: 'm3', kind: 'movie', title: 'Blade Runner 2049', imageUrl: '', doneOn: null, tags: ['sci-fi'], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-03T09:00:00Z' },
      { id: 'm4', kind: 'movie', title: 'Paddington 2', imageUrl: '', doneOn: '2026-06-14', tags: [], creator: '', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-04T09:00:00Z' },
      { id: 'm5', kind: 'movie', title: 'The Room', imageUrl: '', doneOn: null, tags: [], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-05T09:00:00Z' },
      { id: 'm6', kind: 'movie', title: 'Everything Everywhere All at Once', imageUrl: '', doneOn: '2026-06-20', tags: ['sci-fi'], creator: '', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-06T09:00:00Z' },
      { id: 't1', kind: 'tv', title: 'Severance', imageUrl: '', doneOn: '2026-06-08', tags: ['sci-fi'], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-01T10:00:00Z' },
      { id: 't2', kind: 'tv', title: 'The Great British Bake Off', imageUrl: '', doneOn: null, tags: [], creator: '', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-02T10:00:00Z' },
      { id: 't3', kind: 'tv', title: 'Avatar: The Last Airbender', imageUrl: '', doneOn: '2026-06-15', tags: ['fantasy'], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-03T10:00:00Z' },
      { id: 't4', kind: 'tv', title: 'Emily in Paris', imageUrl: '', doneOn: null, tags: [], creator: '', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-04T10:00:00Z' },
      // Books keep the shared doneOn null — read state is per person, in
      // `completions` below.
      { id: 'b1', kind: 'book', title: 'Piranesi', imageUrl: '', doneOn: null, tags: ['fantasy'], creator: 'Susanna Clarke', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-01T11:00:00Z' },
      { id: 'b2', kind: 'book', title: 'Project Hail Mary', imageUrl: '', doneOn: null, tags: ['sci-fi'], creator: 'Andy Weir', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-02T11:00:00Z' },
      { id: 'b3', kind: 'book', title: 'Tomorrow, and Tomorrow, and Tomorrow', imageUrl: '', doneOn: null, tags: [], creator: 'Gabrielle Zevin', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-03T11:00:00Z' },
      { id: 'b4', kind: 'book', title: 'The Hobbit', imageUrl: '', doneOn: null, tags: ['fantasy', 'childhood reads'], creator: 'J. R. R. Tolkien', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-04T11:00:00Z' },
      { id: 'b5', kind: 'book', title: 'Circe', imageUrl: '', doneOn: null, tags: [], creator: 'Madeline Miller', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-05T11:00:00Z' },
      // Ice cream (custom list l0): a custom board tracks no date, so doneOn is
      // ignored there — an item is ranked, or it's on the unranked shelf.
      { id: 'i1', kind: 'list:l0', title: 'Mint chocolate chip', imageUrl: '', doneOn: '2026-06-07', tags: [], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-01T12:00:00Z' },
      { id: 'i2', kind: 'list:l0', title: 'Pistachio', imageUrl: '', doneOn: '2026-06-13', tags: [], creator: '', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-02T12:00:00Z' },
      { id: 'i3', kind: 'list:l0', title: 'Rum raisin', imageUrl: '', doneOn: null, tags: [], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-03T12:00:00Z' },
      { id: 'i4', kind: 'list:l0', title: 'Strawberry cheesecake', imageUrl: '', doneOn: '2026-06-21', tags: [], creator: '', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-04T12:00:00Z' },
      // The custom "Fruits" list — same shape as Ice Cream (no dates, one
      // shelf), keyed by `list:<id>` instead of a kind.
      { id: 'f1', kind: 'list:l1', title: 'Mango', imageUrl: '', doneOn: '2026-06-09', tags: [], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-09T10:00:00Z' },
      { id: 'f2', kind: 'list:l1', title: 'Durian', imageUrl: '', doneOn: null, tags: [], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-09T11:00:00Z' },
      { id: 'f3', kind: 'list:l1', title: 'Honeycrisp apple', imageUrl: '', doneOn: '2026-06-10', tags: [], creator: '', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-09T12:00:00Z' },
      // The shared Board games list: Catan ranked; Wingspan and Twilight
      // Imperium unranked.
      { id: 'g1', kind: 'list:l2', title: 'Catan', imageUrl: '', doneOn: '2026-06-11', tags: [], creator: 'Klaus Teuber', copiedFrom: null, createdBy: 'u2', createdAt: '2026-06-10T10:00:00Z' },
      { id: 'g2', kind: 'list:l2', title: 'Wingspan', imageUrl: '', doneOn: '2026-06-12', tags: [], creator: 'Elizabeth Hargrave', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-10T11:00:00Z' },
      { id: 'g3', kind: 'list:l2', title: 'Twilight Imperium', imageUrl: '', doneOn: null, tags: [], creator: '', copiedFrom: null, createdBy: 'u1', createdAt: '2026-06-10T12:00:00Z' },
    ],
    // Both viewers have rankings so the You/Partner toggle is demoable offline;
    // a few built-in items stay unranked — and some undated → unwatched — to
    // exercise both shelves.
    placements: [
      { id: 'p1', itemId: 'm1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'p2', itemId: 'm4', userId: 'u1', tier: 'S', position: 2 },
      { id: 'p3', itemId: 'm2', userId: 'u1', tier: 'A', position: 1 },
      { id: 'p4', itemId: 'm5', userId: 'u1', tier: 'F', position: 1 },
      { id: 'p5', itemId: 'm1', userId: 'u2', tier: 'A', position: 1 },
      { id: 'p6', itemId: 'm3', userId: 'u2', tier: 'S', position: 1 },
      { id: 'p7', itemId: 'm5', userId: 'u2', tier: 'B', position: 1 },
      { id: 'p8', itemId: 't1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'p9', itemId: 't4', userId: 'u1', tier: 'D', position: 1 },
      { id: 'p10', itemId: 't1', userId: 'u2', tier: 'B', position: 1 },
      { id: 'p11', itemId: 't4', userId: 'u2', tier: 'S', position: 1 },
      { id: 'p12', itemId: 'b1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'p13', itemId: 'b1', userId: 'u2', tier: 'A', position: 1 },
      { id: 'p14', itemId: 'b2', userId: 'u1', tier: 'A', position: 1 },
      { id: 'p15', itemId: 'b3', userId: 'u2', tier: 'S', position: 1 },
      { id: 'p16', itemId: 'i1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'p17', itemId: 'i2', userId: 'u1', tier: 'B', position: 1 },
      { id: 'p18', itemId: 'i1', userId: 'u2', tier: 'A', position: 1 },
      { id: 'p19', itemId: 'f1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'p20', itemId: 'f1', userId: 'u2', tier: 'B', position: 1 },
      // The shared board's ranking has no owner.
      { id: 'p21', itemId: 'g1', userId: null, tier: 'S', position: 1 },
    ],
    // Book completions: b1 read by both, b2/b4 only by u1, b3 only by u2, b5
    // by neither — so each seed board shows a different Unread shelf.
    completions: [
      { id: 'r1', itemId: 'b1', userId: 'u1', doneOn: '2026-06-05' },
      { id: 'r2', itemId: 'b1', userId: 'u2', doneOn: '2026-06-12' },
      { id: 'r3', itemId: 'b2', userId: 'u1', doneOn: '2026-06-18' },
      { id: 'r4', itemId: 'b3', userId: 'u2', doneOn: '2026-06-20' },
      { id: 'r5', itemId: 'b4', userId: 'u1', doneOn: '2026-06-25' },
    ],
    // Personal tags for both members, so the "Mine" row differs by viewer
    // (and the partner's never shows up on yours).
    userTags: [
      { id: 'ut1', itemId: 'm1', userId: 'u1', tags: ['comfort', 'rewatch'] },
      { id: 'ut2', itemId: 'm4', userId: 'u1', tags: ['comfort'] },
      { id: 'ut3', itemId: 'm2', userId: 'u2', tags: ['date night'] },
      { id: 'ut4', itemId: 't1', userId: 'u1', tags: ['rewatch'] },
      { id: 'ut5', itemId: 'b1', userId: 'u1', tags: ['reread'] },
    ],
  }
}

/**
 * Keyless seed mode's "other space" for a pull (see data/seedPullSource.ts):
 * the same shape fetchPullSource returns live — the source's lists and pool,
 * plus only the puller's (u1's) own rows and a shared list's null-owner rows.
 * Fixed and independent of seed() above, with deliberate overlap: Spirited
 * Away (ranked here already — left alone), Blade Runner 2049 (here but
 * unranked — gets a ranking), Severance, and the "Board games" list (matched
 * by name; Catan already ranked on the shared board).
 */
export function seedTierPullSource(): TierPullData {
  const at = (day: number, hour = 9) => `2026-03-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`
  const base = { imageUrl: '', doneOn: null, tags: [] as string[], creator: '', copiedFrom: null, createdBy: 'u1' }
  return {
    lists: [
      { id: 'src-l1', name: 'Snacks', emoji: '🍿', noun: 'snack', shared: false, copiedFrom: null, createdBy: 'u1', createdAt: at(1) },
      { id: 'src-l2', name: 'Board games', emoji: '🎲', noun: 'game', shared: true, copiedFrom: null, createdBy: 'u2', createdAt: at(2) },
    ],
    items: [
      // A shared done date there never comes over (it means "that group finished it").
      { ...base, id: 'src-m1', kind: 'movie', title: 'Spirited Away', doneOn: '2026-03-01', createdAt: at(1, 10) },
      { ...base, id: 'src-m2', kind: 'movie', title: 'Arrival', creator: 'Denis Villeneuve', tags: ['sci-fi'], doneOn: '2026-03-02', createdAt: at(2, 10) },
      { ...base, id: 'src-m3', kind: 'movie', title: 'Moonlight', creator: 'Barry Jenkins', doneOn: '2026-03-03', createdAt: at(3, 10) },
      { ...base, id: 'src-m4', kind: 'movie', title: 'Blade Runner 2049', doneOn: '2026-03-04', createdAt: at(4, 10) },
      { ...base, id: 'src-m5', kind: 'movie', title: 'Cats', createdAt: at(5, 10) },
      { ...base, id: 'src-t1', kind: 'tv', title: 'Fleabag', doneOn: '2026-03-05', createdAt: at(1, 11) },
      { ...base, id: 'src-t2', kind: 'tv', title: 'Severance', doneOn: '2026-03-06', createdAt: at(2, 11) },
      { ...base, id: 'src-b1', kind: 'book', title: 'The Left Hand of Darkness', creator: 'Ursula K. Le Guin', tags: ['classic'], createdAt: at(1, 12) },
      { ...base, id: 'src-s1', kind: 'list:src-l1', title: 'Pretzels', createdAt: at(1, 13) },
      { ...base, id: 'src-s2', kind: 'list:src-l1', title: 'Seaweed snacks', createdAt: at(2, 13) },
      { ...base, id: 'src-s3', kind: 'list:src-l1', title: 'Licorice', createdAt: at(3, 13) },
      { ...base, id: 'src-g1', kind: 'list:src-l2', title: 'Catan', createdAt: at(2, 14) },
      { ...base, id: 'src-g2', kind: 'list:src-l2', title: 'Azul', createdAt: at(3, 14) },
    ],
    placements: [
      { id: 'src-p1', itemId: 'src-m1', userId: 'u1', tier: 'A', position: 1 },
      { id: 'src-p2', itemId: 'src-m2', userId: 'u1', tier: 'S', position: 1 },
      { id: 'src-p3', itemId: 'src-m3', userId: 'u1', tier: 'A', position: 2 },
      { id: 'src-p4', itemId: 'src-m4', userId: 'u1', tier: 'B', position: 1 },
      { id: 'src-p5', itemId: 'src-t1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'src-p6', itemId: 'src-t2', userId: 'u1', tier: 'A', position: 1 },
      { id: 'src-p7', itemId: 'src-b1', userId: 'u1', tier: 'A', position: 1 },
      { id: 'src-p8', itemId: 'src-s1', userId: 'u1', tier: 'S', position: 1 },
      { id: 'src-p9', itemId: 'src-s2', userId: 'u1', tier: 'B', position: 1 },
      // The shared list's one board.
      { id: 'src-p10', itemId: 'src-g1', userId: null, tier: 'B', position: 1 },
      { id: 'src-p11', itemId: 'src-g2', userId: null, tier: 'A', position: 1 },
    ],
    completions: [{ id: 'src-r1', itemId: 'src-b1', userId: 'u1', doneOn: '2026-02-14' }],
    userTags: [
      { id: 'src-ut1', itemId: 'src-m2', userId: 'u1', tags: ['rewatch'] },
      { id: 'src-ut2', itemId: 'src-b1', userId: 'u1', tags: ['book club'] },
    ],
  }
}

// --- Row → app-type mappers (DB is snake_case) ---

type TierListRow = {
  id: string
  name: string
  emoji: string | null
  noun: string
  shared: boolean
  copied_from: string | null
  created_by: string | null
  created_at: string
}
type TierItemRow = {
  id: string
  kind: string
  list_id: string | null
  title: string
  image_url: string | null
  done_on: string | null
  tags: string[] | null
  creator: string | null
  copied_from: string | null
  created_by: string | null
  created_at: string
}
type TierPlacementRow = {
  id: string
  item_id: string
  /** Null on a shared list's board. */
  user_id: string | null
  tier: string
  position: number
}
type TierCompletionRow = {
  id: string
  item_id: string
  user_id: string
  done_on: string
}
type TierUserTagsRow = {
  id: string
  item_id: string
  user_id: string
  tags: string[] | null
}

const toTierList = (r: TierListRow): TierList => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji ?? '',
  noun: r.noun,
  shared: r.shared,
  copiedFrom: r.copied_from,
  createdBy: r.created_by,
  createdAt: r.created_at,
})
const toTierItem = (r: TierItemRow): TierItem => ({
  id: r.id,
  // The DB splits the board across two columns; the app carries one key.
  kind: keyOf(r.kind, r.list_id),
  title: r.title,
  imageUrl: r.image_url ?? '',
  doneOn: r.done_on,
  tags: r.tags ?? [],
  creator: r.creator ?? '',
  copiedFrom: r.copied_from,
  createdBy: r.created_by,
  createdAt: r.created_at,
})
const toTierPlacement = (r: TierPlacementRow): TierPlacement => ({
  id: r.id,
  itemId: r.item_id,
  userId: r.user_id,
  tier: r.tier as Tier,
  position: r.position,
})
const toTierCompletion = (r: TierCompletionRow): TierCompletion => ({
  id: r.id,
  itemId: r.item_id,
  userId: r.user_id,
  doneOn: r.done_on,
})
const toTierUserTags = (r: TierUserTagsRow): TierUserTags => ({
  id: r.id,
  itemId: r.item_id,
  userId: r.user_id,
  tags: r.tags ?? [],
})

const TIER_LIST_COLUMNS = 'id,name,emoji,noun,shared,copied_from,created_by,created_at'
const TIER_ITEM_COLUMNS = 'id,kind,list_id,title,image_url,done_on,tags,creator,copied_from,created_by,created_at'
const TIER_PLACEMENT_COLUMNS = 'id,item_id,user_id,tier,position'
const TIER_COMPLETION_COLUMNS = 'id,item_id,user_id,done_on'
const TIER_USER_TAGS_COLUMNS = 'id,item_id,user_id,tags'

// In-memory fallback only: stable client ids for seed-mode edits.
const nextId = idFactory('tx', 500)

/** One space's full tier-list snapshot (live mode). The store's load and
 *  resync use it for its own space. Throws on the first failed query. */
export async function fetchTierSnapshot(spaceId: string): Promise<Snapshot> {
  if (!supabase) throw new Error('fetchTierSnapshot needs Supabase')
  const [ls, its, places, comps_, utags, profs, members] = await Promise.all([
    supabase.from('tier_lists').select(TIER_LIST_COLUMNS).eq('space_id', spaceId).order('created_at'),
    supabase.from('tier_items').select(TIER_ITEM_COLUMNS).eq('space_id', spaceId).order('created_at'),
    supabase.from('tier_placements').select(TIER_PLACEMENT_COLUMNS).eq('space_id', spaceId).order('position'),
    supabase.from('tier_item_completions').select(TIER_COMPLETION_COLUMNS).eq('space_id', spaceId).order('created_at'),
    supabase.from('tier_item_user_tags').select(TIER_USER_TAGS_COLUMNS).eq('space_id', spaceId),
    // RLS scopes this to the current user + anyone they share a space with.
    supabase.from('profiles').select(PROFILE_COLUMNS),
    // ...so the boards to pick from come from THIS space's membership.
    supabase.from('space_members').select('user_id,created_at').eq('space_id', spaceId).order('created_at'),
  ])
  if (ls.error) throw ls.error
  if (its.error) throw its.error
  if (places.error) throw places.error
  if (comps_.error) throw comps_.error
  if (utags.error) throw utags.error
  if (profs.error) throw profs.error
  if (members.error) throw members.error
  return {
    lists: (ls.data as TierListRow[]).map(toTierList),
    items: (its.data as TierItemRow[]).map(toTierItem),
    placements: (places.data as TierPlacementRow[]).map(toTierPlacement),
    completions: (comps_.data as TierCompletionRow[]).map(toTierCompletion),
    userTags: (utags.data as TierUserTagsRow[]).map(toTierUserTags),
    profiles: (profs.data as ProfileRow[]).map(toProfile),
    memberIds: (members.data as { user_id: string }[]).map((m) => m.user_id),
  }
}

/**
 * What a pull reads from another space the caller belongs to: its lists and
 * pool, plus only the CALLER's own placements / completions / personal tags
 * and the null-owner placements (shared lists' boards) — by `space_id` +
 * `user_id`, never a long `.in('item_id', …)`. Nobody else's opinions are
 * fetched. Keyless seed mode answers with seedTierPullSource().
 */
export async function fetchPullSource(sourceSpaceId: string, selfId: string): Promise<TierPullData> {
  if (!supabase) return seedPullFetch(seedTierPullSource)
  const [ls, its, places, comps_, utags] = await Promise.all([
    supabase.from('tier_lists').select(TIER_LIST_COLUMNS).eq('space_id', sourceSpaceId).order('created_at'),
    supabase.from('tier_items').select(TIER_ITEM_COLUMNS).eq('space_id', sourceSpaceId).order('created_at'),
    supabase
      .from('tier_placements')
      .select(TIER_PLACEMENT_COLUMNS)
      .eq('space_id', sourceSpaceId)
      .or(`user_id.eq.${selfId},user_id.is.null`)
      .order('position'),
    supabase.from('tier_item_completions').select(TIER_COMPLETION_COLUMNS).eq('space_id', sourceSpaceId).eq('user_id', selfId),
    supabase.from('tier_item_user_tags').select(TIER_USER_TAGS_COLUMNS).eq('space_id', sourceSpaceId).eq('user_id', selfId),
  ])
  if (ls.error) throw ls.error
  if (its.error) throw its.error
  if (places.error) throw places.error
  if (comps_.error) throw comps_.error
  if (utags.error) throw utags.error
  return {
    lists: (ls.data as TierListRow[]).map(toTierList),
    items: (its.data as TierItemRow[]).map(toTierItem),
    placements: (places.data as TierPlacementRow[]).map(toTierPlacement),
    completions: (comps_.data as TierCompletionRow[]).map(toTierCompletion),
    userTags: (utags.data as TierUserTagsRow[]).map(toTierUserTags),
  }
}

/** Append the rows whose (itemId, userId) isn't taken yet — a pull's
 *  insert-if-absent for placements and completions. */
const insertAbsent = <R extends { itemId: string; userId: string | null }>(prev: R[], rows: R[]): R[] => [
  ...prev,
  ...rows.filter((r) => !prev.some((x) => x.itemId === r.itemId && x.userId === r.userId)),
]

// A placement's logical identity is (itemId, userId) — the DB enforces it
// unique (nulls included: a shared board's null owner is one owner). Upserting
// by that pair (rather than row id) keeps local state duplicate-free even when
// an optimistic write and its realtime echo carry different ids for the same
// ranking.
const upsertPlacement = (set: Dispatch<SetStateAction<TierPlacement[]>>, p: TierPlacement) =>
  set((prev) => [...prev.filter((x) => !(x.itemId === p.itemId && x.userId === p.userId)), p])

// Same story for a personal completion (a book's read record): unique per
// (itemId, userId).
const upsertCompletion = (set: Dispatch<SetStateAction<TierCompletion[]>>, r: TierCompletion) =>
  set((prev) => [...prev.filter((x) => !(x.itemId === r.itemId && x.userId === r.userId)), r])

// And for a member's personal tag row: unique per (itemId, userId).
const upsertUserTags = (set: Dispatch<SetStateAction<TierUserTags[]>>, r: TierUserTags) =>
  set((prev) => [...prev.filter((x) => !(x.itemId === r.itemId && x.userId === r.userId)), r])

export interface TierListStore {
  /** The space's own lists, oldest first (picker pill order). */
  lists: TierList[]
  /** The shared pool — all boards; filter with deriveBoard. */
  items: TierItem[]
  /** All members' placements; deriveBoard picks one viewer's. */
  placements: TierPlacement[]
  /** All members' personal completions (book read records today); deriveBoard
   *  picks one viewer's. */
  completions: TierCompletion[]
  /** All members' personal tag rows; the page shows only the viewer's own. */
  userTags: TierUserTags[]
  /** Every profile RLS lets you see — co-members of ANY of your spaces. Pick
   *  this space's with `memberIds`. */
  profiles: Profile[]
  /** This space's members in join order — whose boards there are to view. */
  memberIds: string[]
  /** Whose board "You" is: the auth user, or the seed self in keyless mode. */
  selfId: string | null
  loading: boolean
  /** Last failed write's message. Cleared when a new write starts, or via clearError. */
  error: string | null
  clearError: () => void
  /** A non-fatal note — what the last pull brought. */
  notice: string | null
  clearNotice: () => void

  /** Add to the shared pool. `creator` is who made it (author/director — see
   *  copy.ts). `dateOn` is an ISO date or null (= none yet): the shared
   *  watched date for movies/TV, YOUR OWN read date for books. `tags` are
   *  shared filter labels, `myTags` YOUR OWN (both normalized before saving).
   *  Throws only when the item itself fails (the modal stays open). */
  addItem: (key: ListKey, title: string, imageUrl: string, creator: string, dateOn: string | null, tags: string[], myTags: string[]) => Promise<void>
  /** Edit a pool item's title/image/creator/tags + its date and your own tags
   *  (same semantics as addItem). Throws only when the item write fails. */
  updateItem: (id: string, key: ListKey, title: string, imageUrl: string, creator: string, dateOn: string | null, tags: string[], myTags: string[]) => Promise<void>
  /** Remove from the pool — deletes EVERYONE's placements (and, for books,
   *  read records) of it. Throws on failure. */
  deleteItem: (id: string) => Promise<void>

  /** Rank (or re-rank) an item on the caller's own board — or, with `shared`,
   *  on the list's one shared board (null-owner rows). Inline flow: records
   *  the error and resyncs instead of throwing; the card snaps back. */
  placeItem: (itemId: string, tier: Tier, position: number, shared?: boolean) => Promise<void>
  /** Drop an item back to the unranked shelf (deletes the placement row). */
  unplaceItem: (itemId: string, shared?: boolean) => Promise<void>
  /** Rewrite one tier's ordering at integer positions (float-precision rescue). */
  placeTier: (tier: Tier, orderedItemIds: string[], shared?: boolean) => Promise<void>
  /** Set or clear the pool item's SHARED done date (drag on/off the unwatched
   *  shelf). Movies/TV only — a custom list has no date and no second shelf.
   *  Inline flow — records the error and resyncs instead of throwing. */
  setSharedDoneOn: (itemId: string, doneOn: string | null) => Promise<void>
  /** Set or clear YOUR OWN completion of an item — a book's read record (drag
   *  on/off the Unread shelf, or the date field in the edit modal). null
   *  deletes the row — "I haven't read this". Inline flow — records the error
   *  and resyncs. */
  setDoneOn: (itemId: string, doneOn: string | null) => Promise<void>
  /** Replace YOUR OWN tags on an item (an empty list deletes the row). Inline
   *  flow — records the error and resyncs. */
  setMyTags: (itemId: string, tags: string[]) => Promise<void>

  /** Create a space-defined list. Resolves the created row so the caller can
   *  navigate to its board. Throws on failure (the modal stays open). */
  addList: (draft: ListDraft) => Promise<TierList>
  /** Rename / re-word a list. Throws on failure. */
  updateList: (id: string, draft: ListDraft) => Promise<void>
  /** Delete a list — ONE DB delete; Postgres cascades its items (and everyone's
   *  placements/completions of them). Mirrored locally slice by slice (itemIdsOnList / dropItemRows).
   *  Throws on failure. */
  deleteList: (id: string) => Promise<void>

  /** Read another space (one the caller belongs to) for a pull: its boards
   *  plus the caller's own rows there. Throws on failure. */
  loadPullSource: (sourceSpaceId: string) => Promise<TierPullData>
  /** Pull boards (source ListKeys) from another space into this one — a
   *  re-readable merge planned against the current state (see planTierPull).
   *  Sets `notice` with what came over. Throws on failure with `error` set;
   *  a failure after the items landed says to pull again, which finishes. */
  pullBoards: (sourceSpaceId: string, keys: ListKey[], opts: TierPullOptions) => Promise<TierPullSummary>
}

/** Normalize a list draft for saving: trimmed words, one emoji. */
const cleanListDraft = (draft: ListDraft) => ({
  name: draft.name.trim(),
  emoji: firstGrapheme(draft.emoji),
  noun: draft.noun.trim().toLowerCase(),
  shared: draft.shared,
})

export function useTierListStore(spaceId: string | null, userId: string | null = null): TierListStore {
  // Keyless dev mode seeds synchronously so the UI never flashes empty.
  // Built once — every list below initializes from the same snapshot.
  const [initial] = useState<Snapshot | null>(() => (supabase ? null : seed()))
  const [lists, setLists] = useState<TierList[]>(initial?.lists ?? [])
  const [items, setItems] = useState<TierItem[]>(initial?.items ?? [])
  const [placements, setPlacements] = useState<TierPlacement[]>(initial?.placements ?? [])
  const [completions, setCompletions] = useState<TierCompletion[]>(initial?.completions ?? [])
  const [userTags, setUserTags] = useState<TierUserTags[]>(initial?.userTags ?? [])
  const [profiles, setProfiles] = useState<Profile[]>(initial?.profiles ?? [])
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? [])
  const [loading, setLoading] = useState<boolean>(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const clearError = useCallback(() => setError(null), [])
  const [notice, setNotice] = useState<string | null>(null)
  const clearNotice = useCallback(() => setNotice(null), [])

  const selfId = supabase ? userId : SEED_SELF_ID

  // Fetch one full snapshot (live mode only). Shared by the initial load, the
  // resync after a realtime reconnect, and the recovery path after a failed
  // optimistic drop. Throws on the first failed query.
  const fetchAll = useCallback(async (): Promise<Snapshot | null> => {
    if (!supabase || !spaceId) return null
    return fetchTierSnapshot(spaceId)
  }, [spaceId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    setLists(snap.lists)
    setItems(snap.items)
    setPlacements(snap.placements)
    setCompletions(snap.completions)
    setUserTags(snap.userTags)
    setProfiles(snap.profiles)
    setMemberIds(snap.memberIds)
  }, [])

  // Resync after a failed inline write: the optimistic local change is wrong,
  // so pull the truth back down (the data set is tiny).
  const resync = useCallback(() => {
    fetchAll()
      .then((snap) => {
        if (snap) applySnapshot(snap)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [fetchAll, applySnapshot])

  // Wire this store's tables onto the realtime channel (see useSpaceSync).
  // Placements and read records pass their (itemId, userId)-keyed upserts;
  // a cascaded tier-item delete needs no special-casing — the DB emits the
  // dependent deletes as their own events.
  const wire = useCallback((channel: RealtimeChannel, spaceFilter: string) => {
    channel = syncTable(channel, spaceFilter, 'tier_lists', toTierList, setLists)
    channel = syncTable(channel, spaceFilter, 'tier_items', toTierItem, setItems)
    channel = syncTable(channel, spaceFilter, 'tier_placements', toTierPlacement, setPlacements, upsertPlacement)
    channel = syncTable(channel, spaceFilter, 'tier_item_completions', toTierCompletion, setCompletions, upsertCompletion)
    channel = syncTable(channel, spaceFilter, 'tier_item_user_tags', toTierUserTags, setUserTags, upsertUserTags)
    return channel
  }, [])

  useSpaceSync({
    spaceId,
    channelPrefix: 'tier',
    fetchAll,
    applySnapshot,
    setLoading,
    setError,
    wire,
  })

  // Your own read record for a book: null deletes it ("I haven't read this"),
  // a date upserts it. Only ever touches rows with your user_id — the
  // partner's read state is theirs (and RLS enforces it). Declared ahead of
  // the pool actions because addItem/updateItem/checkOff compose it.
  const setDoneOn = useCallback(
    async (itemId: string, doneOn: string | null) => {
      if (!selfId) return
      setError(null)
      if (doneOn === null) {
        // Optimistic: the card lands on the Unread shelf instantly.
        setCompletions((prev) => prev.filter((r) => !(r.itemId === itemId && r.userId === selfId)))
        if (!supabase || !spaceId) return
        const { error: err } = await supabase
          .from('tier_item_completions')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', selfId)
        if (err) {
          setError(err.message)
          resync()
        }
        return
      }
      // Optimistic with a temp id — reconciliation upserts by (itemId, userId).
      upsertCompletion(setCompletions, { id: nextId(), itemId, userId: selfId, doneOn })
      if (!supabase || !spaceId) return
      const { data, error: err } = await supabase
        .from('tier_item_completions')
        .upsert(
          { space_id: spaceId, item_id: itemId, user_id: selfId, done_on: doneOn },
          { onConflict: 'item_id,user_id' },
        )
        .select(TIER_COMPLETION_COLUMNS)
        .single()
      if (err) {
        setError(err.message)
        resync()
        return
      }
      upsertCompletion(setCompletions, toTierCompletion(data as TierCompletionRow))
    },
    [spaceId, selfId, resync],
  )

  // Your own tags on an item: an empty list deletes the row, anything else
  // upserts it. Like setDoneOn, only ever touches rows with your user_id.
  const setMyTags = useCallback(
    async (itemId: string, tags: string[]) => {
      if (!selfId) return
      const clean = normalizeTags(tags)
      setError(null)
      if (clean.length === 0) {
        setUserTags((prev) => prev.filter((r) => !(r.itemId === itemId && r.userId === selfId)))
        if (!supabase || !spaceId) return
        const { error: err } = await supabase
          .from('tier_item_user_tags')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', selfId)
        if (err) {
          setError(err.message)
          resync()
        }
        return
      }
      upsertUserTags(setUserTags, { id: nextId(), itemId, userId: selfId, tags: clean })
      if (!supabase || !spaceId) return
      const { data, error: err } = await supabase
        .from('tier_item_user_tags')
        .upsert(
          { space_id: spaceId, item_id: itemId, user_id: selfId, tags: clean },
          { onConflict: 'item_id,user_id' },
        )
        .select(TIER_USER_TAGS_COLUMNS)
        .single()
      if (err) {
        setError(err.message)
        resync()
        return
      }
      upsertUserTags(setUserTags, toTierUserTags(data as TierUserTagsRow))
    },
    [spaceId, selfId, resync],
  )

  // --- Pool actions. These throw on failure so the item modal can stay open. ---

  const addItem = useCallback(
    async (key: ListKey, title: string, imageUrl: string, creator: string, dateOn: string | null, tags: string[], myTags: string[]) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      const maker = creator.trim()
      const cleanTags = normalizeTags(tags)
      // Books: the date is YOUR completion row, not the shared item's.
      const personal = datesArePersonal(key)
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('tier_items')
          // kind + list_id always travel together — the DB CHECK ties them,
          // so a missed site fails as a store error, never as bad data.
          .insert({ space_id: spaceId, kind: kindColumn(key), list_id: listIdOf(key), title: trimmed, image_url: image, creator: maker, done_on: personal ? null : dateOn, tags: cleanTags })
          .select(TIER_ITEM_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const created = toTierItem(data as TierItemRow)
        // upsert, not append: the realtime echo of this write may land first.
        upsertById(setItems, created)
        // The item exists either way now, so a failed read-record write only
        // surfaces the error banner (setDoneOn resyncs) — no throw.
        if (personal && dateOn) await setDoneOn(created.id, dateOn)
        if (myTags.length > 0) await setMyTags(created.id, myTags)
        return
      }
      const created: TierItem = {
        id: nextId(),
        kind: key,
        title: trimmed,
        imageUrl: image,
        doneOn: personal ? null : dateOn,
        tags: cleanTags,
        creator: maker,
        copiedFrom: null,
        createdBy: selfId,
        createdAt: new Date().toISOString(),
      }
      setItems((prev) => [...prev, created])
      if (personal && dateOn) await setDoneOn(created.id, dateOn)
      if (myTags.length > 0) await setMyTags(created.id, myTags)
    },
    [spaceId, selfId, setDoneOn, setMyTags],
  )

  const updateItem = useCallback(
    async (id: string, key: ListKey, title: string, imageUrl: string, creator: string, dateOn: string | null, tags: string[], myTags: string[]) => {
      const trimmed = title.trim()
      if (!trimmed) return
      setError(null)
      const image = imageUrl.trim()
      const maker = creator.trim()
      const cleanTags = normalizeTags(tags)
      const personal = datesArePersonal(key)
      if (supabase && spaceId) {
        // For books, leave the shared done_on alone — the date belongs to
        // the caller's own read record instead.
        const patch = personal
          ? { title: trimmed, image_url: image, creator: maker, tags: cleanTags }
          : { title: trimmed, image_url: image, creator: maker, tags: cleanTags, done_on: dateOn }
        const { error: err } = await supabase.from('tier_items').update(patch).eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setItems((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, title: trimmed, imageUrl: image, creator: maker, tags: cleanTags, ...(personal ? {} : { doneOn: dateOn }) }
            : x,
        ),
      )
      // Sync your read record to the field: a date upserts, blank deletes.
      // Inline flow (no throw) — the item edit above already landed.
      if (personal) await setDoneOn(id, dateOn)
      // Skip the write when your tags didn't change — most edits don't touch them.
      const before = userTags.find((r) => r.itemId === id && r.userId === selfId)?.tags ?? []
      const after = normalizeTags(myTags)
      if (before.join('\u0000') !== after.join('\u0000')) await setMyTags(id, after)
    },
    [spaceId, selfId, userTags, setDoneOn, setMyTags],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('tier_items').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      // DB cascades every member's placements (and read records) of the item;
      // mirror it locally.
      setItems((prev) => prev.filter((x) => x.id !== id))
      setPlacements((prev) => prev.filter((p) => p.itemId !== id))
      setCompletions((prev) => prev.filter((r) => r.itemId !== id))
      setUserTags((prev) => prev.filter((r) => r.itemId !== id))
    },
    [spaceId],
  )

  // --- Placement actions (drops). Inline flows: optimistic local move first,
  //     then the write; on failure record the error and resync — the card
  //     visibly snaps back and the banner says why. ---

  const placeItem = useCallback(
    async (itemId: string, tier: Tier, position: number, shared = false) => {
      if (!shared && !selfId) return
      const owner = placementOwner(shared, selfId)
      setError(null)
      // Optimistic: the drop settles instantly. A temp id is fine — realtime
      // echoes and reconciliation upsert by (itemId, userId), not row id.
      upsertPlacement(setPlacements, { id: nextId(), itemId, userId: owner, tier, position })
      if (!supabase || !spaceId) return
      const { data, error: err } = await supabase
        .from('tier_placements')
        .upsert(
          // user_id explicitly (not left to the DB default) so the ON CONFLICT
          // (item_id, user_id) target matches on re-ranks — and so a shared
          // board's null owner isn't defaulted to auth.uid().
          { space_id: spaceId, item_id: itemId, user_id: owner, tier, position },
          { onConflict: 'item_id,user_id' },
        )
        .select(TIER_PLACEMENT_COLUMNS)
        .single()
      if (err) {
        setError(err.message)
        resync()
        return
      }
      upsertPlacement(setPlacements, toTierPlacement(data as TierPlacementRow))
    },
    [spaceId, selfId, resync],
  )

  const unplaceItem = useCallback(
    async (itemId: string, shared = false) => {
      if (!shared && !selfId) return
      const owner = placementOwner(shared, selfId)
      setError(null)
      setPlacements((prev) => prev.filter((p) => !(p.itemId === itemId && p.userId === owner)))
      if (!supabase || !spaceId) return
      const query = supabase.from('tier_placements').delete().eq('item_id', itemId)
      const { error: err } = await (owner === null ? query.is('user_id', null) : query.eq('user_id', owner))
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, selfId, resync],
  )

  const placeTier = useCallback(
    async (tier: Tier, orderedItemIds: string[], shared = false) => {
      if (!shared && !selfId) return
      const owner = placementOwner(shared, selfId)
      setError(null)
      const rewrites = renormalizedPositions(orderedItemIds)
      for (const { itemId, position } of rewrites) {
        upsertPlacement(setPlacements, { id: nextId(), itemId, userId: owner, tier, position })
      }
      if (!supabase || !spaceId) return
      const { data, error: err } = await supabase
        .from('tier_placements')
        .upsert(
          rewrites.map(({ itemId, position }) => ({
            space_id: spaceId,
            item_id: itemId,
            user_id: owner,
            tier,
            position,
          })),
          { onConflict: 'item_id,user_id' },
        )
        .select(TIER_PLACEMENT_COLUMNS)
      if (err) {
        setError(err.message)
        resync()
        return
      }
      for (const row of data as TierPlacementRow[]) upsertPlacement(setPlacements, toTierPlacement(row))
    },
    [spaceId, selfId, resync],
  )

  const setSharedDoneOn = useCallback(
    async (itemId: string, doneOn: string | null) => {
      setError(null)
      // Optimistic: the card lands on its new shelf instantly.
      setItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, doneOn } : x)))
      if (!supabase || !spaceId) return
      const { error: err } = await supabase.from('tier_items').update({ done_on: doneOn }).eq('id', itemId)
      if (err) {
        setError(err.message)
        resync()
      }
    },
    [spaceId, resync],
  )

  // --- List actions. The list row itself is shared space data (uniform RLS),
  //     so either member can create, re-word, or delete one. Add/update throw
  //     so the modal can stay open; delete throws too (it's modal-driven). ---

  const addList = useCallback(
    async (draft: ListDraft): Promise<TierList> => {
      const clean = cleanListDraft(draft)
      setError(null)
      if (supabase && spaceId) {
        const { data, error: err } = await supabase
          .from('tier_lists')
          .insert({ space_id: spaceId, ...clean })
          .select(TIER_LIST_COLUMNS)
          .single()
        if (err) {
          setError(err.message)
          throw err
        }
        const created = toTierList(data as TierListRow)
        // upsert, not append: the realtime echo of this write may land first.
        upsertById(setLists, created)
        return created
      }
      const created: TierList = { id: nextId(), ...clean, copiedFrom: null, createdBy: selfId, createdAt: new Date().toISOString() }
      setLists((prev) => [...prev, created])
      return created
    },
    [spaceId, selfId],
  )

  const updateList = useCallback(
    async (id: string, draft: ListDraft) => {
      const clean = cleanListDraft(draft)
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('tier_lists').update(clean).eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...clean } : l)))
    },
    [spaceId],
  )

  const deleteList = useCallback(
    async (id: string) => {
      setError(null)
      if (supabase && spaceId) {
        const { error: err } = await supabase.from('tier_lists').delete().eq('id', id)
        if (err) {
          setError(err.message)
          throw err
        }
      }
      // One DB delete; Postgres cascades the list's items and with them every
      // member's placements and completions. The dependent deletes arrive as
      // their own realtime events, but mirror them now so this tab doesn't
      // render a board of orphans for a beat.
      // Each slice goes through a functional updater so a realtime event or an
      // optimistic drop that landed during the await survives. The item ids are
      // read from this render's pool: an item added to the list mid-await is
      // still filtered by kind, and its cascaded placements arrive as DELETEs.
      const gone = itemIdsOnList(items, id)
      const key = listKeyFor(id)
      setLists((prev) => prev.filter((l) => l.id !== id))
      setItems((prev) => prev.filter((item) => item.kind !== key))
      setPlacements((prev) => dropItemRows(prev, gone))
      setCompletions((prev) => dropItemRows(prev, gone))
      setUserTags((prev) => dropItemRows(prev, gone))
    },
    [spaceId, items],
  )

  // --- Pull from another space ---

  const loadPullSource = useCallback(
    async (sourceSpaceId: string) => {
      if (!selfId) throw new Error('Sign in to pull.')
      return fetchPullSource(sourceSpaceId, selfId)
    },
    [selfId],
  )

  const pullBoards = useCallback(
    async (sourceSpaceId: string, keys: ListKey[], opts: TierPullOptions): Promise<TierPullSummary> => {
      setError(null)
      setNotice(null)
      if (!selfId) {
        const err = new Error('Sign in to pull.')
        setError(err.message)
        throw err
      }
      let data: TierPullData
      try {
        data = await fetchPullSource(sourceSpaceId, selfId)
      } catch (err) {
        setError(`Couldn't read the other space: ${errorMessage(err)}`)
        throw err
      }
      // Plan against what this tab holds right now. Live ids are minted here
      // so a plan's rows can reference each other (item → list, placement →
      // item) inside one multi-row statement per table.
      const mint = supabase ? () => crypto.randomUUID() : nextId
      const plans = planTierPulls(data, keys, { lists, items, placements, completions, userTags }, selfId, mint, new Date().toISOString(), opts)
      const summary = sumTierPullSummaries(plans)
      const newLists = plans.flatMap((p) => (p.newList ? [p.newList] : []))
      const newItems = plans.flatMap((p) => p.newItems)
      const newPlacements = plans.flatMap((p) => p.newPlacements)
      const newCompletions = plans.flatMap((p) => p.newCompletions)
      const tagUpserts = plans.flatMap((p) => p.userTagUpserts)
      const line = tierPullSummaryLine(summary)
      const done = () => {
        setNotice(line ? `Pulled: ${line}.` : 'Nothing new to pull.')
        return summary
      }

      if (!supabase || !spaceId) {
        setLists((prev) => [...prev, ...newLists])
        setItems((prev) => [...prev, ...newItems])
        setPlacements((prev) => insertAbsent(prev, newPlacements))
        setCompletions((prev) => insertAbsent(prev, newCompletions))
        setUserTags((prev) => [
          ...prev.filter((r) => !tagUpserts.some((t) => t.itemId === r.itemId && t.userId === r.userId)),
          ...tagUpserts,
        ])
        return done()
      }

      const fail = (message: string, err: unknown): never => {
        setError(message)
        throw err
      }

      // 1. Lists, then 2. items — each one multi-row insert, the returned
      //    rows upserted by id (a realtime echo may land first).
      if (newLists.length) {
        const { data: rows, error: err } = await supabase
          .from('tier_lists')
          .insert(newLists.map((l) => ({ id: l.id, space_id: spaceId, name: l.name, emoji: l.emoji, noun: l.noun, shared: l.shared, copied_from: l.copiedFrom })))
          .select(TIER_LIST_COLUMNS)
        if (err) fail(`Pull failed: ${err.message}`, err)
        for (const row of rows as TierListRow[]) upsertById(setLists, toTierList(row))
      }
      if (newItems.length) {
        const { data: rows, error: err } = await supabase
          .from('tier_items')
          .insert(
            newItems.map((i) => ({
              id: i.id,
              space_id: spaceId,
              kind: kindColumn(i.kind),
              list_id: listIdOf(i.kind),
              title: i.title,
              image_url: i.imageUrl,
              creator: i.creator,
              done_on: null,
              tags: i.tags,
              copied_from: i.copiedFrom,
              // Stepped by 1 ms in source order, so the Unranked shelf keeps it.
              created_at: i.createdAt,
            })),
          )
          .select(TIER_ITEM_COLUMNS)
        if (err) fail(newLists.length ? 'Lists copied, but their items failed — pull again to finish.' : `Pull failed: ${err.message}`, err)
        for (const row of rows as TierItemRow[]) upsertById(setItems, toTierItem(row))
      }

      // 3. The caller's own rows on top: rankings and read dates are
      //    insert-if-absent (a card placed meanwhile stays put); personal tags
      //    upsert the union. Independent of each other, so in parallel.
      const [placed, read, tagged] = await Promise.all([
        newPlacements.length
          ? supabase
              .from('tier_placements')
              .upsert(
                newPlacements.map((p) => ({ id: p.id, space_id: spaceId, item_id: p.itemId, user_id: p.userId, tier: p.tier, position: p.position })),
                { onConflict: 'item_id,user_id', ignoreDuplicates: true },
              )
              .select(TIER_PLACEMENT_COLUMNS)
          : null,
        newCompletions.length
          ? supabase
              .from('tier_item_completions')
              .upsert(
                newCompletions.map((r) => ({ id: r.id, space_id: spaceId, item_id: r.itemId, user_id: r.userId, done_on: r.doneOn })),
                { onConflict: 'item_id,user_id', ignoreDuplicates: true },
              )
              .select(TIER_COMPLETION_COLUMNS)
          : null,
        tagUpserts.length
          ? supabase
              .from('tier_item_user_tags')
              .upsert(
                tagUpserts.map((r) => ({ space_id: spaceId, item_id: r.itemId, user_id: r.userId, tags: r.tags })),
                { onConflict: 'item_id,user_id' },
              )
              .select(TIER_USER_TAGS_COLUMNS)
          : null,
      ])
      for (const row of (placed?.data ?? []) as TierPlacementRow[]) upsertPlacement(setPlacements, toTierPlacement(row))
      for (const row of (read?.data ?? []) as TierCompletionRow[]) upsertCompletion(setCompletions, toTierCompletion(row))
      for (const row of (tagged?.data ?? []) as TierUserTagsRow[]) upsertUserTags(setUserTags, toTierUserTags(row))
      const laterErr = placed?.error ?? read?.error ?? tagged?.error
      if (laterErr) fail('Items copied, but rankings failed — pull again to finish.', laterErr)
      return done()
    },
    [spaceId, selfId, lists, items, placements, completions, userTags],
  )

  return {
    lists,
    items,
    placements,
    completions,
    userTags,
    profiles,
    memberIds,
    selfId,
    loading,
    error,
    clearError,
    notice,
    clearNotice,
    addItem,
    updateItem,
    deleteItem,
    placeItem,
    unplaceItem,
    placeTier,
    setSharedDoneOn,
    setDoneOn,
    setMyTags,
    addList,
    updateList,
    deleteList,
    loadPullSource,
    pullBoards,
  }
}
