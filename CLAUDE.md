# CLAUDE.md

Guidance for working in this repo. Read this before making changes.

## What this is

**cajubinile.com** — a shared personal site for two people, split into features
behind a persistent Mantine AppShell header (brand link + feature nav +
sign-out). The nav is **one item per feature, not per route** — eight of them,
collapsing into the burger drawer below Mantine's `md` breakpoint; the five
tier-list routes share a single "Tier Lists" item and are chosen in-page with
the `ListPicker` pill row, and the Lists routes likewise share one "Lists"
item. The three unbuilt placeholder routes are off the nav
but still resolve. Routing is **react-router (library mode)**: `/`, `/wishlist`, `/map`,
`/calendar` are the Doing Stuff feature's screens; `/movies`, `/tv`, `/books`,
and `/tiers/:id` (a space-defined board — ice cream lives here) are the **Tier Lists**
feature; `/lists/movies`, `/lists/tv`, `/lists/books`, and `/lists/:id` (a
free-form list) are the **Lists** feature (`/lists` redirects to
`/lists/movies`); `/spoons` is the **Spoons**
feature; `/parks` is the **Parks** feature; `/recipes` (+ `/recipes/:id`) is
the **Recipes** feature; `/music-practice` is the **Music Practice** feature;
`/little-guys` is the **Little Guys** feature; `/french-toast` is a placeholder
page for a feature not built yet (a french toast ranking). All features share the one
space — new tables follow the same `space_id` + `is_space_member()` RLS pattern.

**Doing Stuff** — the landing feature — is a shared activity tracker for logging
things done together in a new city. The domain model:

- **Category** (e.g. Outdoor, City, Brain) — has a name and a color.
- **Activity** belongs to a category (e.g. Outdoor → Park, Swimming) and has an
  optional single **emoji** used as its map-pin icon.
- **Entry** (a logged outing) references one activity and adds a **title**,
  **date**, **description**, **1–5 star rating**, and an optional **address**,
  geocoded to lat/lng on save for the map (`hideFromMap` keeps it off).
- **Repeat** (`entry_repeats`) — an additional date you returned to an entry's
  place/activity. Total count = 1 + repeats; always derived, never stored.
- **Wishlist item** — a free-text "thing we want to try", optionally with a
  geocoded place (⭐ pin). Checking one off opens a prefilled entry modal;
  saving links the item to the new entry (= done). Deleting that entry reopens
  the wish (DB `on delete set null`, mirrored in the store).
- **Home** — a per-space address (on the `spaces` row) that centers the map.

Doing Stuff has four screens (routes) behind an in-feature toggle: **Log**
(dashboard: stats, category filter, fuzzy title search, cards/table views,
sort), **Wishlist**, **Map** (Leaflet; emoji pins for entries, ⭐ for open
wishes, 🏠 for home, with its own category/wishlist filter), and **Calendar**
(month grid of entries + repeats). All four routes render the same
`DoingStuffPage` component, so its store (and realtime channel) survives screen
switches. Entry editing, repeats, and category/activity/home management happen
in modals.

**Tier Lists** (`/movies`, `/tv`, `/books`, `/tiers/:id`) —
drag-n-drop S/A/B/C/D/F boards — **tiers only**; the want-to queues are the
separate Lists feature below, and each movie/TV/book board links to its list
from the control bar. Four routes, ONE header nav item: which board
you're on is chosen in-page by the `ListPicker` pill row (three built-ins, then
the space's own lists, then "+ New list" and — on a custom board — a faint
"Edit list"). The domain model splits pool from opinion:

- **Custom list** (`tier_lists`) — a board the space defines from the UI
  ("Ice Cream", "Bugs", "Fruits"), shared data with the uniform RLS: either
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
  tier-list `derive.ts` are the switch: the page hides the You/Partner
  toggle, always renders the drag board, and passes `shared` to the
  placement actions. Flipping the flag never moves rankings — the other
  mode's rows stay in the DB and reappear if it's flipped back. Its items carry
  `kind = 'custom'` plus a `list_id` FK, so **deleting a list is one
  statement** and Postgres cascades the items (and every member's
  placements/completions of them); the store mirrors that with `pruneList()`.
  App-side a board is one **`ListKey`**: a `TierKind` or `` `list:${id}` ``
  (`TierKind` itself stays a closed 3-member union — movies/TV/books are built in only for their search providers and want-to lists; everything else, ice cream included, is a `tier_lists` row). `copyFor(key, lists)`
  resolves either into wording — and never throws for a list row that's gone,
  so a partner's tab survives the beat between a realtime DELETE and the
  `<Navigate>` back to `/movies`.
