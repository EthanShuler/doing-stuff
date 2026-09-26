import { describe, expect, it } from 'vitest'
import type { Season, SeasonItem } from '../../types'
import {
  addDays,
  byPosition,
  canNestUnder,
  cloneSeasonItems,
  currentSeason,
  dayLabel,
  dayOf,
  filterItems,
  groupSections,
  itemStatus,
  itemsByDay,
  missed,
  nextPosition,
  parentChoices,
  positionAfter,
  pruneItem,
  pruneSeason,
  sectionKeys,
  shortDate,
  sortSeasons,
  subsectionsOf,
  unplanned,
  urgency,
  weekdayOf,
  weekendDays,
  weekendFriday,
  weekendLabel,
  weekendPlans,
  weekends,
} from './derive'
import { seed } from './useSeasonStore'

// --- factories ------------------------------------------------------------------

let seq = 0
function item(over: Partial<SeasonItem> = {}): SeasonItem {
  seq += 1
  return {
    id: `i${seq}`,
    seasonId: 's1',
    parentId: null,
    section: 'Food',
    subsection: '',
    title: `Item ${seq}`,
    note: '',
    url: '',
    position: seq,
    fixedOn: null,
    byOn: null,
    plannedOn: null,
    doneOn: null,
    createdBy: 'u1',
    createdAt: '2026-09-01T00:00:00Z',
    ...over,
  }
}

function season(over: Partial<Season> = {}): Season {
  seq += 1
  return {
    id: `s${seq}`,
    name: `Season ${seq}`,
    emoji: '🍂',
    startsOn: '2026-09-22',
    endsOn: '2026-11-15',
    createdBy: 'u1',
    createdAt: '2026-09-01T00:00:00Z',
    ...over,
  }
}

const FALL = { startsOn: '2026-09-22', endsOn: '2026-11-15' }

// --- dates ------------------------------------------------------------------------

describe('local date arithmetic', () => {
  it('adds days across month and year lines', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('is DST-safe (US spring-forward and fall-back weekends)', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDays('2026-11-08', -7)).toBe('2026-11-01')
  })

  it('knows the weekday', () => {
    expect(weekdayOf('2026-09-26')).toBe(6) // Sat
    expect(weekdayOf('2026-09-27')).toBe(0) // Sun
    expect(weekdayOf('2026-09-22')).toBe(2) // Tue
  })

  it('labels days and deadlines', () => {
    expect(dayLabel('2026-10-03')).toBe('Sat 10/3')
    expect(dayLabel('2026-11-13')).toBe('Fri 11/13')
    expect(shortDate('2026-10-31')).toBe('10/31')
  })
})

describe('weekendFriday', () => {
  it('maps Fri/Sat/Sun to their own Friday', () => {
    expect(weekendFriday('2026-09-25')).toBe('2026-09-25')
    expect(weekendFriday('2026-09-26')).toBe('2026-09-25')
    expect(weekendFriday('2026-09-27')).toBe('2026-09-25')
  })
  it('maps Mon–Thu to the coming Friday', () => {
    expect(weekendFriday('2026-09-21')).toBe('2026-09-25')
    expect(weekendFriday('2026-09-24')).toBe('2026-09-25')
    expect(weekendFriday('2026-09-28')).toBe('2026-10-02')
  })
})

describe('weekendLabel', () => {
  it('collapses the month within a month', () => {
    expect(weekendLabel({ fri: '2026-10-02', sat: '2026-10-03', sun: '2026-10-04' })).toBe('Oct 2 – 4')
  })
  it('spells both months across a month line', () => {
    expect(weekendLabel({ fri: '2026-10-30', sat: '2026-10-31', sun: '2026-11-01' })).toBe('Oct 30 – Nov 1')
  })
})

// --- current season ---------------------------------------------------------------

