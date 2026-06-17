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

The app runs on **Supabase** for auth and data once `.env.local` is set (see
below). Without those keys it falls back to an **in-memory seed**
(`src/data/useActivityStore.ts`) so you can click through the full UI with no
backend — handy for pure UI work.

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
    useActivityStore.ts    Supabase CRUD (or in-memory seed when no keys)
    useSession.ts          Supabase auth session hook
    useSpace.ts            resolves/creates the active space after login
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

## Backend setup (done)

The Supabase backend is wired up and live:

1. Supabase project created (Data API on, **auto-expose new tables off**,
   automatic RLS on, Postgres default).
2. `supabase/schema.sql` applied in the SQL Editor.
3. `.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Auth (`useSession` + `AuthScreen`) and space bootstrap (`useSpace`) are in
   place; `useActivityStore` reads/writes the database, scoped by `space_id`.

### Sharing the log between two people

The sharing model is **manual for now**: each login auto-creates its own space.
To share one space across both logins, add the second user to the first's space
in the SQL Editor:

```sql
insert into public.space_members (space_id, user_id) values ('<space-id>', '<user-id>');
```

(Find the ids in the `spaces` table and Authentication → Users.)

## Deploy to Cloudflare Pages

Build `npm run build`, output directory `dist`, and add the two `VITE_` env vars
in the Pages project settings.