- **Tier item** (`tier_items`) — a movie, show, book, or
  custom-list item in the
  space's **shared pool** (a `kind 'movie'|'tv'|'book'|'custom'`
  column plus a nullable `list_id`, a
  title, a hand-pasted poster/cover `image_url`, a nullable `done_on` date —
  the SHARED "we finished it" date; defaults to today on a board add or a
  Lists check-off.
  Movies/TV only — books leave it null and use per-person completions instead,
  and a **custom list ignores it entirely**: it tracks no date, so its board
  has no second shelf and its item modal no date field (`dates: null` in the
  tier-list `copy.ts`, mirrored by `hasUndatedShelf()` in its `derive.ts`)
  — and free-text
  **`tags`** (`text[]`, e.g. "disney", "fantasy") shared like the item; the
  board page filters by them with multi-select pills (OR semantics, matched
  case-insensitively). A filtered board is **read-only** — hidden cards make
  drop positions ambiguous — so it renders `BoardView` with clickable cards.
  Items also carry a free-text **`creator`** — who made it, shared like the
  title and shown as a faint line under the card title; the modal labels it
  per kind via `creatorLabel` in `copy.ts` (Author / Director / Creator /
  Brand or shop), and picking an Open Library suggestion prefills the author.
  Any member can add/edit/delete; deleting removes everyone's rankings of it.
- **Tier placement** (`tier_placements`) — **one person's** ranking of one item:
  `tier` + fractional `position` within the tier (midpoint insertion on drop =
  one-row upsert on `unique (item_id, user_id)`; the client renormalizes a tier
  to integers if float precision ever runs out). "Unranked" is the absence of a
  placement row. On the three **built-in** boards an unplaced item with **no
  date for the viewer** lands on a second dashed **Unwatched** (books:
  **Unread**) shelf instead (a placement wins over a missing date); dragging
  out of that shelf stamps today's date, dropping onto it unranks the card and
  clears the date. A **custom list has only the unranked shelf** — it tracks
  no date, so there's nothing to split on. The shelves are
  **collapsible and start collapsed** (heading + count; the page owns the
  open state, so it survives the You/Partner and filter switches and resets
  on a board switch). The heading sits inside the droppable area, so a
  collapsed shelf still accepts drops. RLS is split:
  members **read** everyone's placements but
  **write only their own** — the partner's board is read-only at the security
  boundary, not just in the UI. (Shared custom lists are the one exception —
  see Custom list above.)
- **Completion** (`tier_item_completions`) — **one person's** "I'm done with
  this" for an item; today only BOOKS use it (a `done_on` date, upsert on
  `unique (item_id, user_id)` — deliberately the same column name as the
  shared `tier_items.done_on`, so the shared and personal sides read in
  parallel). Movies/TV are watched together so their date is shared on the
  item; books are read separately, so each member marks their own — the same
  book can be ranked on one board and Unread on the other.
  `datesArePersonal()` in the tier-list `derive.ts` is the behavior switch:
  for books, shelf drags and the modal's date field write the viewer's own
  completion row and never touch the item's shared `done_on`.
  Same split RLS as placements (read everyone's, write only your own).

All four routes render the same `TierListPage` (a `kind` prop for a built-in,
the URL's list id for `/tiers/:id`), so the store —
holding every kind plus all users' placements and completions — survives
kind switches. A
You/Partner toggle swaps whose board is derived; yours is a dnd-kit board
(`TierBoard`), the partner's is the same layout with no drag wiring
(`BoardView`). Drops are optimistic: on write failure the store records the
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
  on a free-form list the same column is the optional **Note**), a fractional
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
  in-memory stores).