describe('currentSeason', () => {
  const summer = season({ startsOn: '2026-06-01', endsOn: '2026-08-31' })
  const fall = season({ startsOn: '2026-09-22', endsOn: '2026-11-15' })
  const winter = season({ startsOn: '2026-12-01', endsOn: '2027-02-28' })

  it('is null with no seasons', () => {
    expect(currentSeason([], '2026-09-26')).toBeNull()
  })
  it('prefers the season containing today (inclusive ends)', () => {
    expect(currentSeason([summer, fall, winter], '2026-09-26')).toBe(fall)
    expect(currentSeason([summer, fall, winter], '2026-09-22')).toBe(fall)
    expect(currentSeason([summer, fall, winter], '2026-11-15')).toBe(fall)
  })
  it('picks the latest-starting of overlapping seasons', () => {
    const october = season({ startsOn: '2026-10-01', endsOn: '2026-10-31' })
    expect(currentSeason([fall, october], '2026-10-10')).toBe(october)
  })
  it('falls back to the most recently started season in a gap', () => {
    expect(currentSeason([summer, fall, winter], '2026-11-20')).toBe(fall)
  })
  it('falls back to the earliest upcoming when none has started', () => {
    expect(currentSeason([winter, fall], '2026-01-01')).toBe(fall)
  })
})

describe('sortSeasons', () => {
  it('orders by start date', () => {
    const a = season({ startsOn: '2026-12-01' })
    const b = season({ startsOn: '2026-06-01' })
    expect(sortSeasons([a, b]).map((s) => s.id)).toEqual([b.id, a.id])
  })
})

// --- weekends ----------------------------------------------------------------------

describe('weekends', () => {
  it('lists every weekend of a season that has already started (today = Saturday)', () => {
    const list = weekends(FALL, '2026-09-26')
    expect(list).toHaveLength(8)
    expect(list[0]).toEqual({ fri: '2026-09-25', sat: '2026-09-26', sun: '2026-09-27' })
    expect(list[7]).toEqual({ fri: '2026-11-13', sat: '2026-11-14', sun: '2026-11-15' })
  })

  it('still counts this weekend on its Sunday', () => {
    expect(weekends(FALL, '2026-09-27')[0].fri).toBe('2026-09-25')
  })

  it('drops the weekend once it is past (today = Monday)', () => {
    const list = weekends(FALL, '2026-09-28')
    expect(list[0].fri).toBe('2026-10-02')
    expect(list).toHaveLength(7)
  })

  it('starts at the season start when the season is upcoming', () => {
    const list = weekends(FALL, '2026-08-01')
    expect(list[0].fri).toBe('2026-09-25')
  })

  it('includes a weekend the season starts in the middle of', () => {
    const list = weekends({ startsOn: '2026-09-26', endsOn: '2026-10-04' }, '2026-09-01')
    expect(list.map((w) => w.fri)).toEqual(['2026-09-25', '2026-10-02'])
  })

  it('stops at the last weekend whose Friday is in the season', () => {
    expect(weekends({ startsOn: '2026-10-01', endsOn: '2026-10-09' }, '2026-10-01').map((w) => w.fri)).toEqual([
      '2026-10-02',
      '2026-10-09',
    ])
    expect(weekends({ startsOn: '2026-10-01', endsOn: '2026-10-08' }, '2026-10-01').map((w) => w.fri)).toEqual([
      '2026-10-02',
    ])
  })

  it('is empty once the season is over', () => {
    expect(weekends(FALL, '2026-11-16')).toEqual([])
  })

  it('crosses DST without skipping or doubling a weekend', () => {
    const list = weekends(FALL, '2026-10-26')
    expect(list.map((w) => w.fri)).toEqual(['2026-10-30', '2026-11-06', '2026-11-13'])
    expect(list[0].sun).toBe('2026-11-01')
  })
})

describe('weekendDays', () => {
  it('drops days already past', () => {
    const days = weekendDays(FALL, '2026-09-26')
    expect(days[0]).toBe('2026-09-26')
    expect(days).toHaveLength(8 * 3 - 1)
    expect(days.at(-1)).toBe('2026-11-15')
  })
  it('trims to the season range', () => {
    expect(weekendDays({ startsOn: '2026-09-26', endsOn: '2026-10-03' }, '2026-09-01')).toEqual([
      '2026-09-26',
      '2026-09-27',
      '2026-10-02',
      '2026-10-03',
    ])
  })
})

// --- items / days -----------------------------------------------------------------------

