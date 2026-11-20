# CLAUDE.md

Guidance for working in this repo. Read this before making changes.

## What this is

**cajubinile.com** — a personal site organized into **spaces**: each space is a
group of people (any number of members) sharing one set of data, and a person
can belong to several. Ethan's account is the one **admin**, who creates the
accounts, the spaces, their memberships, and which features each space shows
(see "Spaces, accounts & the admin" below). The site is split into features
behind a persistent Mantine AppShell header (brand link + feature nav + the
`AccountMenu`, which replaced the bare Sign out button: a space switcher when
you're in more than one, Admin for the admin, Change password, Sign out). The
nav is **one item per feature, not per route** — up to ten of them,
collapsing into the burger drawer below Mantine's `lg` breakpoint; the
tier-list routes share a single "Tier Lists" item and are chosen in-page with
the `ListPicker` pill row, and the Lists routes likewise share one "Lists"
item. The nav items and the home hub both render from one list,
`FEATURES` in `src/layout/features.ts` — a new feature goes there, with a
stable **`key`** (`'doing-stuff'`, `'tier-lists'`, … — spaces store these in
`enabled_features`, so **never rename one**). Nav, hub and routes all follow
the **current space's features**: `enabledFeatures(allow)` filters
`FEATURES`, and a disabled feature's routes `<Navigate>` to `/`. The three
unbuilt placeholder routes are off the nav but still resolve. Two more routes
are not features (not in `FEATURES`, never gated): **`/admin`** (the admin
page; anyone else bounces to `/`) and **`/set-password`** (where an admin-made
password link lands; rendered by `main.tsx` ahead of the app). Routing is
**react-router (library mode)**: `/` is the **home hub** (`HomePage` — a
static index of one ruled row per enabled feature, so any feature is one tap
from home on a phone, with an empty state when the space has none; unknown
paths redirect here); `/log`, `/wishlist`, `/map`,
`/calendar` are the Doing Stuff feature's screens; `/movies`, `/tv`, `/books`,
`/games`, and `/tiers/:id` (a space-defined board — ice cream lives here) are the **Tier Lists**
feature; `/lists/movies`, `/lists/tv`, `/lists/books`, and `/lists/:id` (a
free-form list) are the **Lists** feature (`/lists` redirects to
`/lists/movies`); `/spoons` is the **Spoons**
feature; `/parks` is the **Parks** feature; `/recipes` (+ `/recipes/plan`,
`/recipes/:id`) is the **Recipes** feature, meal plan included;
`/music-practice` is the **Music Practice** feature;
`/little-guys` is the **Little Guys** feature; `/seasons` (+ `/seasons/:id`)
is the **Seasons** feature; `/alignment` (+ `/alignment/:id`) is the
**Alignment** feature; `/french-toast` is a placeholder
page for a feature not built yet (a french toast ranking). Every feature's data
belongs to one space — new tables follow the same `space_id` +
`is_space_member()` RLS pattern — and the stores are handed the **current**
space's id, so switching spaces swaps every feature's data.

**Doing Stuff** — the original feature — is a shared activity tracker for logging
a space's outings. The domain model:

- **Category** (e.g. Outdoor, City, Brain) — has a name and a color.
- **Activity** belongs to a category (e.g. Outdoor → Park, Swimming) and has an
  optional single **emoji** used as its map-pin icon.
- **Entry** (a logged outing) references one activity and adds a **title**,
  **date**, **description**, **1–5 star rating**, and an optional **address**,
  geocoded to lat/lng on save for the map (`hideFromMap` keeps it off).
- **Repeat** (`entry_repeats`) — an additional date you returned to an entry's
  place/activity. Total count = 1 + repeats; always derived, never stored.
- **Wishlist item** — a free-text "thing to try", optionally with a
  geocoded place (⭐ pin). Checking one off opens a prefilled entry modal;
  saving links the item to the new entry (= done). Deleting that entry reopens
  the wish (DB `on delete set null`, mirrored in the store).
- **Home** — a per-space address (on the `spaces` row) that centers the map.

Doing Stuff has four screens (routes) behind an in-feature toggle: **Log**
(dashboard: stats, category filter, fuzzy title search, cards/table views,
sort), **Wishlist**, **Map** (Leaflet; emoji pins for entries, ⭐ for open
wishes, 🏠 for home, with its own category/wishlist filter), and **Calendar**
(month grid of entries + repeats). The category filter (`CategoryPills`,
shared by Log and Calendar; the Map keeps its own copy plus a Wishlist pill)
is tri-state like every filter row, and including a category opens a second
row of its **activity** pills — the subcategory filter: an included activity
narrows its category to the included activities, an excluded one drops just
that activity (`entryMatcher` in the doing-stuff `derive.ts`). All four routes render the same
`DoingStuffPage` component, so its store (and realtime channel) survives screen
switches. Entry editing, repeats, and category/activity/home management happen
in modals.

**Tier Lists** (`/movies`, `/tv`, `/books`, `/games`, `/tiers/:id`) —
drag-n-drop S/A/B/C/D/F boards — **tiers only**; the want-to queues are the
separate Lists feature below, and each movie/TV/book board links to its list
from the control bar (the games board has no list). Five routes, ONE header nav item: which board
you're on is chosen in-page by the `ListPicker` pill row (four built-ins, then
the space's own lists, then "+ New list" and — on a custom board — a faint
"Edit list"). The domain model splits pool from opinion:

- **Custom list** (`tier_lists`) — a board the space defines from the UI
  ("Ice Cream", "Bugs", "Fruits"), shared data with the uniform RLS: any
  member can create, re-word, or delete one. Behavior is **fixed to one
  template** (shared pool, S–F tiers, one unranked shelf, hand-pasted
  image URLs, no search provider, no dates at all), so the row carries
  WORDS — `name`, `emoji`, singular `noun` — which `customCopy()` in
  the tier-list `copy.ts` templates into a full `KindCopy` — plus ONE
  behavior flag, **`shared`** (the "Shared board" checkbox in `ListModal`):
  a shared list has **one board the space ranks together** instead of a
  board per member. Its placements are `tier_placements` rows with a **null
  `user_id`** (the unique index is `nulls not distinct`, so still one row
  per item); RLS lets any member write null-owner rows, but only for items
  on a list flagged shared (`is_shared_board_item()`). App-side
  `isSharedBoard(key, lists)` / `placementOwner(shared, viewerId)` in the
  tier-list `derive.ts` are the switch: the page hides the member
  picker, always renders the drag board, and passes `shared` to the
  placement actions. Flipping the flag never moves rankings — the other
  mode's rows stay in the DB and reappear if it's flipped back. Its items carry
  `kind = 'custom'` plus a `list_id` FK, so **deleting a list is one
  statement** and Postgres cascades the items (and every member's
  placements/completions of them); the store mirrors that with `pruneList()`.
  App-side a board is one **`ListKey`**: a `TierKind` or `` `list:${id}` ``
  (`TierKind` itself stays a closed 4-member union — movies/TV/books/games are built in only for their search providers and (all but games) want-to lists; everything else, ice cream included, is a `tier_lists` row). `copyFor(key, lists)`
  resolves either into wording — and never throws for a list row that's gone,
  so another member's tab survives the beat between a realtime DELETE and the
  `<Navigate>` back to `/movies`.
- **Tier item** (`tier_items`) — a movie, show, book, or
  custom-list item in the
  space's **shared pool** (a `kind 'movie'|'tv'|'book'|'custom'`
  column plus a nullable `list_id`, a
  title, a hand-pasted poster/cover `image_url`, a nullable `done_on` date —
  the SHARED "the space finished it" date; defaults to today on a board add or a
  Lists check-off.
  Movies/TV only — books and games leave it null and use per-person completions instead,
  and a **custom list ignores it entirely**: it tracks no date, so its board
  has no second shelf and its item modal no date field (`dates: null` in the
  tier-list `copy.ts`, mirrored by `hasUndatedShelf()` in its `derive.ts`)
  — and free-text
  **`tags`** (`text[]`, e.g. "disney", "fantasy") shared like the item — the
  **Shared tags** — plus each member's own **My tags** (see Personal tags
  below). The board page filters by them with two labeled tri-state pill
  rows, **Shared** then **Mine**, which AND together (see the tri-state filter
  convention below; matched case-insensitively; each row's state is pruned to
  tags still in use). "Mine" is always the **viewer's own** tags — also on
  another member's board. A filtered board is **read-only** — hidden cards make
  drop positions ambiguous — so it renders `BoardView` with clickable cards.
  Items also carry a free-text **`creator`** — who made it, shared like the
  title and shown as a faint line under the card title; the modal labels it
  per kind via `creatorLabel` in `copy.ts` (Author / Director / Creator /
  Brand or shop), and picking an Open Library suggestion prefills the author.
  Built-in kinds also carry a shared **`release_year`** (nullable integer,
  year only — `src/lib/releaseYear.ts`): a TMDB / Open Library / IGDB pick
  fills it (books get the first-publish year), the modal's "Year" field
  edits it beside the creator, and the card's faint line reads
  "2021 · Denis Villeneuve" (year first, so the narrow card keeps it —
  `cardByline`). Custom lists have none (`tracksReleaseYear`).
  Any member can add/edit/delete; deleting removes everyone's rankings of it.
- **Tier placement** (`tier_placements`) — **one person's** ranking of one item:
  `tier` + fractional `position` within the tier (midpoint insertion on drop =
  one-row upsert on `unique (item_id, user_id)`; the client renormalizes a tier
  to integers if float precision ever runs out). "Unranked" is the absence of a
  placement row. On the four **built-in** boards an unplaced item with **no
  date for the viewer** lands on a second dashed **Unwatched** (books:
  **Unread**, games: **Unplayed**) shelf instead (a placement wins over a missing date); dragging
  out of that shelf stamps today's date, dropping onto it unranks the card and
  clears the date. A **custom list has only the unranked shelf** — it tracks
  no date, so there's nothing to split on. The shelves are
  **collapsible and start collapsed** (heading + count; the page owns the
  open state, so it survives the member-picker and filter switches and resets
  on a board switch). The heading sits inside the droppable area, so a
  collapsed shelf still accepts drops. RLS is split:
  members **read** everyone's placements but
  **write only their own** — another member's board is read-only at the security
  boundary, not just in the UI. (Shared custom lists are the one exception —
  see Custom list above.)
