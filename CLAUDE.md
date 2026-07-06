# CLAUDE.md

Guidance for working in this repo. Read this before making changes.

## What this is

**cajubinile.com** — a shared personal site for two people, split into features
behind a persistent Mantine AppShell header (brand + feature nav + sign-out).
Routing is **react-router (library mode)**: `/`, `/wishlist`, `/map`,
`/calendar` are the Doing Stuff feature's screens; `/movies` and `/tv` are the
**Tier Lists** feature; `/french-toast`, `/parks`, and `/spoons` are placeholder
pages for features not built yet (a french toast ranking, a 63-national-parks
visit tracker, a souvenir-spoon collection map). All features share the one
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

**Tier Lists** (`/movies`, `/tv`) — drag-n-drop S/A/B/C/D/F boards. The domain
model splits pool from opinion:

- **Tier item** (`tier_items`) — a movie or show in the space's **shared pool**
  (a `kind 'movie'|'tv'` column, a title, a hand-pasted poster `image_url`).
  Any member can add/edit/delete; deleting removes everyone's rankings of it.
- **Tier placement** (`tier_placements`) — **one person's** ranking of one item:
  `tier` + fractional `position` within the tier (midpoint insertion on drop =
  one-row upsert on `unique (item_id, user_id)`; the client renormalizes a tier
  to integers if float precision ever runs out). "Unranked" is the absence of a
  placement row. RLS is split: members **read** everyone's placements but
  **write only their own** — the partner's board is read-only at the security
  boundary, not just in the UI.

Both routes render the same `TierListPage` (kind prop), so the store — holding
both kinds and all users' placements — survives Movies ↔ TV switches. A
You/Partner toggle swaps whose board is derived; yours is a dnd-kit board
(`TierBoard`), the partner's is the same layout with no drag wiring
(`BoardView`). Drops are optimistic: on write failure the store records the
error and refetches, so the card snaps back.

Visual direction: **earthy & natural** (terracotta clay, sage green, warm
paper), ported from the Claude Design "Compass" direction.

## Tech stack

- **Vite + React 19 + TypeScript**, SPA.
- **react-router v7 in plain library mode** (`BrowserRouter` + `Routes` from
  `react-router`) — no loaders, no framework mode. Cloudflare Pages serves
  `index.html` as the SPA fallback, so deep links work with no extra config.
- **Mantine v8** (`@mantine/core`) for UI components. The earthy look lives in
  two files: `src/theme.ts` (raw palette, fonts, category swatches — the source
  of truth) and `src/mantineTheme.ts` (translates it into a Mantine theme so
  components inherit it). Style with Mantine props plus inline style objects
  referencing `theme.ts`. **No Tailwind, no CSS files** — `index.css` stays
  empty; Mantine's stylesheet provides the reset.
- **Leaflet / react-leaflet** for the map (CARTO Voyager raster tiles).
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
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth, called directly from
  the browser. Protected by Row Level Security, not by a server. **Realtime**
  (`postgres_changes`) streams the partner's edits into an open tab; the space
  tables must be in the `supabase_realtime` publication (see `schema.sql`).
- **Hosting target: Cloudflare Pages** (build `npm run build`, output `dist`).
  Deliberately not Vercel.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  (this is the typecheck-on-build gate)
npm run typecheck  # tsc -b --noEmit
npm test           # vitest run — covers the pure logic in src/data/derive.ts
npm run preview    # serve the production build
```

**Vitest** covers `src/data/derive.ts` (see `derive.test.ts` — new derive logic
should get a test there). There is **no linter configured.** After code changes,
run `npm run build` (or `npm run typecheck`) and `npm test`.

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
when a new write starts or when the banner is clicked; `store.notice` is a
non-fatal warning (e.g. an un-geocodable address), dismissed via `clearNotice`.

In live mode the store also subscribes to **Supabase Realtime** (one channel per
space) so the partner's edits appear without a reload: INSERT/UPDATE events are
filtered to the space server-side and **upserted by id** (which makes echoes of
this client's own writes idempotent); DELETE events can't be filtered
server-side (Postgres replicates only the PK), so they're matched by id and
ignored if unknown. DB cascades arrive as their own events, so no
special-casing. A dropped-then-rejoined channel refetches the full snapshot
(`fetchAll`/`applySnapshot`) to cover anything missed while offline. Keyless
seed mode skips all of this.

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
  `entry_repeats`, `wishlist_items`, `profiles`, `tier_items`, `tier_placements`.
- Most tables use the uniform "space members all" `for all` policy. The two
  exceptions: `profiles` (read self + co-members, update self) and
  **`tier_placements`** (members read all, but insert/update/delete require
  `user_id = auth.uid()` — rankings are personal). Follow the placement pattern
  for any future per-person opinion data.
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
  types.ts                 domain types (mirror DB columns)
  theme.ts                 earthy palette, fonts, shared colors, swatchFor()
  mantineTheme.ts          Mantine theme override mirroring theme.ts
  layout/
    AppLayout.tsx          Mantine AppShell: brand, feature nav, sign-out; mobile burger
  lib/
    format.ts              date helpers (today, isoDate, YearMonth, …) + stars
    geocode.ts             Nominatim address → lat/lng (on save only)
    supabase.ts            client; null until env keys are set; isSupabaseConfigured
    database.types.ts      typed schema (regenerate with supabase gen types)
  data/                    shared (cross-feature) hooks
    useSession.ts          Supabase auth session hook
    useSpace.ts            resolves/creates the active space after login
  components/              shared UI
    AuthScreen.tsx         login / sign-up (no-op without keys)
    ComingSoon.tsx         placeholder page for unbuilt features
    ModalShell.tsx         shared Mantine modal chrome
    Pill.tsx               category filter pill
    Stars.tsx              read-only rating display
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
    tier-list/             movie + TV tier boards (/movies + /tv, kind prop)
      TierListPage.tsx     owns the store, You/Partner toggle, item modal state
      useTierListStore.ts  data seam: pool + placements CRUD (or seed fallback)
      derive.ts            pure board building, moveItem, fractional positions
      derive.test.ts       vitest coverage for derive.ts
      TierBoard.tsx        dnd-kit wiring: sensors, collision, drag handlers
      BoardView.tsx        pure board layout (tier rows + unranked shelf)
      TierCard.tsx         CardVisual (poster + fallback) + SortableCard
      ItemModal.tsx        add/edit pool item with live card preview
supabase/
  schema.sql               tables + RLS + grants
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
- **Destructive deletes confirm first.** Entry, activity, and category deletion
  go through `window.confirm` (the message spells out what cascades). Keep this
  for anything else that destroys logged data.
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
