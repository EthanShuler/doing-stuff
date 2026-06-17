# CLAUDE.md

Guidance for working in this repo. Read this before making changes.

## What this is

**Doing Stuff** — a shared activity tracker for logging things done together in a
new city. The model is three levels deep:

- **Category** (e.g. Outdoor, City, Brain) — has a name and a color.
- **Activity** belongs to a category (e.g. Outdoor → Park, Swimming, Backpacking).
- **Entry** (a logged outing) references one activity and adds a **title**, **date**,
  **description**, and **1–5 star rating**.

The **dashboard** lists entries with filter-by-category, sort (recent / rating /
category), and two view modes: **cards** (default) and a compact **table**. A new
entry is created by picking a **category dropdown**, then an **activity dropdown**
scoped to that category, plus the title/date/description/rating fields.

Visual direction: **earthy & natural** (terracotta clay, sage green, warm paper),
ported from the Claude Design "Compass" direction.

## Tech stack

- **Vite + React 18 + TypeScript**, SPA. No router (single screen + modals).
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth, called directly from
  the browser. Protected by Row Level Security, not by a server.
- **Hosting target: Cloudflare Pages** (build `npm run build`, output `dist`).
  Deliberately not Vercel.
- **No CSS framework** — styling is inline-style objects driven by `src/theme.ts`.
  Keep new UI consistent with that pattern rather than introducing Tailwind/CSS files.

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

## ⚠️ Current state: backend is half-wired

This is the single most important thing to know before editing.

- **Auth is live.** `src/lib/supabase.ts`, `src/data/useSession.ts`, and
  `src/components/AuthScreen.tsx` are real. When `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` are set, the app gates on a Supabase login.
- **Data is NOT live.** All categories/activities/entries come from an **in-memory
  store with seed data** in `src/data/useActivityStore.ts`. Edits live only in
  React state and vanish on reload. The seed data is the user's example data
  (Outdoor/City/Brain + sample entries).
- When `VITE_SUPABASE_*` are **absent**, `supabase` is `null`, the auth screen is
  skipped, and the app runs straight on the in-memory store — useful for UI work.

`useActivityStore` is the **designed seam** for the database. Its action
signatures (`addEntry`, `updateEntry`, `deleteEntry`, `addActivity`,
`deleteActivity`, `addCategory`, `deleteCategory`) already match what the DB layer
needs. To go live, replace their bodies with `supabase.from(...)` calls (plus
loading/error state and a `space_id`) — components should not need to change.

## Data model & RLS

`supabase/schema.sql` is the source of truth for the database. Key points:

- Tables: `spaces`, `space_members`, `categories`, `activities`, `entries`.
- **Auth model: shared data, separate logins.** Each person logs in separately but
  both belong to one **space**. Every data row carries `space_id`; RLS grants
  access only to members of that space (via the `is_space_member()`
  SECURITY DEFINER function — used to avoid RLS recursion). A trigger adds the
  creator as the first member of any new space.
- The project was created with **"Automatically expose new tables" OFF**, so the
  schema grants tables to the `authenticated` role explicitly. `anon` gets nothing.
- TypeScript types in `src/types.ts` mirror the DB columns (note: DB `entry_date`
  / `color_index` map to camelCase `date` / `colorIndex` in the app types). If you
  change the schema, update `src/types.ts` and regenerate
  `src/lib/database.types.ts` with `supabase gen types`.

## Project layout

```
src/
  App.tsx                  gate (auth) → AppShell; owns view + modal state
  types.ts                 domain types (mirror DB columns)
  theme.ts                 earthy palette, fonts, shared colors, swatchFor()
  lib/
    format.ts              date + star helpers (today, currentMonthPrefix, …)
    supabase.ts            client; null until env keys are set; isSupabaseConfigured
    database.types.ts      typed schema (regenerate with supabase gen types)
  data/
    useActivityStore.ts    in-memory store + actions   ← swap to Supabase here
    useSession.ts          Supabase auth session hook
    derive.ts              pure join / filter / sort / stats (no React)
  components/
    AuthScreen.tsx         login / sign-up (no-op without keys)
    Dashboard.tsx          header, stats, controls, cards/table, empty state
    EntryModal.tsx         new / edit entry (category→activity dropdowns)
    ManageModal.tsx        categories & activities editor
    Stars.tsx              read-only rating display
supabase/
  schema.sql               tables + RLS + grants
```

## Conventions & where logic lives

- **Keep data-shaping pure and in `src/data/derive.ts`.** Joining entries to their
  activity/category, filtering, sorting, and stats all live there as plain
  functions with no React. `App.tsx` wires them via `useMemo`. Add new
  filter/sort/stat logic here, not inside components.
- **Deletes cascade in the store**, mirroring the DB's `on delete cascade`:
  deleting an activity drops its entries; deleting a category drops its activities
  and their entries. Preserve this when wiring Supabase.
- **Colors are indices, not strings.** A category stores `colorIndex` into
  `palette` in `theme.ts`; resolve with `swatchFor()`. `FALLBACK_COLOR` covers
  entries whose category was deleted.
- **Styling is inline-style objects** referencing `colors` / `fonts` / `palette`
  from `theme.ts`. Match this; don't add a CSS framework or stylesheet.
- **Env vars are `VITE_`-prefixed** (public, shipped to the browser). Never put the
  Supabase `service_role` key in the client. RLS is the security boundary.
```