describe('dayOf / itemStatus', () => {
  it('prefers the fixed date over the planned one', () => {
    expect(dayOf(item({ fixedOn: '2026-11-07', plannedOn: '2026-10-03' }))).toBe('2026-11-07')
    expect(dayOf(item({ plannedOn: '2026-10-03' }))).toBe('2026-10-03')
    expect(dayOf(item())).toBeNull()
  })
  it('buckets done > planned > unplanned', () => {
    expect(itemStatus(item({ doneOn: '2026-09-26', plannedOn: '2026-09-26' }))).toBe('done')
    expect(itemStatus(item({ fixedOn: '2026-11-07' }))).toBe('planned')
    expect(itemStatus(item())).toBe('unplanned')
  })
})

describe('itemsByDay / weekendPlans', () => {
  const sat = item({ plannedOn: '2026-10-03', position: 5 })
  const sat2 = item({ plannedOn: '2026-10-03', position: 2 })
  const fixedFri = item({ fixedOn: '2026-10-02' })
  const wed = item({ fixedOn: '2026-09-30' })
  const mon = item({ plannedOn: '2026-09-28' })
  const loose = item()
  const all = [sat, sat2, fixedFri, wed, mon, loose]

  it('keys items by their day in position order', () => {
    const map = itemsByDay(all)
    expect(map.get('2026-10-03')!.map((i) => i.id)).toEqual([sat2.id, sat.id])
    expect(map.get('2026-10-02')).toEqual([fixedFri])
    expect([...map.values()].flat()).not.toContain(loose)
  })

  it('lays weekend days out and hangs weekday items on their week’s card', () => {
    const plans = weekendPlans(all, weekends(FALL, '2026-09-26'))
    const oct2 = plans.find((p) => p.weekend.fri === '2026-10-02')!
    expect(oct2.fri).toEqual([fixedFri])
    expect(oct2.sat.map((i) => i.id)).toEqual([sat2.id, sat.id])
    expect(oct2.sun).toEqual([])
    expect(oct2.otherDays.map((i) => i.id)).toEqual([mon.id, wed.id])
    expect(plans[0].otherDays).toEqual([])
  })
})

describe('unplanned', () => {
  it('keeps open, dayless items (children too), deadline first, nulls last, then position', () => {
    const late = item({ byOn: '2026-10-31', position: 1 })
    const soon = item({ byOn: '2026-10-18', position: 9 })
    const none1 = item({ position: 3 })
    const none2 = item({ position: 2 })
    const child = item({ parentId: none1.id, byOn: '2026-10-18', position: 4 })
    const done = item({ doneOn: '2026-09-26' })
    const planned = item({ plannedOn: '2026-10-03' })
    const fixed = item({ fixedOn: '2026-11-07' })
    expect(unplanned([late, soon, none1, none2, child, done, planned, fixed]).map((i) => i.id)).toEqual([
      child.id,
      soon.id,
      late.id,
      none2.id,
      none1.id,
    ])
  })
})

describe('missed', () => {
  it('returns planned-but-past open items, oldest first, never fixed or done ones', () => {
    const a = item({ plannedOn: '2026-09-20' })
    const b = item({ plannedOn: '2026-09-13' })
    const todayItem = item({ plannedOn: '2026-09-26' })
    const done = item({ plannedOn: '2026-09-13', doneOn: '2026-09-13' })
    const fixed = item({ fixedOn: '2026-09-13' })
    expect(missed([a, b, todayItem, done, fixed], '2026-09-26').map((i) => i.id)).toEqual([b.id, a.id])
  })
})

