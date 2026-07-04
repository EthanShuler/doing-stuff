# CLAUDE.md

Guidance for working in this repo. Read this before making changes.

## What this is

**Doing Stuff** — a shared activity tracker for logging things done together in a
new city. The domain model:

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

Four screens behind a header toggle, no router: **Log** (dashboard: stats,
category filter, fuzzy title search, cards/table views, sort), **Wishlist**,
**Map** (Leaflet; emoji pins for entries, ⭐ for open wishes, 🏠 for home, with
its own category/wishlist filter), and **Calendar** (month grid of entries +
repeats). Entry editing, repeats, and category/activity/home management happen
in modals.

Visual direction: **earthy & natural** (terracotta clay, sage green, warm
paper), ported from the Claude Design "Compass" direction.

## Tech stack

- **Vite + React 18 + TypeScript**, SPA.
- **Mantine v8** (`@mantine/core`) for UI components. The earthy look lives in
  two files: `src/theme.ts` (raw palette, fonts, category swatches — the source
  of truth) and `src/mantineTheme.ts` (translates it into a Mantine theme so
  components inherit it). Style with Mantine props plus inline style objects
  referencing `theme.ts`. **No Tailwind, no CSS files** — `index.css` stays
  empty; Mantine's stylesheet provides the reset.
- **Leaflet / react-leaflet** for the map (CARTO Voyager raster tiles).
- **Nominatim** (OpenStreetMap) for address → lat/lng geocoding, called from
  the browser **on save only**, never per keystroke — see the rate-policy notes
  in `src/lib/geocode.ts`. Coords are stored on the row; the map never geocodes
  at render time.
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth, called directly from
  the browser. Protected by Row Level Security, not by a server.
- **Hosting target: Cloudflare Pages** (build `npm run build`, output `dist`).
  Deliberately not Vercel.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  (this is the typecheck-on-build gate)
npm run typecheck  # tsc -b --noEmit
npm run preview    # serve the production build
```

There is **no test runner and no linter configured.** After code changes, run
`npm run build` (or `npm run typecheck`) to confirm the project still compiles.

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
  `entry_repeats`, `wishlist_items`, `profiles`.
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
  App.tsx                  gate (auth) → AppShell; owns screen + modal state
  types.ts                 domain types (mirror DB columns)
  theme.ts                 earthy palette, fonts, shared colors, swatchFor()
  mantineTheme.ts          Mantine theme override mirroring theme.ts
  lib/
    format.ts              date helpers (today, isoDate, YearMonth, …) + stars
    geocode.ts             Nominatim address → lat/lng (on save only)
    supabase.ts            client; null until env keys are set; isSupabaseConfigured
    database.types.ts      typed schema (regenerate with supabase gen types)
  data/
    useActivityStore.ts    data seam: Supabase CRUD (or in-memory seed fallback)
    useSession.ts          Supabase auth session hook
    useSpace.ts            resolves/creates the active space after login
    derive.ts              pure join / filter / sort / stats / markers / calendar
  components/
    AuthScreen.tsx         login / sign-up (no-op without keys)
    Dashboard.tsx          Log screen: stats, controls, cards/table, empty state
    Wishlist.tsx           wishlist screen (add / edit / place / check off)
    MapView.tsx            Leaflet map with emoji pins + map-local filter
    CalendarView.tsx       month grid of entries + repeats
    EntryModal.tsx         new / edit entry (category→activity dropdowns)
    RepeatModal.tsx        log / remove repeats of an entry
    ManageModal.tsx        categories & activities editor + home base
    ModalShell.tsx         shared Mantine modal chrome
    HeaderActions.tsx      screen toggle + Manage / New entry buttons
    ScreenToggle.tsx       Log / Wishlist / Map / Calendar switcher
    Stars.tsx              read-only rating display
supabase/
  schema.sql               tables + RLS + grants
```

## Conventions & where logic lives

- **Keep data-shaping pure and in `src/data/derive.ts`.** Joining entries to their
  activity/category, filtering, sorting, stats, map markers, and the calendar
  grid all live there as plain functions with no React. `App.tsx` wires them via
  `useMemo`. Add new filter/sort/stat logic here, not inside components.
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