- **Completion** (`tier_item_completions`) — **one person's** "I'm done with
  this" for an item; today BOOKS and GAMES use it (a `done_on` date, upsert on
  `unique (item_id, user_id)` — deliberately the same column name as the
  shared `tier_items.done_on`, so the shared and personal sides read in
  parallel). Movies/TV are watched as a group, so their date is shared on the
  item; books are read (and games played) separately, so each member marks
  their own — the same book can be ranked on one board and Unread on the other.
  `datesArePersonal()` in the tier-list `derive.ts` is the behavior switch:
  for books and games, shelf drags and the modal's date field write the viewer's own
  completion row and never touch the item's shared `done_on`.
  Same split RLS as placements (read everyone's, write only your own).
- **Personal tags** (`tier_item_user_tags`) — **one person's** own filter
  labels for an item ("comfort", "rewatch"): a `tags text[]`, upsert on
  `unique (item_id, user_id)`, no row = none (saving an empty list deletes
  it). Same split RLS as completions, so they're **hidden by the UI, not
  secret** — the app only ever reads the signed-in member's rows
  (`userTagMap` / `distinctUserTags` / `filterByUserTags` in the tier-list
  `derive.ts`). Work on every board, shared custom lists included; the item
  modal edits them in a second "My tags" field.

All five routes render the same `TierListPage` (a `kind` prop for a built-in,
the URL's list id for `/tiers/:id`), so the store —
holding every kind plus all users' placements and completions — survives
kind switches. A
**member picker** swaps whose board is derived: `boardViewers(memberIds,
profiles, selfId)` in the tier-list `derive.ts` lists "You" first, then this
space's other members in join order (the store reads `space_members` for the
current space, so it never offers someone from another space — the
`profiles` select alone returns co-members of *every* space); a
SegmentedControl up to three boards, a Select beyond (`MAX_SEGMENTED_VIEWERS`),
just a "You're the only one in this space" line for a one-member space. Yours is a dnd-kit board
(`TierBoard`), anyone else's is the same layout with no drag wiring
(`BoardView`). The control bar's link to the board's want-to list renders
only when the space has Lists on (`useFeatureEnabled('lists')`), and a faint
**"Pull from…"** copies boards in from another space (see Cross-space pull).
Drops are optimistic: on write failure the store records the
error and refetches, so the card snaps back. Per-kind wording (watch/read,
shelf labels, emoji, hints) lives in the tier-list `copy.ts`.

**Lists** (`/lists/movies`, `/lists/tv`, `/lists/books`, `/lists/:id`) — the
want-to queues, one list on screen at a time, built to show most of a list
without scrolling. Four routes render one `ListsPage` (a `kind` prop for the
three built-ins, the URL's id for a free-form list), so the store survives
switching lists; a `PickerRow` pill row above the control bar picks which
(🎬 Movies · 📺 TV · 📖 Books · each free-form list · "+ New list" · a faint
"Edit list" on a free-form list). The domain model:

- **Free-form list** (`lists`) — a list the space defines from the UI
  ("Groceries", "Restaurants to try"): just `name` + `emoji`, shared data
  with the uniform RLS. Deleting one cascades its rows in the DB; the store
  mirrors that with `pruneListDef()`. The movie/TV/book lists are built in
  and have no row here.
- **List item** (`list_items`) — one row on one list: `kind
  'movie'|'tv'|'book'|'custom'` plus a nullable `list_id` (→ `lists`), a
  `title`, an optional `image_url` and `creator` (Director / Creator / Author;
  on a free-form list the same column is the optional **Note**), a nullable
  **`release_year`** on media rows (filled by a search pick, shown after the
  creator, carried onto the tier item at check-off — and onto an existing
  board item that has none), a fractional
  `position` (midpoint insertion via `src/lib/order.ts`, drag-to-reorder, top
  = next up, new rows append at max + 1), and TWO done markers: `tier_item_id`
  for media rows and `done_on` for free-form rows — `isDone()` in the lists
  `derive.ts` is `tierItemId !== null || doneOn !== null`. Movie/TV lists are
  shared; the **book reading list is per person** — owned via `created_by`,
  the page shows only the viewer's rows (`listIsPersonal()`), and RLS lets only
  the owner write a book row. App-side a list is one **`ListRef`**: `'movie' |
  'tv' | 'book'` or `` `custom:${id}` `` (deliberately not the tier-list
  `ListKey` — a `custom:` ref points at a `lists` row, not a tier board);
  `copyFor(ref, lists)` in the lists `copy.ts` resolves it into a `ListCopy`
  and never throws for a gone list.
- **Check-off** — a movie/TV/book row creates the tier item exactly as a board
  add would (shared `done_on = today` for movies/TV; for books `done_on: null`
  plus the checker's own `tier_item_completions` row — `datesArePersonal()`
  from the tier-list `derive.ts` is the switch), carries the image and creator
  onto it, then links via `tier_item_id`, so it lands on the board's Unranked
  shelf. The Lists store writes `tier_items` directly; the tier page's own
  realtime channel picks it up. Unchecking clears the link (the tier item
  stays on the board). Deleting the tier item reopens the row via the FK
  `on delete set null`, which reaches an open Lists tab as a realtime UPDATE
  on `list_items` — no cross-table read. A free-form row just gets
  `done_on = today`. Seed mode can't show the card on the tier seed (separate
  in-memory stores). In a space with **Tier Lists off** the check-off still
  writes the tier item (the data is there if the feature comes back), but
  `copyFor(ref, lists, { boards: false })` swaps in wording that promises no
  board.

UI: inline **quick-add** at the top of the list (Enter adds a title-only row;
picking a TMDB / Open Library suggestion from the shared `TitleSearchInput`
adds it with poster + creator), dense ~38px rows in one bordered panel
(checkbox · 22×32 thumb · title · faint creator · ×), a collapsed **Done · n**
section below the open queue (strikethrough rows, uncheck, no dates), edits in
`ListItemModal`, list create/rename/delete in `ListDefModal`. Deliberately no
realtime-derived dates and no member picker.

**Seasons** (`/seasons`, `/seasons/:id`) — the seasonal bucket list, built
to make it EASY TO PLAN a season's activities onto its remaining weekends.
The domain model (both tables shared space data, uniform RLS):

- **Season** (`seasons`) — `name` + one `emoji` (🍂 default) + an inclusive
  `starts_on`/`ends_on` range (a check keeps end ≥ start). `/seasons` forwards
  to `currentSeason()` — the one containing today, else the latest started,
  else the earliest upcoming — or shows an empty state with "+ New season".
  Creating one can **"Copy items from"** another (`cloneSeasonItems()` in
  the seasons `derive.ts`): sections / subsections / titles / notes / urls /
  positions and the parent structure come over with remapped ids (client-minted
  uuids, one multi-row insert), but **all four dates are cleared**. Deleting a
  season cascades its items (store mirror: `pruneSeason()`).
- **Season item** (`season_items`) — free-text `section` ("Food") and
  `subsection` ("Baked goods", '' = none; a blank section saves as
  **Unsorted**), `title`, `note`, `url`, fractional `position`, and an
  optional `parent_id` — ONE level of nesting: a **sub-option** ("Sweetland"
  under "apple orchard") must sit under a top-level item of the same season
  (`canNestUnder`), **inherits its parent's section/subsection** (the store
  forces it, and moving a parent carries its children), and is deleted with
  it (`on delete cascade`, mirrored by `pruneItem()`). Four dates:
  **`fixed_on`** (an event with a set day — it sits there and **can't be
  re-planned**; saving one **clears `planned_on`**), **`by_on`** (a "do it
  before" deadline), **`planned_on`** (ONE planned day per item — to do
  something twice, **Duplicate** it: a copy right after the original with no
  planned/done date), and **`done_on`** (check-off = today). `dayOf(item)` =
  fixed ?? planned.

Two screens behind an in-page **Bucket list / Plan** SegmentedControl (page
state, like Spoons), with a `PickerRow` of seasons + "+ New season" + a faint
"Edit season" above it. **Bucket list**: sections as serif headings,
subsections as panels in a two-up grid (one column on a phone), dense rows
(check · title · faint note · ↗ link · a day/deadline chip), sub-options
indented under their parent, done rows struck through, a borderless quick-add
at the foot of each subsection, and two tri-state pill rows (sections, then
Unplanned / Planned / Done — `filterItems`). The title opens `ItemModal`
(Autocomplete section/subsection, "Sub-option of" from `parentChoices`, note,
link, fixed / by / planned dates, Duplicate in the header, Delete via
`useConfirm`). **Plan** — the point of the feature: "N weekends left", an
**Unplanned** tray sorted by deadline (`unplanned()`), a **Missed** tray
(planned days that went by undone — `missed()` **excludes fixed items**, the
event is simply past), and one card per remaining weekend (`weekends()` —
**Fri · Sat · Sun only**, a weekend counts while its Sunday ≥ today; three
columns on desktop, stacked label-beside-items rows on a phone), each day
with its items (checkbox, 📌 for fixed) and a quick-add that files a new item
under **Unsorted** planned on that day; Mon–Thu-dated items hang off their
week's card as an "Other days" line (`weekendPlans`). **Scheduling is
tap-based, no drag-and-drop**: any item (tray row, day row, bucket-list chip)
opens `SchedulePopover` — a chip per remaining weekend day
(`weekendDayGroups`; the current day ✓-filled, days after the deadline
dashed), Unplan, and Edit…; a fixed item's popover only explains itself.
Deadlines are counted in weekends left (`urgency()`): ≤ 2 = urgent, past =
overdue, and the chip says so in words and an icon (`itemTag()`:
"⚠ by 10/18 · 2 weekends left", "⚠ by 10/1 · overdue", "📌 Sat 11/7") —
**never color alone**, per the parks rule. All date math is local-day
arithmetic in the seasons `derive.ts` (UTC day counts, never
`toISOString`), DST-safe. Scope cuts (deliberate): no Doing Stuff entry on
check-off, no weather, no links to recipes/tier items, no drag-and-drop, no
realtime-derived "who planned it".

**Alignment** (`/alignment`, `/alignment/:id`) — any number of D&D-style
3×3 alignment charts. A **chart** (`alignment_charts`, shared space data,
uniform RLS) is a `title` plus the text in each of the nine **fixed** squares
— Lawful Good … Chaotic Evil — stored as **one column per square**
(`lawful_good`, …, `true_neutral`, …, `chaotic_evil`; '' = blank), so filling
in a square is a one-column UPDATE that can't clobber another member editing
another. App-side the squares are `cells: Record<AlignmentKey, string>`;
`ALIGNMENT_KEYS` (reading order, Good row first) and `alignmentLabel` live in
the alignment `derive.ts`. Both routes render one `AlignmentPage`, so the
store survives switching charts; `/alignment` forwards to the oldest chart
(`defaultChart`) or shows the empty state, and an unknown id bounces back
there. A `PickerRow` of charts + "+ New chart" + a faint "Edit chart" sits
above the control bar ("n of 9 squares filled"); `ChartModal` is title-only
(create / rename / delete via `useConfirm`). The squares **edit in place**:
tap one, type, Enter or blur saves just that square (optimistic, resync on
failure), Shift+Enter is a line break, Escape backs out. The grid stays 3×3
on a phone. Deliberately no images, colors, or per-person charts.

