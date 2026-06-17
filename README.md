# Doing Stuff

A shared activity tracker — "things we've done together." Log outings under
categories → activities, rate them, and browse as cards or a table.

Built from the Claude Design "Compass" direction.

## Stack

- **Vite + React + TypeScript** (SPA)
- **Supabase** (Postgres + Auth) — backend, reached directly from the browser
- Hosting target: **Cloudflare Pages** (free, non-Vercel)

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

The app currently runs on an **in-memory store** with seed data
(`src/data/useActivityStore.ts`) so you can see and click through the full UI
before any backend is wired up.

## Project layout

```
src/
  App.tsx                  orchestration: view + modal state
  types.ts                 domain types (mirror the DB columns)
  theme.ts                 palette, fonts, shared colors
  lib/
    format.ts              date + star helpers
    supabase.ts            Supabase client (activates when env keys are set)
    database.types.ts      typed schema (regenerate with `supabase gen types`)
  data/
    useActivityStore.ts    in-memory store + actions  ← swap to Supabase here
    derive.ts              pure row-joining / filter / sort / stats
  components/
    Dashboard.tsx          header, stats, controls, cards/table, empty state
    EntryModal.tsx         new / edit entry (+ shared Overlay)
    ManageModal.tsx        categories & activities editor
    Stars.tsx              read-only rating display
supabase/
  schema.sql               tables + RLS for the shared-space model
```

## Auth model: shared data, separate logins

Both partners have their own login but share one **space** (the log). Data
tables carry a `space_id`; RLS grants access to a row only if you're a member
of that space. See `supabase/schema.sql`.

## Next steps (backend)

1. Create the Supabase project (Data API on, **auto-expose new tables off**,
   automatic RLS on, Postgres default).
2. Run `supabase/schema.sql` in the SQL Editor.
3. Copy `.env.example` → `.env.local` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
4. Add auth (sign-up / login) and a space-bootstrap flow.
5. Replace the bodies of `useActivityStore` actions with `supabase.from(...)`
   calls — the action signatures already match what the DB layer needs.
6. Deploy to Cloudflare Pages (build `npm run build`, output `dist`, add the
   two `VITE_` env vars).