describe('urgency', () => {
  const fallWeekends = (today: string) => weekends(FALL, today)

  it('is null when done, planned, fixed, or deadline-free', () => {
    const w = fallWeekends('2026-09-26')
    expect(urgency(item({ byOn: '2026-10-18', doneOn: '2026-09-26' }), '2026-09-26', w)).toBeNull()
    expect(urgency(item({ byOn: '2026-10-18', plannedOn: '2026-10-03' }), '2026-09-26', w)).toBeNull()
    expect(urgency(item({ byOn: '2026-10-18', fixedOn: '2026-10-03' }), '2026-09-26', w)).toBeNull()
    expect(urgency(item(), '2026-09-26', w)).toBeNull()
  })

  it('counts remaining weekends and days, deadline day included', () => {
    const u = urgency(item({ byOn: '2026-10-18' }), '2026-09-26', fallWeekends('2026-09-26'))
    expect(u).toEqual({ level: 'ok', weekendsLeft: 4, weekendDaysLeft: 11 })
  })

  it('turns urgent at two weekends left', () => {
    const u = urgency(item({ byOn: '2026-10-18' }), '2026-10-10', fallWeekends('2026-10-10'))
    expect(u).toEqual({ level: 'urgent', weekendsLeft: 2, weekendDaysLeft: 5 })
    expect(urgency(item({ byOn: '2026-10-18' }), '2026-10-05', fallWeekends('2026-10-05'))!.level).toBe('urgent')
    expect(urgency(item({ byOn: '2026-10-18' }), '2026-10-02', fallWeekends('2026-10-02'))!.level).toBe('ok')
  })

  it('is overdue once the deadline has passed', () => {
    const u = urgency(item({ byOn: '2026-10-18' }), '2026-10-19', fallWeekends('2026-10-19'))
    expect(u).toEqual({ level: 'overdue', weekendsLeft: 0, weekendDaysLeft: 0 })
  })

  it('is still urgent (not overdue) on the deadline day itself', () => {
    const u = urgency(item({ byOn: '2026-10-31' }), '2026-10-31', fallWeekends('2026-10-31'))
    expect(u).toEqual({ level: 'urgent', weekendsLeft: 1, weekendDaysLeft: 1 })
  })
})

// --- sections ----------------------------------------------------------------------------

describe('groupSections', () => {
  it('orders sections and subsections by their lowest position, and nests children', () => {
    const drinksA = item({ section: 'Drinks', subsection: 'Alcoholic', position: 10 })
    const cider = item({ section: 'Drinks', subsection: 'Alcoholic', position: 11 })
    const sub2 = item({ parentId: cider.id, section: 'Drinks', subsection: 'Alcoholic', position: 13 })
    const sub1 = item({ parentId: cider.id, section: 'Drinks', subsection: 'Alcoholic', position: 12 })
    const bread = item({ section: 'Food', subsection: 'Baked goods', position: 1 })
    const meal = item({ section: 'Food', subsection: 'Meals', position: 5 })
    // Out of written order: a later Baked goods item still groups under it.
    const donut = item({ section: 'Food', subsection: 'Baked goods', position: 7 })
    const na = item({ section: 'Drinks', subsection: 'NA', position: 2 })

    const groups = groupSections([sub2, drinksA, meal, sub1, donut, cider, na, bread])
    expect(groups.map((g) => g.section)).toEqual(['Food', 'Drinks'])
    expect(groups[0].subsections.map((s) => s.subsection)).toEqual(['Baked goods', 'Meals'])
    expect(groups[0].subsections[0].nodes.map((n) => n.item.id)).toEqual([bread.id, donut.id])
    // NA's min position (2) beats Alcoholic's (10).
    expect(groups[1].subsections.map((s) => s.subsection)).toEqual(['NA', 'Alcoholic'])
    const alcoholic = groups[1].subsections[1].nodes
    expect(alcoholic.map((n) => n.item.id)).toEqual([drinksA.id, cider.id])
    expect(alcoholic[1].children.map((c) => c.id)).toEqual([sub1.id, sub2.id])
  })

  it('keeps a child under its parent even if its own section differs', () => {
    const parent = item({ section: 'Event' })
    const child = item({ section: 'Food', parentId: parent.id })
    const groups = groupSections([parent, child])
    expect(groups).toHaveLength(1)
    expect(groups[0].subsections[0].nodes[0].children).toEqual([child])
  })

  it('promotes an orphaned child (parent filtered out) to top level', () => {
    const child = item({ section: 'Event', parentId: 'gone' })
    expect(groupSections([child])[0].subsections[0].nodes[0]).toEqual({ item: child, children: [] })
  })

  it('lets a child pull its section earlier', () => {
    const late = item({ section: 'B', position: 20 })
    const kid = item({ section: 'B', parentId: late.id, position: 1 })
    const a = item({ section: 'A', position: 5 })
    expect(groupSections([late, kid, a]).map((g) => g.section)).toEqual(['B', 'A'])
  })

  it('handles an empty list', () => {
    expect(groupSections([])).toEqual([])
  })
})