**Spoons** (`/spoons`) — Squabby's souvenir spoon collection. A **spoon**
(`spoons` table, shared space data, uniform RLS) has a name, an optional
**photo**, an optional free-text **place** it came from (geocoded on save like
entry addresses; lat/lng stored, blank/unlocatable = list-only), an optional
**date acquired**, and **notes**. Photos are real uploads, not pasted URLs —
the only feature using **Supabase Storage**: the public `spoons` bucket, paths
`<space_id>/<uuid>.jpg`, storage RLS restricting writes to space members (see
the storage section at the end of `schema.sql`), photos downscaled client-side
to ≤1200px JPEG before upload (`src/lib/image.ts`), and best-effort object
cleanup when a photo is replaced or its spoon deleted (`photos.ts`). One route
with an in-page **Collection / Map** toggle: a photo card grid (newest first,
undated last, 🥄 fallback) and a Leaflet map of circular photo pins that
fit-bounds to the collection on open — same-place spoons fan out a few meters
(deterministically, in `derive.ts`) so every pin stays clickable.

**Little Guys** (`/little-guys`) — the collection of little guys (Smiskis and
friends). A **little guy** (`little_guys` table, shared space data, uniform
RLS) has a required **name** and everything else optional: an uploaded
**photo** (the public `little-guys` Storage bucket — same design as spoons and
recipes, via the shared `src/lib/photos.ts`; '' shows a 🗿 fallback), a
free-text **source** (who got him for you — *not* a member reference, since
gifts come from outside the space), an **owner** (`owner_id`, a member
reference; null = "nobody in particular"), a short free-text **personality**
("shy", "a menace"), and a longer **description**. The owner says *whose* he
is, not who may edit him: the rows are shared, so any member can log or fix
up any guy. One route: an A–Z photo card grid (name · personality · owner)
with fuzzy name search (`src/lib/fuzzy.ts`) and an **owner pill row** (All /
each member in join order / Nobody in particular, each with its count — the
last pill appears only when some guy is ownerless; tri-state like every
filter row). Adding and editing happen
in one modal, which defaults a new guy's owner to the signed-in member;
deleting confirms and takes his photo with him. Deliberately no dates, no map,
no wishlist — a shelf, not a log.

**Parks** (`/parks`) — the 63-national-parks tracker. It has **two modes**:
everything below up to the group-mode paragraph (person-fixed colors,
Together, the split dot) applies to spaces of **one or two members**; a space
with three or more gets the simpler **group mode** described at the end of
this section. The parks themselves are
a **static in-repo list** (the parks feature's `parks.ts`: NPS park code as the
stable id, name, states, region, lat/lng, year established, one-line blurb,
nps.gov link) — deliberately no DB table. Only **visits** are stored:
`park_visits` (uniform shared RLS), each row = one trip with an optional
`visited_on` date ("went as a kid" is fine), notes, and `attendee_ids uuid[]`
of who went (the form requires ≥1, defaults to everyone). A park can have many
visit rows. Stats derive per person plus **Together**, which means *the same
trip* — both members on one row's attendees, not two separate visits. The
in-between case — **both have been, but never together** — is a first-class
state: it derives automatically from one solo row per person, or from one row
with both attendees plus the **`separate` boolean** (the form's "We went
separately" checkbox, shown only with >1 attendee — a shorthand so "we both
went as kids" is one row, counting toward each person's total but never
Together; the store never persists the flag on solo rows). Pin/badge colors
are **person-fixed by membership join order** (the store reads `space_members`
ordered by `created_at`) and **colorblind-safe — Ethan is red-green
colorblind**, so status is never hue-alone: first member = **blue**
(`ACCENT_BLUE` in `theme.ts`), second = **orange** (`ACCENT`), together = a
**ring** (blue around orange), both-separately = a half-and-half **split
dot**, unvisited = small + faint gray — every state also distinct in
grayscale. `MEMBER_COLORS`/`parkPin`/`memberColor` live in the parks
`derive.ts`; `StatusDot.tsx` is the single dot renderer (stats, legend, list)
with `pinVariant` mirrored by ParkMap's divIcon HTML. Keep the shape-plus-
color rule for any future meaning-carrying color in the app. One route with an in-page **Map / List** toggle and a stats strip
(each member n/63 + Together n/63). Both screens share one tri-state
**All / member / Together / Unvisited** filter pill row (`ParkFilterPills`,
state owned by `ParksPage` so it survives the toggle; `parkKeys` /
`filterParks` in the parks `derive.ts`). The map shows the filtered pins —
all 63 unfiltered (continental-US default framing; Alaska/Hawaiʻi/territories
are a pan away) — with a display-name legend; the list groups by region. Clicking a pin's popup or a
list row opens the park detail modal — static facts + visit history +
add/edit/delete trips behind an internal mode switch (deletes confirm) — and a
header "+ Log visit" button opens the same trip fields behind a searchable
park picker. Scope cuts (deliberate): no photos, no parks wishlist (the
Unvisited filter is the wishlist).

Everything above is for a space of **one or two** members. A space with
**more than two** (`isGroupSpace` in the parks `derive.ts`) switches to
**group mode**, because person colors, the ring and the split don't scale
past a pair: a **whose-map picker** in the control bar (Everyone · each
member — a SegmentedControl up to four choices, a Select beyond; page state
in `ParksPage`, default Everyone, falls back to Everyone if that member
leaves); **two pin states only** — visited for that viewer (`groupVisited`:
anyone for Everyone, else that member) = the solid blue dot, not yet = the
small faint one (`groupVariant` in `StatusDot.tsx`; size + opacity differ as
well as hue); popups and list rows say **"Visited by Avery, Sam"** (everyone
who has been, whichever map is showing — `groupStatusLine`) or "Not visited
yet"; a Visited / Not yet legend; a stats strip of each member n/63 with no
Together and no color dots; **All / Visited / Unvisited** filter pills read
against the viewer (`groupParkKeys` / `filterGroupParks`; the page prunes
the other mode's keys); attendee checkboxes without color dots and no "went
separately" checkbox (the store never persists `separate` in a group
space); trip history joins names with commas and never says "separately".
No together/each-of-you wording in group mode. In keyless seed mode the
Parks seed follows the current seed space's `SEED_MEMBERS`
(`src/data/seedSpaces.ts`): "Friends" has a third member (Riley), so Parks
there runs in group mode (`e2e/parks-group.spec.ts`).