UI: inline **quick-add** at the top of the list (Enter adds a title-only row;
picking a TMDB / Open Library suggestion from the shared `TitleSearchInput`
adds it with poster + creator), dense ~38px rows in one bordered panel
(checkbox · 22×32 thumb · title · faint creator · ×), a collapsed **Done · n**
section below the open queue (strikethrough rows, uncheck, no dates), edits in
`ListItemModal`, list create/rename/delete in `ListDefModal`. Deliberately no
realtime-derived dates and no You/Partner toggle.

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
is, not who may edit him: the rows are shared, so either member can log or fix
up any guy. One route: an A–Z photo card grid (name · personality · owner)
with fuzzy name search (`src/lib/fuzzy.ts`) and an **owner pill row** (All /
each member in join order / Nobody in particular, each with its count — the
last pill appears only when some guy is ownerless). Adding and editing happen
in one modal, which defaults a new guy's owner to the signed-in member;
deleting confirms and takes his photo with him. Deliberately no dates, no map,
no wishlist — a shelf, not a log.

**Parks** (`/parks`) — the 63-national-parks tracker. The parks themselves are
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
(each member n/63 + Together n/63). The map always shows all 63 pins
(continental-US default framing; Alaska/Hawaiʻi/territories are a pan away)
with a display-name legend; the list groups by region with
All / member / Together / Unvisited filter pills. Clicking a pin's popup or a
list row opens the park detail modal — static facts + visit history +
add/edit/delete trips behind an internal mode switch (deletes confirm) — and a
header "+ Log visit" button opens the same trip fields behind a searchable
park picker. Scope cuts (deliberate): no photos, no parks wishlist (the
Unvisited filter is the wishlist).

**Recipes** (`/recipes`, `/recipes/:id`) — the shared cookbook. Deliberately a
**pure cookbook**: only recipes we've actually made, fully written out — no
ratings (opinions live in the notes field), no cook log, no to-try queue, no
URL auto-import (the app stays serverless; you copy-paste). A **recipe**
(`recipes` table, shared uniform RLS) has a required title and everything else
optional: plain-text **ingredients** (one per line → rendered as tappable
bullets), one **steps** textarea (**blank lines split numbered steps**; single
newlines survive inside a step — parsing lives in the recipes feature's
`derive.ts`), a **source** (free text + optional URL, shown as the attribution
line), free-text **tags** (`text[]`, tri-state include/exclude filter pills
like the tier boards), plain-text **servings** and **total time** (display
only, no scaling math), **notes**, and ONE hero **photo** uploaded to the
public `recipes` Storage bucket (same design as spoons; shared helpers in
`src/lib/photos.ts`). The index (`/recipes`) is A–Z (no sort control) with
fuzzy title search (`src/lib/fuzzy.ts`, shared with the Log dashboard) and a
**Grid / List** toggle (photo cards vs dense rows). Opening a recipe navigates
to **`/recipes/:id` — the app's first full-page sub-route detail** (both
routes render one `RecipesPage`, so the store survives; the AppLayout nav
matches sub-paths). The detail page is built for cooking from a phone:
tapping an ingredient strikes it through, tapping a step dims it — ephemeral
component state keyed by recipe id, never stored — plus a faint
"Added by X · date" byline (profiles join). Add/edit stay in a `ModalShell`
modal; delete confirms and bounces an open detail page back to the index.

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
no shared/together derivation. The store (`useBassoonStore`) follows the
lighter data-seam pattern: Supabase CRUD scoped to space + user, or an
in-memory seed when keyless.

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
  `index.css` holds exactly one rule set, the `[data-hover-card]` hover /
  focus-visible treatment that inline styles can't express (its values are
  hand-copies of `warmBorder(0.3)` / `shadows.hover` / `ACCENT`); Mantine's
  stylesheet provides the reset. Anything else belongs in the theme.
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
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth, called directly from
  the browser. Protected by Row Level Security, not by a server. **Realtime**
  (`postgres_changes`) streams the partner's edits into an open tab; the space
  tables must be in the `supabase_realtime` publication (see `schema.sql`).