describe('sectionKeys / subsectionsOf', () => {
  const items = [
    item({ section: 'Indoor', subsection: 'Movies', position: 3 }),
    item({ section: 'Food', subsection: 'Meals', position: 1 }),
    item({ section: 'Indoor', subsection: 'TV', position: 4 }),
    item({ section: 'Halloween', subsection: '', position: 5 }),
  ]
  it('lists sections in bucket-list order', () => {
    expect(sectionKeys(items)).toEqual(['Food', 'Indoor', 'Halloween'])
  })
  it('lists named subsections of a section', () => {
    expect(subsectionsOf(items, 'Indoor')).toEqual(['Movies', 'TV'])
    expect(subsectionsOf(items, 'Halloween')).toEqual([])
    expect(subsectionsOf(items, 'Nope')).toEqual([])
  })
})

describe('filterItems', () => {
  const food = item({ section: 'Food' })
  const foodDone = item({ section: 'Food', doneOn: '2026-09-26' })
  const event = item({ section: 'Event', plannedOn: '2026-10-03' })
  const all = [food, foodDone, event]

  it('passes everything with no filter', () => {
    expect(filterItems(all, {}, {})).toEqual(all)
  })
  it('includes sections (OR) and ANDs with the status row', () => {
    expect(filterItems(all, { Food: 'include' }, {})).toEqual([food, foodDone])
    expect(filterItems(all, { Food: 'include' }, { done: 'exclude' })).toEqual([food])
    expect(filterItems(all, {}, { planned: 'include', unplanned: 'include' })).toEqual([food, event])
  })
  it('vetoes excluded sections', () => {
    expect(filterItems(all, { Food: 'exclude' }, {})).toEqual([event])
  })
})

// --- nesting -------------------------------------------------------------------------------

describe('canNestUnder / parentChoices', () => {
  const top = item({ section: 'Drinks', subsection: 'Alcoholic' })
  const kid = item({ section: 'Drinks', subsection: 'Alcoholic', parentId: top.id })
  const other = item({ section: 'Drinks', subsection: 'Alcoholic' })
  const elsewhere = item({ section: 'Drinks', subsection: 'Alcoholic', seasonId: 's2' })
  const items = [top, kid, other, elsewhere]

  it('allows a top-level parent in the same season', () => {
    expect(canNestUnder(items, null, top.id, 's1')).toBe(true)
    expect(canNestUnder(items, other.id, top.id, 's1')).toBe(true)
  })
  it('refuses a second level, self, missing, cross-season, and a parent becoming a child', () => {
    expect(canNestUnder(items, null, kid.id, 's1')).toBe(false)
    expect(canNestUnder(items, top.id, top.id, 's1')).toBe(false)
    expect(canNestUnder(items, null, 'gone', 's1')).toBe(false)
    expect(canNestUnder(items, null, elsewhere.id, 's1')).toBe(false)
    expect(canNestUnder(items, top.id, other.id, 's1')).toBe(false)
  })
  it('offers top-level items of the same subsection, minus the item itself', () => {
    expect(parentChoices(items, 's1', 'Drinks', 'Alcoholic', other.id).map((i) => i.id)).toEqual([top.id])
    expect(parentChoices(items, 's1', 'Drinks', 'NA', null)).toEqual([])
  })
})

// --- positions / cascades / copy ------------------------------------------------------------

describe('positions', () => {
  it('appends after the season’s last item', () => {
    const items = [item({ position: 4 }), item({ position: 9, seasonId: 's2' })]
    expect(nextPosition(items, 's1')).toBe(5)
    expect(nextPosition(items, 's3')).toBe(1)
  })
  it('puts a duplicate right after the original, within its season', () => {
    const a = item({ position: 1 })
    const b = item({ position: 2 })
    const foreign = item({ position: 1.2, seasonId: 's2' })
    expect(positionAfter([a, b, foreign], a.id)).toBe(1.5)
    expect(positionAfter([a, b, foreign], b.id)).toBe(3)
  })
  it('sorts by position with a stable tiebreak', () => {
    const x = item({ position: 1, id: 'b' })
    const y = item({ position: 1, id: 'a' })
    expect(byPosition([x, y]).map((i) => i.id)).toEqual(['a', 'b'])
  })
})