**Recipes** (`/recipes`, `/recipes/:id`) — the shared cookbook. Deliberately a
**pure cookbook**: only recipes the space has actually made, fully written out — no
ratings (opinions live in the notes field), no cook log, no to-try queue, no
URL auto-import (the app stays serverless; you copy-paste). A **recipe**
(`recipes` table, shared uniform RLS) has a required title and everything else
optional: plain-text **ingredients** (one per line → rendered as tappable
bullets), one **steps** textarea (**blank lines split numbered steps**; single
newlines survive inside a step — parsing lives in the recipes feature's
`derive.ts`), a **source** (free text + optional URL, shown as the attribution
line), free-text **tags** (`text[]`, tri-state include/exclude filter pills
like the tier boards), plain-text **servings** and **total time** (display
only, no scaling math), **notes**, a **grocery list** (`grocery_list` — the
ingredients as they go on a shopping list, one per line with no prep, plus
`staple_items text[]` naming the lines, by text, flagged as pantry staples;
**shown only in the edit modal**, never on the recipe page — its staples are
tap-to-flag ★/☆ chips, shape + words; helpers in the recipes `derive.ts`), and ONE hero **photo** uploaded to the
public `recipes` Storage bucket (same design as spoons; shared helpers in
`src/lib/photos.ts`). The index (`/recipes`) is A–Z (no sort control) with
fuzzy title search (`src/lib/fuzzy.ts`, shared with the Log dashboard) and a
**Grid / List** toggle (photo cards vs dense rows). Opening a recipe navigates
to **`/recipes/:id` — the app's first full-page sub-route detail** (both
routes render one `RecipesPage`, so the store survives; the AppLayout nav
matches sub-paths). The detail page is built for cooking from a phone:
tapping an ingredient strikes it through, tapping a step dims it — **stored
and shared**: index arrays on the row (`crossed_ingredients` / `done_steps`)
that stream to the other members over the recipes realtime channel. A tap writes
through the `set_recipe_mark()` RPC (adds/removes ONE index in SQL, so
simultaneous taps can't clobber each other); an edit carries marks across by
line text (`remapMarks` in the recipes `derive.ts`) and only writes the list
whose text changed; "Uncheck all" clears both for the next batch — plus a faint
"Added by X · date" byline (profiles join). Add/edit stay in a `ModalShell`
modal; delete confirms and bounces an open detail page back to the index. The
index's control bar has a faint **"Pull from…"** that copies recipes in from
another space (see Cross-space pull).

**Meal plan** (`/recipes/plan`) — the Recipes feature's second screen,
behind a **Cookbook / Meal plan** SegmentedControl in the control bar (it
navigates, so each screen deep-links; all three recipe routes render one
`RecipesPage`, which holds both stores). Lives in `src/features/meal-plan/`.
The domain model (both tables shared space data, uniform RLS):

- **Meal plan day** (`meal_plan_days`) — **one row per day per meal**, `meal
  'lunch'|'dinner'` (`unique (space_id, day, meal)`, so a write is an upsert
  on it and the realtime upsert matches on date + meal; app-side a **slot** is
  `slotKey(date, meal)`, ordered lunch before dinner by `compareSlots`).
  `kind 'recipe'|'text'|'leftovers'`:
  `recipe_id` (→ `recipes`, `on delete set null` — the meal then reads
  "Deleted recipe"), free `text`, or `leftovers_of` (→ an earlier
  `meal_plan_days` row, `on delete set null` → plain "Leftovers", mirrored in
  the store's `clearDay`). Leftovers can be of any recipe meal **before the
  slot, back to the same day last week** (`leftoverSources` — so lunch can
  eat last night's dinner), and add nothing to groceries.
  `groceries_sent text[]` — the recipe's ingredient lines (by text) the
  grocery step already sent; **reset when the meal's recipe changes**.
- **Grocery staple** (`grocery_staples`) — one pantry word per row ("salt",
  "olive oil"); an ingredient line mentioning one (**whole word, any case** —
  `isStaple`) starts unticked.

UI: weeks run **Sunday → Saturday**; a **This week / Next week** toggle (no
further browsing), "n of 7 dinners · n of 7 lunches", and seven dense day
rows (past days faded, today labeled "today"), each with a Lunch and a Dinner
line. Tapping a meal opens `DayPopover`: a searchable recipe Select, a
"Something else" text field, leftovers chips ("Shakshuka (Sun dinner)"),
Clear. A recipe meal gets a ↗ to `/recipes/:id`. **🛒 Plan groceries** (shown
only when the space has Lists on, since it writes into Lists) opens
`GroceryModal`: each recipe meal's lines as checkboxes — its **grocery list** when
written, else its ingredient lines (`recipeGroceryLines`) — **ticked by default except
staples (flagged on the recipe, or matching a pantry staple) and already-sent lines** (each untick reason shown as a word tag),
an "Extra items" textarea (one per line), and the staples editor (a new staple
unticks its matches). Sending writes **into the Lists feature**: the space's
free-form list named **"Groceries"** (any case, oldest wins —
`findGroceriesList`; created with 🛒 on first use), one `list_items` row per
line, appended, **no merging** — the recipe title goes in the row's note
(`creator`). Then each meal's `groceries_sent` is updated, and the modal offers
"Open Groceries list →". Seed mode only records what was sent (the Lists seed
is a separate in-memory store). Scope cuts (deliberate): no breakfast, no
quantity parsing, no copying weeks, no past-week browsing.

**Music Practice** (`/music-practice`) — a personal practice tracker with an
in-page **Bassoon / Piano** toggle. **Piano** is stateless: a "Randomize"
button draws a random key + scale/chord from the reference tables in the
music-practice `derive.ts` (no persistence). **Bassoon** is the only stored
part: a **practice day** (`music_practice_days` table) is **per-person**
(same split RLS as tier placements — members read all, write only their own),
one row per calendar day, holding a **circle-of-fifths `position`** (0–11,
clockwise from C — see `CIRCLE` in `derive.ts`) and an optional **`tempo`**
(BPM). The Bassoon screen is an SVG circle-of-fifths wheel (three concentric
bands: majors / key signatures / relative minors) with its own **Today /
History** sub-toggle. Key interaction: **tapping a wedge only *selects*
(local pending state) — nothing is written until the "Log today" button is
pressed**, which upserts key + tempo for the day (the button reads "Log
today" / "Update today" / "✓ Logged today" by state). Both the key and tempo
**carry forward** from the last practiced day as the pre-filled starting
point. **History** is a dated list of past days (date · key · tempo,
newest-first via `daysDescending`). Deliberately **no realtime channel**
(solo, rarely-simultaneous use — another device picks it up on next load) and
no shared/together derivation. Practice **follows the person, not the
space**: the store reads by `user_id` alone (the SELECT policy also admits
`user_id = auth.uid()`, and the unique key is `(user_id, practice_date)`), so
your history is the same in every space; upserts still stamp the current
`space_id`. The store (`useBassoonStore`) follows the lighter data-seam
pattern: Supabase CRUD by user, or an in-memory seed when keyless.

Shared Leaflet plumbing lives in `src/components/MapCanvas.tsx` (framed
MapContainer + CARTO tiles, `Recenter`, `FitToPins`, a divIcon cache with
`emojiIcon`) — all three feature maps (doing-stuff, spoons, parks) render
through it; new maps should too. Each of those three map components is
`React.lazy`-loaded at its page's module scope with a `Suspense` around just
the map branch, so Leaflet (JS **and** its stylesheet) only downloads for
someone who actually opens a map — keep that shape for a new one.

Visual direction: **earthy & natural** (terracotta clay, sage green, warm
paper), ported from the Claude Design "Compass" direction.

## Tech stack

- **Vite + React 19 + TypeScript**, SPA. **React Compiler** is enabled (see
  `vite.config.ts`), so components and hooks are auto-memoized — don't add
  `useMemo`/`useCallback` for render performance; use them only where a value's
  identity matters (effect dependencies). Each page renders a `<title>`
  (React 19 hoists it into `<head>`).
- **react-router v7 in plain library mode** (`BrowserRouter` + `Routes` from
  `react-router`) — no loaders, no framework mode. Cloudflare Pages serves
  `index.html` as the SPA fallback, so deep links work with no extra config.
- **Mantine v9** (`@mantine/core`) for UI components. The earthy look lives in
  two files: `src/theme.ts` (raw palette, fonts, category swatches, named color
  tokens including `colors.surface` / `colors.onAccent`, the `shadows` /
  `radii` / `text` scales, and `warmBorder(alpha)` — the source of truth) and
  `src/mantineTheme.ts`
  (translates it into a Mantine theme so components inherit it, including the
  custom Button variants `secondary` / `chip` and the SegmentedControl chip
  styling). Style with Mantine props plus inline style objects referencing
  `theme.ts` — no raw color literals in components. Reach for the named tokens
  (`colors.surface`, `shadows.card`, `radii.card`, `text.small`) rather than
  re-typing a literal, and don't pass `radius` to a Mantine Button — the
  theme's `defaultRadius` already is 10. **No Tailwind, no CSS files** —
  `index.css` holds exactly two rule sets that inline styles can't express:
  the `[data-hover-card]` hover / focus-visible treatment (its values are
  hand-copies of `warmBorder(0.3)` / `shadows.hover` / `ACCENT`) and a
  `(pointer: coarse)` rule making text fields 16px so iOS doesn't zoom on
  focus; Mantine's stylesheet provides the reset. Anything else belongs in the theme.
- **Leaflet / react-leaflet** for the map (CARTO Voyager raster tiles, keyed by
  `VITE_CARTO_API_KEY` — a free public browser key; missing = tiles carry an
  "API key required" watermark).
- **@dnd-kit** (`core` + `sortable` + `utilities`) for the tier-list drag-n-drop.
  Multi-container pattern: each tier row is a droppable + `SortableContext`;
  cross-row moves happen in `onDragOver` against a board copy frozen at drag
  start (so realtime updates can't yank cards mid-drag); `onDragEnd` writes one
  placement row. Mouse sensor uses a 4px activation distance so plain clicks
  still open the card editor; touch uses a 200ms long-press so pages scroll.
- **Nominatim** (OpenStreetMap) for address → lat/lng geocoding, called from
  the browser **on save only**, never per keystroke — see the rate-policy notes
  in `src/lib/geocode.ts`. Coords are stored on the row; the map never geocodes
  at render time.
- **TMDB** for movie/TV title + poster lookup in the tier-list item modal
  (`src/lib/tmdb.ts`, keyed by `VITE_TMDB_API_KEY` — a public browser key).
  Debounced autocomplete; picking a suggestion just fills the title and poster
  URL fields, so the stored rows stay plain text/URLs with no TMDB coupling.
  Missing key = no suggestions, hand-entry still works.
- **Open Library** for book title + cover lookup in the same modal
  (`src/lib/openLibrary.ts`) — no API key at all, so it's always on. Covers are
  plain `covers.openlibrary.org` URLs. Polite-use API like Nominatim: only the
  debounced modal autocomplete may call it, never render-time code.
- **IGDB** (Twitch's game database) for video game title + cover + developer
  lookup in the same modal (`src/lib/igdb.ts`). IGDB needs a Twitch client
  **secret**, so the browser can't call it: it goes through the `igdb` **Edge
  Function** (`supabase/functions/igdb/index.ts`), which checks the caller is
  signed in, mints and caches a Twitch app token from the function secrets
  `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`, and returns plain rows; the
  browser builds `images.igdb.com` `t_cover_big` URLs (and `posterSrc`
  resizes them). Keyless seed mode, an undeployed function, or missing
  secrets = no suggestions; hand entry still works. Same CORS allow-list and
  "Verify JWT" note as the `admin` function.
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth, called directly from
  the browser. Protected by Row Level Security, not by a server — with two
  exceptions: the `admin` **Edge Function** (`supabase/functions/admin/`), which
  does the two admin jobs that need the service role (see Spaces, accounts &
  the admin), and the `igdb` one, which holds the Twitch secret for game
  search (see IGDB above). **Realtime**
  (`postgres_changes`) streams other members' edits into an open tab; the space
  tables must be in the `supabase_realtime` publication (see `schema.sql`).
- **Hosting target: Cloudflare Pages** (build `npm run build`, output `dist`).
  Deliberately not Vercel.
- **Home-screen app (PWA), no service worker.** `public/manifest.webmanifest`
  + the icon PNGs + the `apple-*` meta tags in `index.html` make it
  installable (Safari → Share → Add to Home Screen) and full-screen. The
  viewport is `viewport-fit=cover`, so `AppLayout` pads the header / main /
  drawer by `env(safe-area-inset-*)` and `FloatingBanner` offsets by the top
  inset — anything new that is `position: fixed` needs the same. Full-height
  boxes use `100dvh`, not `100vh`. A resident app outliving a deploy is
  covered by the `vite:preloadError` reload in `main.tsx`. The home-screen
  app keeps its own storage, so each person signs in once more inside it.
- **Load budget.** The routes and the three maps are lazy chunks, and
  `vite.config.ts` splits `vendor-react` / `-mantine` / `-leaflet` / `-dnd` /
  `-supabase` out of the app code (mostly for deploy-to-deploy cache
  stability). `index.html` preconnects to the font, poster/cover, and Supabase
  origins. Every `<img>` gets
  `loading="lazy" decoding="async"`, and poster/cover `src`s are shrunk to the
  rendered box at render time (`src/lib/imageUrl.ts`) — **stored URLs are
  never rewritten**, since `photos.ts` parses them back. Keep new `<img>`s and
  new heavy dependencies to the same rules.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  (this is the typecheck-on-build gate)
npm run typecheck  # tsc -b --noEmit
npm test           # vitest run — each feature's pure derive.ts + layout/lib helpers
npm run test:e2e   # Playwright suite in e2e/ — keyless seed mode, port 5199
E2E_PORT=5299 npm run test:e2e   # same, on another port (parallel runs)
npx playwright test --ui      # Playwright UI mode — pick specs, watch runs, time-travel DOM
npx playwright test --debug   # Playwright Inspector — step through a test, live locator console
npm run preview    # serve the production build
```

**Vitest** covers each feature's pure `derive.ts` (a `derive.test.ts` beside
it — new derive logic should get a test there), plus `src/layout/features.ts`
and the small `src/lib/` helpers (`lineage`, `text`, …). There is **no linter
configured.** After code changes,
run `npm run build` (or `npm run typecheck`) and `npm test`.

**Playwright** (`e2e/`, config in `playwright.config.ts`) covers the browser
flows: every route hard-loads, nav/back, store survival across screen
switches, entry-modal gating, tier-board derivation, the list picker,
creating / renaming / deleting a custom list, the
mobile drawer, and that no route scrolls sideways at 390px
(`mobile-overflow.spec.ts` — its name must keep matching the mobile project's
`testMatch`), plus the multi-space flows: switching spaces and feature gating
(`spaces`), the admin page (`admin`), set-password and change password
(`password`), and both pulls (`tier-pull`, `recipe-pull`).
It boots its own Vite server on a dedicated port (5199, `strictPort`, so it
can never attach to a dev server with real keys; **`E2E_PORT`** overrides it
so two suites — e.g. parallel agents in separate worktrees — can run side by
side) with the Supabase keys blanked, so it always runs against the
deterministic in-memory seed — safe to run anytime, no backend touched.
**Give every worktree its own `npm ci`** — never symlink or share
`node_modules` between worktrees while a Vite server runs: Vite's dep cache
(`node_modules/.vite`) is shared with it, another worktree's server rebuilt it
under a running one, and the page loaded two copies of React. Mantine
interaction helpers (Select combobox,
SegmentedControl's hidden radios, Rating) live in `e2e/helpers.ts`; the
`verify` skill has the details. Deliberately **no drag-and-drop specs** —
dnd-kit drags are flaky under automation; drag logic is covered by the
tier-list `derive.test.ts` instead. Run the suite after changing UI flows it
covers; add a spec when you add a flow worth keeping.

## Current state: backend is live

Both auth **and** data run on Supabase. The two modes to know:

- **Keys present (the real app).** With `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` set, the app gates on a Supabase login
  (`useSession` + `AuthScreen`), resolves the user's spaces and the current
  one (`useSpace`), and each feature store — e.g. `useActivityStore` over the
  `categories` / `activities` / `entries` / `entry_repeats` /
  `wishlist_items` / `profiles` tables (plus the home columns on `spaces`) —
  reads/writes scoped to the **current** `space_id`. Changes persist; RLS
  enforces access.
- **Keys absent (UI dev fallback).** When `VITE_SUPABASE_*` are missing,
  `supabase` is `null`, the auth screen is skipped, and `useActivityStore`
  falls back to an **in-memory seed** (Outdoor/City/Brain + sample entries,
  wishes, repeats, and pre-geocoded pins) so the whole UI can be worked on with
  no backend. Edits vanish on reload in this mode. The keyless viewer is an
  admin in two fake spaces (`src/data/seedSpaces.ts`: the first with every
  feature, the second with four), so the switcher, gating and admin page work
  too — but the stores still get a null space id, so **both seed spaces show
  the same seed data**; only nav, hub and gates differ.

`useActivityStore(spaceId, userId)` is the single data seam — both modes live
behind identical action signatures, so components never branch on which mode is
active. Actions are `async`. Entry and repeat actions **throw** on failure (the
modal stays open and `store.error` surfaces the reason); category / activity /
wishlist / home actions record the error without throwing. `store.error` clears
when a new write starts or via the banner's ✕ (the banner body itself isn't
clickable — it sits over an open modal, where a stray click shouldn't dismiss
it); `store.notice` is a non-fatal warning (e.g. an un-geocodable address),
dismissed via `clearNotice`.

In live mode the store also subscribes to **Supabase Realtime** (one channel per
space) so other members' edits appear without a reload: INSERT/UPDATE events are
filtered to the space server-side and **upserted by id** (which makes echoes of
this client's own writes idempotent); DELETE events can't be filtered
server-side (Postgres replicates only the PK), so they're matched by id and
ignored if unknown. DB cascades arrive as their own events, so no
special-casing. A dropped-then-rejoined channel refetches the full snapshot
(`fetchAll`/`applySnapshot`) to cover anything missed while offline. Keyless
seed mode skips all of this.

The snapshot is fetched **on channel join, not on mount**: `useSpaceSync`
subscribes first and runs `fetchAll` when the channel reports `SUBSCRIBED`, so
the read provably follows the join (nothing can slip between the two) and each
page mount costs one round of queries instead of two. Realtime is never a gate
on seeing data — a `CHANNEL_ERROR`/`TIMED_OUT` before the first load, or a
1.5 s fallback timer if no status arrives at all, loads anyway; `loading`
flips false once that first load settles either way.

This load/realtime plumbing is shared: `src/data/spaceSync.ts` owns
`useSpaceSync` (subscribe → snapshot on join → reconnect-refetch), `syncTable`
(one table's INSERT/UPDATE/DELETE handlers), `upsertById`/`removeById`, the
profile row mapper, and `idFactory` for seed-mode ids. A new feature's store
supplies only its row mappers, `fetchAll`, a `wire` callback, actions, and
seed data — follow `useTierListStore` as the template. A collection whose
rows carry one uploaded photo (spoons, recipes, little guys) gets its
upload / insert / update / delete-with-photo from `src/data/usePhotoRows.ts`
instead of re-writing them.

### Spaces, accounts & the admin

**Spaces and memberships are admin-managed.** Members can't create a space,
join one, or leave one — those policies, the old `on_space_created` trigger and
its "make the creator a member" function are gone, and `spaces` /
`space_members` grant members only SELECT (plus UPDATE on `spaces`' three
`home_*` columns). Everything goes through the **admin** — one person, marked
by a row in **`app_admins`**, seeded by hand in the SQL Editor (`insert into
public.app_admins (user_id) select id from auth.users where email = '…'`).
`is_admin()` (SECURITY DEFINER) answers for the caller. The admin's tools are
five SECURITY DEFINER RPCs, **each opening with an `is_admin()` check** that
raises for anyone else: `admin_list_users` (every login + email, last sign-in,
`has_password`, admin flag, space ids), `admin_list_spaces` (every space + its
member ids), `admin_save_space(target_space, name, features, member_ids)`
(create when the id is null, else rename / re-feature — and set membership to
**exactly** `member_ids`), `admin_set_user_spaces(user, space_ids)` (one
person's memberships, exactly), and `admin_set_display_name`. RPCs rather
than `or is_admin()` in RLS, so the admin's own feature pages still see only
their current space's data and people.

**Per-space features.** `spaces.enabled_features text[]`: **null = every
feature, including ones added later** (the home space); an array is an
allow-list of `FEATURES` keys (unknown keys are ignored; `'{}'`, the column
default for new rows, really is empty and the hub says so). It is
**presentation only** — nav, hub and route gates read it; RLS does not, so a
member could still reach a disabled feature's tables through the API. That's
accepted. Links from one feature into another hide when the target is off
(`useFeatureEnabled(key)`).

**`useSpace` / `SpaceContext`.** `useSpace(session, configured)` loads every
membership (`space_members` → `spaces(id, name, enabled_features)`, join
order) plus `rpc('is_admin')` and returns `{ spaces, current, dataSpaceId,
features, isAdmin, loading, error, switchTo, reload }`; `App.tsx` provides it
as `SpaceContext` (read with `useSpaceContext()`, `useFeatureEnabled(key)`,
`usePullSources(featureKey)`). **Nothing creates a space any more**: a login
with no membership gets `NoSpaceScreen` ("You're not in a space yet — ask
Ethan"); the admin with none still gets the shell, to reach `/admin`. The
**current space** is the one last picked on this device — localStorage
`cajubinile.space.<userId>`, wrapped in try/catch — else the earliest
membership (a remembered id you've since lost falls back the same way). The
**switcher** lives in `AccountMenu` and shows only with more than one space
(✓ + bold on the current one, never color alone). Switching runs
`switchTo(id)` and `navigate(landingPath(pathname, newFeatures))` in ONE
`startTransition` — `landingPath` keeps you on the same feature's **root**
when the new space has it (never an id-bearing sub-path; that id belongs to
the old space), else `/` — so the new space never renders at the old path.
`<Routes key={current.id}>` then **remounts every page**, so each store drops
the old space's rows and re-subscribes; `<AuthedApp key={userId}>` does the
same across a sign-out → sign-in. `reload()` re-reads in place (the admin page
calls it after each save so the admin's own nav follows).

**The admin page** (`/admin`, `src/features/admin/`) — a People / Spaces
SegmentedControl. **People**: each login with its space chips, last sign-in,
and "No password yet" / Admin tags; "+ New account" (email, display name,
spaces); a row opens rename / spaces / "Copy set-password link". **Spaces**:
name, members, feature count; the modal edits name, members, and "All
features, including future ones" over one checkbox per `FEATURES` entry
(`featuresToSave` → null or the allow-list). The RPCs set membership to
*exactly* what's passed, so every save **re-reads first and applies only the
form's own changes** (`mergeMembership` in the admin `derive.ts`) — a stale tab
can't undo another edit — then re-reads again and calls the space context's
`reload()`. No realtime. Seed mode runs the whole page in memory over
`seedSpaces.ts` (`SEED_SPACES` / `SEED_MEMBERS`, edited in place).

**The `admin` Edge Function** (`supabase/functions/admin/index.ts`, Deno, not
part of the Vite build / tsc / vitest) does only what needs the service role:
`create_user` (`auth.admin.createUser` with no password, `email_confirm:
true`, the display name as user metadata — `handle_new_user` prefers it over
the email's local part — then a recovery token) and `password_link` (a fresh
recovery token for an existing user). It checks the caller with
`auth.getUser(token)`, then asks `is_admin()` **as the caller**, and only then
builds the service client (new `SUPABASE_SECRET_KEYS` dictionary first, legacy
`SUPABASE_SERVICE_ROLE_KEY` second). Its CORS allow-list (the same in the
`igdb` function) is `https://cajubinile.com`, `https://www.cajubinile.com`,
**`https://doing-stuff.pages.dev`** (where the live site is actually served —
the custom domain has no DNS yet) plus any `*.doing-stuff.pages.dev` deploy
preview, and **`http://localhost:5173`** — the dev server's port. Any other
origin gets `cajubinile.com` echoed back and the browser blocks the call, so
add an origin to **both** functions (and redeploy them) before calling from it. Deploy it as a function named `admin` with
the Supabase connector's `deploy_edge_function`, the dashboard's editor, or
`supabase functions deploy admin`; if the platform's "Verify JWT" setting
blocks the OPTIONS preflight, turn it off (the in-function check is the real
gate). The client calls it with `supabase.functions.invoke('admin', { body })`;
on a non-2xx the message is in `await error.context.json()`. Memberships,
spaces and names stay RPCs — keep them out of the function.

**Set-password links** — there are no emails and no temporary passwords. The
admin copies a one-time link, `${origin}/set-password#token_hash=…`
(`setPasswordLink` in the admin `derive.ts`; the token rides in the fragment,
so it never reaches a server log), and hands it over; the page warns not to
open it yourself (it would sign that browser in as them and spend it). A new
account uses the same link. `SetPasswordScreen` spends the token **only on
the button press** — `verifyOtp({ token_hash, type: 'recovery' })` →
`updateUser({ password })` → `window.location.replace('/')` — never on load,
so a message app's link preview can't burn it. "Verified" is remembered: a
failed `updateUser` (weak password) or a reload retries `updateUser` alone
via the saved session; a dead link says to ask for a new one. **The gate
lives in `main.tsx`, ahead of `App`'s session check**, because `verifyOtp`
signs the browser in and emits `PASSWORD_RECOVERY` — inside `App` that would
swap the app in mid-form. The link's lifetime is the project's email OTP
expiry (a dashboard setting). **Change password** is an `AccountMenu` item: a
`ModalShell` around the same `PasswordForm`, `updateUser` only (assumes the
"secure password change" / reauthentication setting stays off).

**Sign-up is closed.** `AuthScreen` is sign-in only ("Accounts come from
Ethan"), and "Allow new users to sign up" is meant to be off in the Supabase
dashboard (that toggle, not the Email provider — sign-in still needs it).
**There's no delete UI** for spaces or users — delete them in the
Supabase dashboard / SQL Editor. Removing someone from a space leaves their
rankings, tags and bylines in place (bylines go blank for the others), and
re-adding them restores everything.

### Applying database changes

The Supabase MCP connector can now **apply migrations**
(`apply_migration`), **run SQL** (`execute_sql`), **deploy Edge Functions**
(`deploy_edge_function`) and regenerate types (`generate_typescript_types`)
against the live project — but **every live write needs Ethan's explicit OK
first**, per change, in chat; reads (`list_tables`, `list_migrations`,
read-only `execute_sql`) don't. The old route still works and is the fallback
whenever the connector refuses or isn't authorized: Ethan pastes the
migration into the SQL Editor (and a function into the dashboard's Edge
Functions editor). `.env.local` still holds only the anon key — never put a
service-role key or DB password in the repo. Each change ships as a dated
`supabase/migrations/*.sql` delta for the live DB **and** is folded into
`supabase/schema.sql` (the end state for a fresh install). When folding a grant
change, mind the blanket grant block: `spaces`, `space_members` and
`profiles` are deliberately left out of it (they get their own revoke +
column-grant lines after it), or a re-run would undo the lockdown.

## Data model & RLS

`supabase/schema.sql` is the source of truth for the database. Key points:

- Tables: `app_admins`, `spaces`, `space_members`, `categories`, `activities`, `entries`,
  `entry_repeats`, `wishlist_items`, `profiles`, `tier_lists`, `tier_items`, `tier_placements`,
  `tier_item_completions`, `tier_item_user_tags`, `lists`, `list_items`, `spoons`, `park_visits`,
  `recipes`, `music_practice_days`, `little_guys`, `seasons`, `season_items`,
  `alignment_charts`, `meal_plan_days`, `grocery_staples`.
  Plus the `spoons`, `recipes`, and `little-guys` **storage buckets** (public
  read, member-only writes via policies on `storage.objects`).
- Most tables use the uniform "space members all" `for all` policy. The
  exceptions: **`app_admins`** (RLS on, no policies, no grants at all — only
  `is_admin()` and the SQL Editor see it), **`spaces` / `space_members`**
  (members SELECT; writes only through the `admin_*` RPCs — see Spaces,
  accounts & the admin), `profiles` (read self + co-members, update self),
  **`tier_placements` / `tier_item_completions` / `tier_item_user_tags` /
  `music_practice_days`** (members
  read all, but insert/update/delete require `user_id = auth.uid()` — rankings,
  book read state, personal tags, and daily practice are personal; `tier_placements` alone
  also admits **null-owner rows for items on a `shared` custom list**, via
  `is_shared_board_item()`; `music_practice_days`' SELECT also admits
  `user_id = auth.uid()`, so your own practice reads from any space), and **`list_items`**
  (members read all; writes to BOOK rows additionally require
  `created_by = auth.uid()` — reading lists are personal, other lists stay
  shared). Follow that pattern for any future per-person opinion data.
  **`tier_lists` and `lists` are uniform/shared** — a custom board or a
  free-form list belongs to the space, and their rows are `kind 'custom'`,
  never `'book'`, so they stay outside that per-person carve-out.
- **`profiles` mirrors `auth.users`** (which the browser can't read). An
  `on_auth_user_created` trigger inserts one row per user (`id`, `email`,
  `display_name` — a `display_name` passed as user metadata at creation wins
  over the email's local part); RLS lets you read your own profile plus anyone
  who shares **any** space with you (via the `shares_space_with()` SECURITY
  DEFINER function) — so a feature listing "this space's people" must filter by
  the current space's `space_members`, not take every readable profile.
  `created_by` columns default to `auth.uid()`; the UI joins them to
  `profiles` to show who logged each entry.
- **Column-level grants** on the admin-managed tables: members may UPDATE only
  `spaces.home_address` / `home_lat` / `home_lng` and their own
  `profiles.display_name`; `space_members` and every other `spaces` column
  (name, `enabled_features`) are read-only to them. Renaming anyone else goes
  through `admin_set_display_name`.
- **`copied_from uuid`** on `tier_lists`, `tier_items` and `recipes` — the
  **root** row a cross-space pull copied it from (null = made here). No FK on
  purpose: the origin may be deleted or sit in a space this row's readers
  can't see. Ordinary edits never send it. See Cross-space pull.
- **Auth model: shared data, separate logins.** Each person logs in
  separately; a **space** is shared by its members, and a person can be in
  several. Every data row carries `space_id`; RLS grants access only to
  members of that space (via the `is_space_member()` SECURITY DEFINER
  function — used to avoid RLS recursion), so a member reads every space
  they're in (which is what a cross-space pull relies on) and nothing else.
  Membership is set only by the admin RPCs.
- The project was created with **"Automatically expose new tables" OFF**, so the
  schema grants tables to the `authenticated` role explicitly. `anon` gets nothing.
- TypeScript types in `src/types.ts` mirror the DB columns (note: DB `entry_date`
  / `repeat_date` / `color_index` map to camelCase `date` / `date` / `colorIndex`
  in the app types). If you change the schema, update `src/types.ts` and
  regenerate `src/lib/database.types.ts` with `supabase gen types`.

## Cross-space pull

A person in several spaces can **pull** their stuff from one space into
another — today Tier Lists (whole boards) and Recipes (picked recipes), each
behind a faint **"Pull from…"** in the feature's control bar. A pull
**duplicates rows** into the current space; it never links them. Why
copy-with-origin rather than a live link: every table, policy, store query and
realtime filter is keyed on ONE `space_id`, and a row visible in two spaces
breaks all four in every feature; a linked row would let the second space's
members edit or delete data the first space never shared; rows carry
per-space state that must not sync (recipe cross-offs, meal-plan links, done
dates, list → tier links); and the data is tiny, so duplicating costs nothing.
Duplication's weakness is drift, and lineage covers the part that matters:
**pulling again merges only what's new**, and it leaves room for a later
"update from source". Personal-only data shouldn't be copied at all — it
follows the person instead (Music Practice).

- **Lineage.** A pulled row stores `copied_from` = its **root** origin, not
  just its immediate source: `originOf(row) = row.copiedFrom ?? row.id`
  (`src/lib/lineage.ts`), and a pull writes `copiedFrom = originOf(source)`.
  So A → B → C → back to A still matches with one rule: two rows are the same
  thing when their origins are equal. It is a **matching hint, never
  authorization** — RLS ignores it, and nothing follows it across spaces.
- **Shared pieces.** `PullModal` (`src/components/PullModal.tsx`) is the
  frame: a source-space Select (plain "From <name>" with only one other
  space), the feature's body, a summary line, `ModalFooter`. `PullButton`
  renders the "Pull from…" action, or nothing when `usePullSources(featureKey)`
  (the user's *other* spaces that show that feature, join order) is empty — so
  a page drops it in unconditionally. The source is read directly by
  `space_id` (RLS lets a member read any space they're in).
  **`copyBucketPhoto(bucket, url, toSpaceId)`** in `src/lib/photos.ts`
  duplicates a photo object into `<toSpaceId>/<uuid>.jpg` as-is (not through
  `uploadBucketPhoto`, which re-encodes) so **each copy owns its own photo** —
  a shared object would vanish when either row's delete removed it; '' stays
  '', and a non-bucket URL comes back unchanged. **`titleKey()`**
  (`src/lib/text.ts`: trimmed, lowercased, whitespace collapsed) is the "same
  title" rule, shared with the Lists check-off.
- **Seed mode.** Both seed spaces show the same per-feature seed, so there's no
  second space's data to read. Instead each pulling feature defines ONE fixed
  builder next to its store (`seedTierPullSource()`, `seedRecipePullSource()`),
  in the live fetch's shape, served by `seedPullFetch()` whichever seed space
  is picked — independent of the store's own seed. Every id starts with
  `SEED_PULL_ID_PREFIX` (**`src-`**) so it can't collide and lineage stays
  stable across pulls (that's what makes "pull again → nothing new"
  testable); the puller is `SEED_SELF_ID`; and at least one title overlaps the
  store seed on purpose, so the title-match path shows on the first pull. The
  convention is written up in `src/data/seedPullSource.ts`.

**Tier-list pull** (`planTierPull` / `planTierPulls` in the tier-list
`derive.ts`, pure and heavily tested; `pullBoards` in `useTierListStore`;
`TierPullBody` is the checklist of the source's boards — Movies / TV / Books / Games /
each custom list, with counts, the board on screen pre-ticked via
`defaultPullKeys`). The source fetch (`fetchPullSource`) reads the source's
lists and pool plus only the **puller's own** placements / completions / tags
and the null-owner placements — never anyone else's opinions. Rules:
- **Which items:** the ones the puller ranked there; "Also bring items I
  haven't ranked" adds the rest, as items only.
- **Custom list:** maps onto the list here with the same origin, else the same
  name (any case), else a new list (name, emoji, noun, `shared`, lineage) — not
  created if nothing would land on it. Copied items carry the **target**
  list's id, never the source's (the FK and RLS would accept it, and deleting
  the source list would then cascade into this space).
- **Item matching is injective:** lineage first, then `titleKey` on the same
  board, each item here claimed at most once, source items in `createdAt`
  order. Leftovers become new copies — title, image, creator, shared tags,
  `copied_from` — with **no shared `done_on`** (that date means "that group
  finished it"); their `created_at` steps by 1 ms in source order so the
  Unranked shelf keeps it.
- **Rankings:** owner = `placementOwner(target list's shared flag, selfId)` —
  the puller's own, or null-owner on a shared list (source rows picked by the
  *source* list's mode). An item **already ranked here** for that owner keeps
  its spot; the rest **append** after that tier's last card, in source order.
- **Books and games:** only the puller's own completion, insert-if-absent. **Tags:**
  the puller's personal tags are unioned. A pull **never edits** an existing
  item here, so re-pulling is idempotent ("Nothing new to pull.").
- **Writes, in order:** lists → items (one multi-row insert each, client-minted
  ids, `.select()` rows upserted into the store), then placements /
  completions (`upsert … ignoreDuplicates` on `item_id,user_id`) and tags
  (upsert) in parallel. A later step failing reports "Items copied, but
  rankings failed — pull again to finish." (or "Lists copied, but their items
  failed …") — lineage makes the retry finish the job. The summary line
  ("3 rankings · 2 new items · 1 already here · …") comes from
  `tierPullSummaryLine`.

**Recipe pull** (`recipePullChoices` / `cloneRecipe` in the recipes
`derive.ts`; `pullRecipes` in `useRecipeStore`; `RecipePullBody`: fuzzy
search, a checklist, n-of-m progress). Each source recipe is matched against
the cookbook here: by lineage → **"Already here"**, shown but disabled; by
title only → **"Same title here"**, still tickable (a different recipe that
shares a name), unticked by default. A pulled recipe brings everything written
on it (ingredients, steps, source, tags, servings, time, notes, grocery list +
staple flags) with its **photo duplicated** and its **cross-off marks
cleared**; meal-plan links stay behind. Recipes go one at a time, skipping any
whose origin is already here (including ones this pull just added). A photo
that won't copy → the recipe comes over without it and `store.notice` says
how many; a failed insert → its copied photo is removed and the pull stops
there with `store.error`.

**A future pull for another feature follows the same recipe:** a nullable
`copied_from` column (migration + `schema.sql` + types + row mapper, never
sent by ordinary edits), a pure planner in the feature's `derive.ts` that
matches by `originOf` then `titleKey` and never edits existing rows, a source
fetch by `space_id` (seed: a `src-` builder), `copyBucketPhoto` for photos,
and a body inside `PullModal` behind `PullButton`. Candidates: Lists, Seasons
(`cloneSeasonItems` already remaps a season's items), one's own park visits,
spoons, little guys, alignment charts, Doing Stuff categories. Entries,
wishlists and meal plans stay space-specific.

## Project layout

```
src/
  main.tsx                 providers; renders SetPasswordScreen INSTEAD of App on /set-password
  App.tsx                  gate (auth → spaces → NoSpaceScreen) → SpaceContext → BrowserRouter
                           → AppLayout → <Routes key={space}>; gate() bounces disabled features
                           (the 10 feature pages + /admin are React.lazy at module scope)
  types.ts                 domain types (mirror DB columns)
  theme.ts                 earthy palette, fonts, shared colors, swatchFor()
  mantineTheme.ts          Mantine theme override mirroring theme.ts
  layout/
    AppLayout.tsx          Mantine AppShell: brand, the space's feature nav, AccountMenu; burger
    AccountMenu.tsx        header menu: space switcher (>1 space), Admin, Change password, Sign out
    features.ts            FEATURES (stable keys) + enabledFeatures, featureForPath, landingPath
    features.test.ts       vitest coverage for features.ts
    HomePage.tsx           `/`: the hub, one row per enabled feature (empty state for none)
  lib/
    format.ts              date helpers (today, isoDate, YearMonth, …) + stars
    fuzzy.ts               fuzzyMatch() subsequence title search (Log + recipes)
    text.ts                firstGrapheme() — one-emoji fields; titleKey() — "same title" rule
    lineage.ts             originOf() — a row's root origin for cross-space pull matching
    triFilter.ts           tri-state filter pills: cycleTri, triMatcher, useTriFilter
    geocode.ts             Nominatim address → lat/lng (on save only)
    image.ts               client-side photo downscale (≤1200px JPEG) for uploads
    imageUrl.ts            posterSrc() render-time TMDB/Open Library size rewrite
    photos.ts              shared Storage bucket photo upload / best-effort delete / copyBucketPhoto
    order.ts               positionBetween() / renormalizedPositions() fractional ordering
    profile.ts             displayNameFor() — profile → short display label
    tmdb.ts                TMDB title search (movie/TV posters) for TitleSearchInput
    openLibrary.ts         Open Library book search (covers) for TitleSearchInput — keyless
    igdb.ts                IGDB game search (covers, developer) via the `igdb` Edge Function
    supabase.ts            client; null until env keys are set; isSupabaseConfigured
    database.types.ts      typed schema (regenerate with supabase gen types)
  data/                    shared (cross-feature) hooks
    useSession.ts          Supabase auth session hook
    useSpace.ts            memberships + is_admin → current space, switchTo, reload; SpaceContext,
                           useFeatureEnabled, usePullSources
    seedSpaces.ts          keyless seed: two fake spaces, seed memberships, viewer is admin
    seedPullSource.ts      the seed pull-source convention (`src-` ids, seedPullFetch)
    spaceSync.ts           store plumbing: useSpaceSync, syncTable, upsertById…
    usePhotoRows.ts        shared writes for photo collections (upload, add/edit, delete + photo)
  components/              shared UI
    AuthScreen.tsx         sign-in only — accounts are admin-made (no-op without keys)
    ComingSoon.tsx         placeholder page for unbuilt features
    ConfirmModal.tsx       ConfirmProvider / useConfirm / useConfirmOpen
    ControlBar.tsx         every page's top row: left controls, right action, rule
    EmptyCard.tsx          dashed empty-state card
    FloatingBanner.tsx     fixed dismissible error/notice banner
    MapCanvas.tsx          shared Leaflet frame: tiles, Recenter, FitToPins, icon cache
    MediaImage.tsx         poster/cover <img> with emoji fallback (tier cards, list rows)
    ModalFooter.tsx        modal action row: Delete link / Cancel / primary
    ModalShell.tsx         shared Mantine modal chrome (title, size, confirm-aware)
    NoSpaceScreen.tsx      "You're not in a space yet" for a login with no membership
    PageFrame.tsx          PAGE_MAX_WIDTH + each page's padded, centered column
    PasswordForm.tsx       new + confirm password fields (set-password screen, Change password)
    PhotoCard.tsx          PhotoCardGrid + PhotoCard (spoons / guys / recipes)
    PickerRow.tsx          in-page pill row picking a board/list (tier lists, lists)
    Pill.tsx               filter pill + TriPill (click / right-click tri-state)
    PullModal.tsx          PullModal frame (source space, body, summary) + PullButton
    SetPasswordScreen.tsx  /set-password#token_hash=…: verifyOtp → updateUser on submit
    Splash.tsx             centered loading/fatal message
    Stars.tsx              read-only rating display
    TitleSearchInput.tsx   title field with debounced TMDB / Open Library suggestions
  features/
    doing-stuff/           the activity tracker (/log, /wishlist, /map, /calendar)
      DoingStuffPage.tsx   owns the store, modal state, derive wiring, control bar
      useActivityStore.ts  data seam: Supabase CRUD (or in-memory seed fallback)
      derive.ts            pure join / filter / sort / stats / markers / calendar
      derive.test.ts       vitest coverage for derive.ts
      Dashboard.tsx        Log screen: stats, controls, cards/table, empty state
      Wishlist.tsx         wishlist screen (add / edit / place / check off)
      MapView.tsx          Leaflet map with emoji pins + map-local filter
      CalendarView.tsx     month grid of entries + repeats
      EntryModal.tsx       new / edit entry (category→activity dropdowns)
      RepeatModal.tsx      log / remove repeats of an entry
      ManageModal.tsx      categories & activities editor + home base
      CategoryPills.tsx    tri-state category pills + the activity (subcategory) row
      HeaderActions.tsx    feature control bar: screen toggle + Manage / New entry
      ScreenToggle.tsx     Log / Wishlist / Map / Calendar switcher (navigates)
    tier-list/             movie/TV/book/game + custom boards (ice cream is one)
      TierListPage.tsx     owns the store, member picker, item modal state, pull modal
      useTierListStore.ts  data seam: lists + pool + placements + completions CRUD, pullBoards
      derive.ts            board building, moveItem, list keys, shared boards, pruneList,
                           boardViewers, planTierPull(s)
      derive.test.ts       vitest coverage for derive.ts
      copy.ts              per-kind wording + customCopy/copyFor for custom lists
      copy.test.ts         vitest coverage for copy.ts
      ListPicker.tsx       thin PickerRow wrapper: built-in boards + custom boards
      ListModal.tsx        create / re-word / delete a space-defined list
      TierBoard.tsx        dnd-kit wiring: sensors, collision, drag handlers
      BoardView.tsx        pure board layout (tier rows + collapsible shelves)
      TierCard.tsx         CardVisual (poster + fallback) + SortableCard
      ItemModal.tsx        add/edit pool item (title via TitleSearchInput)
      TierPullBody.tsx     TierPullModal: checklist of the other space's boards + unranked switch
    lists/                 the want-to queues: movie/TV/book + free-form lists
      ListsPage.tsx        owns the store, picker, counts, modal state, missing-list redirect
      useListStore.ts      data seam: lists + list_items CRUD, check-off → tier_items
      derive.ts            pure refs, isDone, sortListItems, nextPosition, pruneListDef
      derive.test.ts       vitest coverage for derive.ts
      copy.ts              per-list wording: LIST_COPY + customListCopy/copyFor
      copy.test.ts         vitest coverage for copy.ts
      ListRows.tsx         quick-add + dense dnd-kit rows + collapsed Done section
      ListItemModal.tsx    edit a row (title search, image, creator/note, remove)
      ListDefModal.tsx     create / rename / delete a free-form list
    spoons/                the souvenir spoon collection (list + map)
      SpoonsPage.tsx       owns the store, Collection/Map toggle, modal state
      useSpoonStore.ts     data seam: spoons CRUD + geocode (or seed fallback)
      photos.ts            storage bucket upload / best-effort delete
      derive.ts            pure sort, same-place pin fan-out, map bounds
      derive.test.ts       vitest coverage for derive.ts
      SpoonGrid.tsx        photo card grid + SpoonPhoto (🥄 fallback)
      SpoonMap.tsx         Leaflet map: circular photo pins, fit-bounds framing
      SpoonModal.tsx       add/edit spoon (photo upload, place, date, story)
    seasons/               seasonal bucket list + weekend planner
      SeasonsPage.tsx      owns the store, route redirect, picker, toggle, filters, modals
      useSeasonStore.ts    data seam: seasons + season_items CRUD, copy, plan, check-off (or seed)
      derive.ts            pure: current season, weekends, day layout, urgency, groups, clone
      derive.test.ts       vitest coverage for derive.ts + the Fall 2026 seed
      BucketList.tsx       sections → subsection panels → dense rows + quick-adds
      PlanView.tsx         weekends-left header, Unplanned/Missed trays, weekend cards
      SchedulePopover.tsx  tap-to-schedule: weekend-day chips, Unplan, Edit…
      TagChip.tsx          the day / deadline chip (words + icon, never color alone)
      QuickAdd.tsx         borderless Enter-to-add field (subsections, days)
      ItemModal.tsx        add/edit item (section autocomplete, parent, dates, Duplicate)
      SeasonModal.tsx      create (copy items from) / edit / delete a season
    alignment/             D&D-style 3×3 alignment charts (title + nine fixed squares)
      AlignmentPage.tsx    owns the store, route redirect, picker, chart modal
      useAlignmentStore.ts data seam: alignment_charts CRUD + per-square writes (or seed)
      derive.ts            pure: ALIGNMENT_KEYS, labels, emptyCells, sort, filled count
      derive.test.ts       vitest coverage for derive.ts + the seed
      AlignmentGrid.tsx    the 3×3 grid; each square edits in place
      ChartModal.tsx       create / rename / delete a chart (title only)
    little-guys/           the little guy (Smiski) collection — one photo grid
      LittleGuysPage.tsx   owns the store, search + owner pills, modal state
      useLittleGuyStore.ts data seam: little_guys CRUD + ordered members (or seed)
      photos.ts            little-guys bucket upload/delete (lib/photos.ts wrapper)
      derive.ts            pure sort, search + owner filter, owner pills/labels
      derive.test.ts       vitest coverage for derive.ts
      LittleGuyGrid.tsx    photo card grid + LittleGuyPhoto (🗿 fallback)
      LittleGuyModal.tsx   add/edit guy (photo upload, owner picker, personality)
    parks/                 the 63-national-parks tracker (map + list)
      ParksPage.tsx        owns the store, Map/List toggle, stats strip, modals
      parks.ts             static dataset: the 63 parks (code, region, coords…)
      useParkStore.ts      data seam: park_visits CRUD + ordered members (or seed)
      derive.ts            pure statuses, stats, filters, regions, pin colors
      derive.test.ts       vitest coverage for derive.ts + dataset sanity
      ParkMap.tsx          Leaflet map: filtered pins colored by who's been + legend
      ParkList.tsx         region-grouped list of the filtered parks
      ParkFilterPills.tsx  tri-state status pills shared by map + list
      ParkModal.tsx        park facts + visit history + add/edit visit form
      LogVisitModal.tsx    header flow: searchable park picker + trip fields
      VisitFields.tsx      shared trip fields (date, attendees, notes)
    recipes/               the shared cookbook (index + full-page recipe)
      RecipesPage.tsx      owns the store; /recipes index + /recipes/:id detail
      useRecipeStore.ts    data seam: recipes CRUD + profiles, pullRecipes (or seed fallback)
      photos.ts            recipes bucket upload/delete/copy (thin lib/photos.ts wrapper)
      derive.ts            pure parse (lines/steps), sort, search, tag filter, pull matching
      derive.test.ts       vitest coverage for derive.ts
      RecipeGrid.tsx       photo card grid + RecipePhoto (🍲 fallback)
      RecipeList.tsx       dense A–Z rows (title, source, tags, serves/time)
      RecipeDetail.tsx     full recipe page: tap-to-cross-off, notes, byline
      RecipeModal.tsx      add/edit recipe (photo upload, textareas, tags)
      RecipePullBody.tsx   RecipePullModal: searchable checklist of the other space's recipes
    meal-plan/             the Recipes feature's weekly lunch + dinner plan + grocery step
      MealPlanScreen.tsx   /recipes/plan: week toggle, day rows, grocery modal state
      useMealPlanStore.ts  data seam: meal_plan_days + grocery_staples, sends to Lists (or seed)
      derive.ts            pure: Sunday weeks, labels, leftovers, staples, grocery groups
      derive.test.ts       vitest coverage for derive.ts
      MealPlanView.tsx     the seven day rows, lunch + dinner each (+ ↗ to a recipe)
      DayPopover.tsx       tap-to-plan: recipe Select, free text, leftovers chips, clear
      GroceryModal.tsx     ingredient checklist, extras, staples → the Groceries list
    music-practice/        personal practice tracker (Bassoon wheel + Piano)
      MusicPracticePage.tsx  Bassoon / Piano toggle
      Bassoon.tsx          circle-of-fifths SVG wheel: select → Log, tempo, history
      Piano.tsx            stateless random key + scale/chord drawer
      useBassoonStore.ts   data seam: music_practice_days CRUD (or seed; no realtime)
      derive.ts            pure: CIRCLE wheel data, day helpers, Piano tables
      derive.test.ts       vitest coverage for derive.ts
    admin/                 /admin: accounts, spaces, memberships, per-space features
      AdminPage.tsx        People / Spaces toggle, modal state; non-admins bounce to /
      useAdminStore.ts     data seam: the admin_* RPCs + the admin Edge Function (or seed)
      seed.ts              in-memory accounts over seedSpaces.ts
      derive.ts            pure joins, labels, setPasswordLink, mergeMembership, feature drafts
      derive.test.ts       vitest coverage for derive.ts
      AdminRows.tsx        PeopleList / SpaceList dense rows
      NewAccountModal.tsx  email + name + spaces → create → the copyable link
      PersonModal.tsx      rename, set spaces, copy a fresh set-password link
      SpaceModal.tsx       name, members, all features / per-feature checkboxes
      parts.tsx            WordTag, SpaceChip, SpaceCheckboxes, LinkPanel (link + don't-open warning)
e2e/
  helpers.ts               Mantine interaction helpers (Select, SegmentedControl…)
  *.spec.ts                Playwright specs (routes, navigation, doing-stuff,
                           tier-list, lists, spoons, little-guys, parks,
                           recipes, meal-plan, music-practice, seasons, alignment, mobile,
                           mobile-overflow, spaces, admin, password, tier-pull, recipe-pull)
                           — see playwright.config.ts
supabase/
  schema.sql               tables + RLS + grants (the source of truth)
  migrations/*.sql         dated deltas for a live DB (connector apply_migration, or SQL Editor)
  functions/admin/index.ts the `admin` Edge Function (Deno; deployed separately, not built by Vite)
  functions/igdb/index.ts  the `igdb` Edge Function: signed-in-only IGDB game search (Twitch secrets)
```

New features get their own `src/features/<name>/` directory with their own
store hook; only truly cross-feature code goes in `src/components/`, `src/data/`,
and `src/lib/`.

## Conventions & where logic lives

- **Every filter pill row is tri-state** (`src/lib/triFilter.ts` + `TriPill`
  in `Pill.tsx`): each pill is off / include / exclude; a click cycles
  off → include → exclude → off and a **right-click runs it backwards**
  (off → exclude → include → off), so excluding is one click. Includes are
  OR, excludes veto; an "All" pill clears the row. Each `TriPill` carries a
  native hover tooltip saying so, and the tag rows add a small italic hint
  once a filter is set. Prune pill state whose key has disappeared
  (`pickKeys`) so a stale include never strands an empty view. A new filter
  row should use the same pieces; `PickerRow` is navigation, not a filter.

- **Keep data-shaping pure and in `src/features/doing-stuff/derive.ts`.** Joining
  entries to their activity/category, filtering, sorting, stats, map markers, and
  the calendar grid all live there as plain functions with no React.
  `DoingStuffPage.tsx` wires them via `useMemo`. Add new filter/sort/stat logic
  here, not inside components. Future features should follow the same pattern
  (a pure `derive.ts` with vitest coverage next to it).
- **Deletes cascade in the store**, mirroring the DB's `on delete cascade`:
  deleting an activity drops its entries; deleting a category drops its
  activities and their entries; deleting an entry drops its repeats and reopens
  any wish linked to it. Preserve the local mirroring when adding tables.
- **Destructive deletes confirm first.** Every one of them goes through
  `useConfirm()` (`src/components/ConfirmModal.tsx`, provider mounted in
  `main.tsx`): `if (!(await confirm({ title, message }))) return`. It resolves
  false on Cancel, Escape, and the overlay, and it stacks above an open modal
  (ModalShell yields the focus trap and the escape key while one is up, and the
  provider owns the Escape key so a later-mounted modal can't swallow the same
  press). Never `window.confirm`. Keep this for anything that destroys logged
  or shared data — entries, repeats, categories, activities, wishes, tier
  items, list rows and free-form lists, spoons, little guys, recipes, park
  visits, seasons and season items, alignment charts. (Clearing a meal-plan
  day doesn't confirm: it's one tap to re-plan.)
- **Every feature page wears the same shell.** `PageFrame` (padding + the
  centered `PAGE_MAX_WIDTH` column) wraps the page; `ControlBar` is its top row
  (`left` = toggles/filters/counts, `right` = the primary action) above the
  dotted rule. The first-load gate replaces **only the content below the bar**
  — `{loading ? <Splash mih="40vh"/> : content}` — so the chrome never
  disappears and reappears; anything derived from the data that would flash a
  wrong-looking value (the parks scoreboard, the little-guys count) hides with
  it. Photo grids go through `PhotoCardGrid` / `PhotoCard`, and modal action
  rows through `ModalFooter`.
- **Dates are local, not UTC.** `today()` and the calendar build ISO strings
  from local date parts. Don't reintroduce `toISOString()` for dates — it shifts
  evenings to tomorrow for anyone west of UTC.
- **Colors are indices, not strings.** A category stores `colorIndex` into
  `palette` in `theme.ts`; resolve with `swatchFor()`. `FALLBACK_COLOR` covers
  entries whose category was deleted.
- **Styling goes through Mantine + `theme.ts`.** Use Mantine components and
  props, with inline style objects referencing `colors` / `fonts` / `palette`
  for anything bespoke. Don't add a CSS framework or stylesheets.
- **Geocode on save only.** Address inputs commit on blur/Enter/save and skip
  re-geocoding when the text didn't change. Never geocode per keystroke or at
  render time (Nominatim rate policy).
- **Env vars are `VITE_`-prefixed** (public, shipped to the browser). Never put the
  Supabase `service_role` key in the client. RLS is the security boundary.
- **Write for any group, not a couple.** Spaces have any number of members,
  and friends' spaces see these screens. UI copy says "everyone" / "everyone
  in this space" / "anyone" — never "both of you", "your partner", "you two",
  "together" (as in "do it together"), or "our" ("Search our recipes",
  "Our notes"). A per-person thing is "yours" / "only you see this". **Parks**
  is the one deliberate exception: its Together / Separately design is only
  for spaces of one or two members, and group mode (three or more) drops that
  wording (see Parks).
- **No filler taglines.** Empty states, hints and placeholders are short plain
  statements of fact ("Only a name is required.", "Checked-off rows move to
  Done.", "No entries in this view.") — not cheerleading ("a name is all it
  takes; the rest can come later", "Log your next outing together") or
  instructions to "write it out naturally".
- **A new feature works in any space.** Add it to `FEATURES` with a new,
  permanent `key`; read the space's people from `space_members` for the
  current space (never every readable profile); hide a link into another
  feature unless `useFeatureEnabled(thatKey)`; and if it has rows worth
  carrying between spaces, give it a pull (see Cross-space pull).