- **Hosting target: Cloudflare Pages** (build `npm run build`, output `dist`).
  Deliberately not Vercel.
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
npm test           # vitest run — covers the pure logic in src/data/derive.ts
npm run test:e2e   # Playwright suite in e2e/ — keyless seed mode, port 5199
npx playwright test --ui      # Playwright UI mode — pick specs, watch runs, time-travel DOM
npx playwright test --debug   # Playwright Inspector — step through a test, live locator console
npm run preview    # serve the production build
```

**Vitest** covers `src/data/derive.ts` (see `derive.test.ts` — new derive logic
should get a test there). There is **no linter configured.** After code changes,
run `npm run build` (or `npm run typecheck`) and `npm test`.

**Playwright** (`e2e/`, config in `playwright.config.ts`) covers the browser
flows: every route hard-loads, nav/back, store survival across screen
switches, entry-modal gating, tier-board derivation, the list picker,
creating / renaming / deleting a custom list, the
mobile drawer, and that no route scrolls sideways at 390px
(`mobile-overflow.spec.ts` — its name must keep matching the mobile project's
`testMatch`).
It boots its own Vite server on a dedicated port with the Supabase keys
blanked, so it always runs against the deterministic in-memory seed — safe to
run anytime, no backend touched. Mantine interaction helpers (Select combobox,
SegmentedControl's hidden radios, Rating) live in `e2e/helpers.ts`; the
`verify` skill has the details. Deliberately **no drag-and-drop specs** —
dnd-kit drags are flaky under automation; drag logic is covered by the
tier-list `derive.test.ts` instead. Run the suite after changing UI flows it
covers; add a spec when you add a flow worth keeping.

## Current state: backend is live

Both auth **and** data run on Supabase. The two modes to know:

- **Keys present (the real app).** With `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` set, the app gates on a Supabase login
  (`useSession` + `AuthScreen`), resolves a **space** (`useSpace`), and
  `useActivityStore` reads/writes the `categories` / `activities` / `entries` /
  `entry_repeats` / `wishlist_items` / `profiles` tables (plus the home columns
  on `spaces`) scoped to that `space_id`. Changes persist; RLS enforces access.
- **Keys absent (UI dev fallback).** When `VITE_SUPABASE_*` are missing,
  `supabase` is `null`, the auth screen is skipped, and `useActivityStore`
  falls back to an **in-memory seed** (Outdoor/City/Brain + sample entries,
  wishes, repeats, and pre-geocoded pins) so the whole UI can be worked on with
  no backend. Edits vanish on reload in this mode.

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
space) so the partner's edits appear without a reload: INSERT/UPDATE events are
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

### Space bootstrap & the sharing model

Sharing model is **"manual / SQL for now"** (chosen deliberately). On first login a
user has no space, so `useSpace` auto-creates one ("Our city, together"); the
`on_space_created` trigger makes them its first member. To share one space across
two logins, add the second user to the first's space **by hand** in the Supabase
SQL Editor:

```sql
insert into public.space_members (space_id, user_id) values ('<space-id>', '<user-id>');
```

After that, both logins resolve to the same `space_id`. If you later want
self-service sharing, the natural upgrade is an invite-code RPC (`join_space`) or
add-by-email — neither is built yet.

### I can't apply SQL for you

Only the anon key is in `.env.local` (no service-role key / DB password), so schema
or RLS changes must be **run by the user** in the Supabase SQL Editor. The base
schema in `supabase/schema.sql` is already applied to the current project.

## Data model & RLS

`supabase/schema.sql` is the source of truth for the database. Key points:

- Tables: `spaces`, `space_members`, `categories`, `activities`, `entries`,
  `entry_repeats`, `wishlist_items`, `profiles`, `tier_lists`, `tier_items`, `tier_placements`,
  `tier_item_completions`, `lists`, `list_items`, `spoons`, `park_visits`,
  `recipes`, `music_practice_days`, `little_guys`.
  Plus the `spoons`, `recipes`, and `little-guys` **storage buckets** (public
  read, member-only writes via policies on `storage.objects`).
- Most tables use the uniform "space members all" `for all` policy. The
  exceptions: `profiles` (read self + co-members, update self),
  **`tier_placements` / `tier_item_completions` / `music_practice_days`** (members
  read all, but insert/update/delete require `user_id = auth.uid()` — rankings,
  book read state, and daily practice are personal; `tier_placements` alone
  also admits **null-owner rows for items on a `shared` custom list**, via
  `is_shared_board_item()`), and **`list_items`**
  (members read all; writes to BOOK rows additionally require
  `created_by = auth.uid()` — reading lists are personal, other lists stay
  shared). Follow that pattern for any future per-person opinion data.
  **`tier_lists` and `lists` are uniform/shared** — a custom board or a
  free-form list belongs to the space, and their rows are `kind 'custom'`,
  never `'book'`, so they stay outside that per-person carve-out.
- **`profiles` mirrors `auth.users`** (which the browser can't read). An
  `on_auth_user_created` trigger inserts one row per user (`id`, `email`,
  `display_name`); RLS lets you read your own profile plus any co-member's (via
  the `shares_space_with()` SECURITY DEFINER function). `created_by` columns
  default to `auth.uid()`; the UI joins them to `profiles` to show who logged
  each entry.
- **Auth model: shared data, separate logins.** Each person logs in separately but
  both belong to one **space**. Every data row carries `space_id`; RLS grants
  access only to members of that space (via the `is_space_member()`
  SECURITY DEFINER function — used to avoid RLS recursion). A trigger adds the
  creator as the first member of any new space.
- The project was created with **"Automatically expose new tables" OFF**, so the
  schema grants tables to the `authenticated` role explicitly. `anon` gets nothing.
- TypeScript types in `src/types.ts` mirror the DB columns (note: DB `entry_date`
  / `repeat_date` / `color_index` map to camelCase `date` / `date` / `colorIndex`
  in the app types). If you change the schema, update `src/types.ts` and
  regenerate `src/lib/database.types.ts` with `supabase gen types`.

## Project layout

```
src/
  App.tsx                  gate (auth → space) → BrowserRouter → AppLayout → routes
                           (the 8 feature pages are React.lazy at module scope)
  types.ts                 domain types (mirror DB columns)
  theme.ts                 earthy palette, fonts, shared colors, swatchFor()
  mantineTheme.ts          Mantine theme override mirroring theme.ts
  layout/
    AppLayout.tsx          Mantine AppShell: brand, feature nav, sign-out; mobile burger
  lib/
    format.ts              date helpers (today, isoDate, YearMonth, …) + stars
    fuzzy.ts               fuzzyMatch() subsequence title search (Log + recipes)
    text.ts                firstGrapheme() — one-emoji fields (activities, lists)
    geocode.ts             Nominatim address → lat/lng (on save only)
    image.ts               client-side photo downscale (≤1200px JPEG) for uploads
    imageUrl.ts            posterSrc() render-time TMDB/Open Library size rewrite
    photos.ts              shared Storage bucket photo upload / best-effort delete
    order.ts               positionBetween() / renormalizedPositions() fractional ordering
    profile.ts             displayNameFor() — profile → short display label
    tmdb.ts                TMDB title search (movie/TV posters) for TitleSearchInput
    openLibrary.ts         Open Library book search (covers) for TitleSearchInput — keyless
    supabase.ts            client; null until env keys are set; isSupabaseConfigured
    database.types.ts      typed schema (regenerate with supabase gen types)
  data/                    shared (cross-feature) hooks
    useSession.ts          Supabase auth session hook
    useSpace.ts            resolves/creates the active space after login
    spaceSync.ts           store plumbing: useSpaceSync, syncTable, upsertById…
    usePhotoRows.ts        shared writes for photo collections (upload, add/edit, delete + photo)
  components/              shared UI
    AuthScreen.tsx         login / sign-up (no-op without keys)
    CategoryPills.tsx      "All" + per-category filter pill row
    ComingSoon.tsx         placeholder page for unbuilt features
    ConfirmModal.tsx       ConfirmProvider / useConfirm / useConfirmOpen
    ControlBar.tsx         every page's top row: left controls, right action, rule
    EmptyCard.tsx          dashed empty-state card
    FloatingBanner.tsx     fixed dismissible error/notice banner
    MapCanvas.tsx          shared Leaflet frame: tiles, Recenter, FitToPins, icon cache
    MediaImage.tsx         poster/cover <img> with emoji fallback (tier cards, list rows)
    ModalFooter.tsx        modal action row: Delete link / Cancel / primary
    ModalShell.tsx         shared Mantine modal chrome (title, size, confirm-aware)
    PageFrame.tsx          PAGE_MAX_WIDTH + each page's padded, centered column
    PhotoCard.tsx          PhotoCardGrid + PhotoCard (spoons / guys / recipes)
    PickerRow.tsx          in-page pill row picking a board/list (tier lists, lists)
    Pill.tsx               category filter pill
    Splash.tsx             centered loading/fatal message
    Stars.tsx              read-only rating display
    TitleSearchInput.tsx   title field with debounced TMDB / Open Library suggestions
  features/
    doing-stuff/           the activity tracker (landing feature)
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
      HeaderActions.tsx    feature control bar: screen toggle + Manage / New entry
      ScreenToggle.tsx     Log / Wishlist / Map / Calendar switcher (navigates)
    tier-list/             movie/TV/book + custom boards (ice cream is one)
      TierListPage.tsx     owns the store, You/Partner toggle, item modal state
      useTierListStore.ts  data seam: lists + pool + placements + completions CRUD
      derive.ts            board building, moveItem, list keys, shared boards, pruneList
      derive.test.ts       vitest coverage for derive.ts
      copy.ts              per-kind wording + customCopy/copyFor for custom lists
      copy.test.ts         vitest coverage for copy.ts
      ListPicker.tsx       thin PickerRow wrapper: built-in boards + custom boards
      ListModal.tsx        create / re-word / delete a space-defined list
      TierBoard.tsx        dnd-kit wiring: sensors, collision, drag handlers
      BoardView.tsx        pure board layout (tier rows + collapsible shelves)
      TierCard.tsx         CardVisual (poster + fallback) + SortableCard
      ItemModal.tsx        add/edit pool item (title via TitleSearchInput)
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
      ParkMap.tsx          Leaflet map: all 63 pins colored by who's been + legend
      ParkList.tsx         region-grouped list + status filter pills
      ParkModal.tsx        park facts + visit history + add/edit visit form
      LogVisitModal.tsx    header flow: searchable park picker + trip fields
      VisitFields.tsx      shared trip fields (date, attendees, notes)
    recipes/               the shared cookbook (index + full-page recipe)
      RecipesPage.tsx      owns the store; /recipes index + /recipes/:id detail
      useRecipeStore.ts    data seam: recipes CRUD + profiles (or seed fallback)
      photos.ts            recipes bucket upload/delete (thin lib/photos.ts wrapper)
      derive.ts            pure parse (lines/steps), sort, search, tag filter
      derive.test.ts       vitest coverage for derive.ts
      RecipeGrid.tsx       photo card grid + RecipePhoto (🍲 fallback)
      RecipeList.tsx       dense A–Z rows (title, source, tags, serves/time)
      RecipeDetail.tsx     full recipe page: tap-to-cross-off, notes, byline
      RecipeModal.tsx      add/edit recipe (photo upload, textareas, tags)
    music-practice/        personal practice tracker (Bassoon wheel + Piano)
      MusicPracticePage.tsx  Bassoon / Piano toggle
      Bassoon.tsx          circle-of-fifths SVG wheel: select → Log, tempo, history
      Piano.tsx            stateless random key + scale/chord drawer
      useBassoonStore.ts   data seam: music_practice_days CRUD (or seed; no realtime)
      derive.ts            pure: CIRCLE wheel data, day helpers, Piano tables
      derive.test.ts       vitest coverage for derive.ts
e2e/
  helpers.ts               Mantine interaction helpers (Select, SegmentedControl…)
  *.spec.ts                Playwright specs (routes, navigation, doing-stuff,
                           tier-list, lists, spoons, little-guys, parks,
                           recipes, music-practice, mobile, mobile-overflow)
                           — see playwright.config.ts
supabase/
  schema.sql               tables + RLS + grants (the source of truth)
  migrations/*.sql         dated deltas to paste into the SQL Editor on a live DB
```

New features get their own `src/features/<name>/` directory with their own
store hook; only truly cross-feature code goes in `src/components/`, `src/data/`,
and `src/lib/`.

## Conventions & where logic lives

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
  visits.
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