describe('pruneSeason / pruneItem', () => {
  it('drops a season’s items only', () => {
    const a = item()
    const b = item({ seasonId: 's2' })
    expect(pruneSeason([a, b], 's1')).toEqual([b])
  })
  it('drops an item and its sub-options', () => {
    const parent = item()
    const kid = item({ parentId: parent.id })
    const other = item()
    expect(pruneItem([parent, kid, other], parent.id)).toEqual([other])
    expect(pruneItem([parent, kid, other], kid.id)).toEqual([parent, other])
  })
})

describe('cloneSeasonItems', () => {
  it('clones content and structure with fresh ids, remapped parents, and no dates', () => {
    const parent = item({ title: 'hard cider', note: 'n', url: 'u', position: 2, byOn: '2026-10-31', plannedOn: '2026-10-03' })
    const kid = item({ title: 'Sociable', parentId: parent.id, position: 3, doneOn: '2026-09-26' })
    const first = item({ title: 'mulled wine', position: 1, fixedOn: '2026-11-07' })
    let n = 0
    const clones = cloneSeasonItems([kid, parent, first], 'new', () => `c${++n}`, 'u2', '2026-12-01T00:00:00Z')

    expect(clones).toHaveLength(3)
    // Parents first, so row-by-row inserts never dangle.
    expect(clones.at(-1)!.title).toBe('Sociable')
    const byTitle = Object.fromEntries(clones.map((c) => [c.title, c]))
    expect(byTitle['Sociable'].parentId).toBe(byTitle['hard cider'].id)
    expect(new Set(clones.map((c) => c.id)).size).toBe(3)
    for (const c of clones) {
      expect(c.seasonId).toBe('new')
      expect([c.fixedOn, c.byOn, c.plannedOn, c.doneOn]).toEqual([null, null, null, null])
      expect(c.createdBy).toBe('u2')
      expect(c.id).toMatch(/^c/)
    }
    expect(byTitle['hard cider']).toMatchObject({ note: 'n', url: 'u', position: 2, section: 'Food' })
  })
})

// --- seed sanity -----------------------------------------------------------------------------

describe('Fall 2026 seed', () => {
  const { seasons, items } = seed()

  it('is one season with the whole list', () => {
    expect(seasons).toHaveLength(1)
    expect(seasons[0]).toMatchObject({ name: 'Fall 2026', emoji: '🍂', startsOn: '2026-09-22', endsOn: '2026-11-15' })
    expect(items).toHaveLength(44)
    expect(sectionKeys(items)).toEqual(['Food', 'Drinks', 'Indoor', 'Outdoor', 'Halloween', 'Event', 'Unsorted'])
  })

  it('positions increase in list order and children follow their parent', () => {
    const positions = items.map((i) => i.position)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    for (const kid of items.filter((i) => i.parentId)) {
      const parent = items.find((i) => i.id === kid.parentId)!
      expect(parent.parentId).toBeNull()
      expect(kid.position).toBeGreaterThan(parent.position)
      expect([kid.section, kid.subsection]).toEqual([parent.section, parent.subsection])
    }
    expect(items.filter((i) => i.parentId).map((i) => i.title)).toEqual([
      'Sociable Cider Werks',
      'Urban Forage Winery',
      'It Takes Two sequel game',
      'Sweetland',
      "Waldmann's (St. Paul)",
    ])
  })

  it('carries the plan / done / fixed state', () => {
    const planned = items.filter((i) => i.plannedOn === '2026-09-26' && !i.doneOn).map((i) => i.title)
    expect(planned).toEqual(['pumpkin bread', 'It Takes Two sequel game', 'Over the Garden Wall or a movie?', 'mulled wine / cider?'])
    expect(items.filter((i) => i.doneOn).map((i) => i.title)).toEqual(['ren faire'])
    expect(items.filter((i) => i.fixedOn).map((i) => [i.title, i.fixedOn])).toEqual([['Twin Cities Book Festival', '2026-11-07']])
    expect(items.filter((i) => i.byOn === '2026-10-18')).toHaveLength(3)
    expect(items.filter((i) => i.byOn === '2026-10-31')).toHaveLength(6)
  })
})
