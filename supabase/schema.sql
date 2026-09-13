-- ============================================================================
--  Doing Stuff — database schema + Row Level Security
-- ----------------------------------------------------------------------------
--  Auth model: SHARED DATA, SEPARATE LOGINS.
--  Each person has their own auth account. Data belongs to a "space" (a shared
--  log). Both partners are members of the same space and see/edit the same
--  categories, activities, and entries.
--
--  Run this in the Supabase SQL Editor (or via `supabase db push`). It is
--  idempotent enough to re-run during development.
--
--  NOTE: This project was created with "Automatically expose new tables" OFF,
--  so each table is granted to the `authenticated` role explicitly below. The
--  `anon` role gets nothing — you must be logged in to touch any data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.spaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- Shared map center. Address is geocoded client-side (Nominatim) on save.
  home_address  text,
  home_lat      double precision,
  home_lng      double precision,
  created_at    timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id    uuid not null references public.spaces (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  name        text not null,
  color_index int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name        text not null,
  -- Single emoji used as this activity's map-pin icon (nullable / '' = none).
  emoji       text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  title       text not null default '',
  entry_date  date not null,
  description text not null default '',
  rating      int  not null check (rating between 1 and 5),
  -- Who logged this outing. Defaults to the inserting user; the UI resolves the
  -- name via the `profiles` table (the browser can't read auth.users directly).
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  -- Optional place this outing happened. Address is geocoded client-side
  -- (Nominatim) on save; lat/lng stay null when blank or unlocatable. An entry
  -- with coords shows as a pin on the map view.
  address     text not null default '',
  lat         double precision,
  lng         double precision,
  -- When true, this entry is omitted from the map even if it has coords.
  hide_from_map boolean not null default false,
  created_at  timestamptz not null default now()
);

-- If the entries table already exists from an earlier schema, add the column:
alter table public.entries add column if not exists created_by uuid references auth.users (id) on delete set null default auth.uid();

-- ---------------------------------------------------------------------------
-- Map feature migration (run if these tables predate the map feature):
-- ---------------------------------------------------------------------------
alter table public.spaces     add column if not exists home_address text;
alter table public.spaces     add column if not exists home_lat double precision;
alter table public.spaces     add column if not exists home_lng double precision;
alter table public.activities add column if not exists emoji text not null default '';
alter table public.entries    add column if not exists address text not null default '';
alter table public.entries    add column if not exists lat double precision;
alter table public.entries    add column if not exists lng double precision;
alter table public.entries    add column if not exists hide_from_map boolean not null default false;

-- ---------------------------------------------------------------------------
-- Wishlist: free-text "things we want to try". Checking one off in the UI opens
-- a prefilled entry; saving links the item to that entry via `entry_id`
-- (null = open, set = done). ON DELETE SET NULL means deleting the entry later
-- reopens the item rather than orphaning it.
-- ---------------------------------------------------------------------------

create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  text        text not null default '',
  entry_id    uuid references public.entries (id) on delete set null,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  -- Optional place we want to go, geocoded for an open-wish ⭐ pin on the map.
  address     text,
  lat         double precision,
  lng         double precision
);

-- ---------------------------------------------------------------------------
-- Profiles: a readable mirror of each auth.users row (which the client can't
-- query). One row per user, kept in sync by a trigger on sign-up. Lets the UI
-- show "who logged this" by joining entries.created_by → profiles.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Repeats: each row is an *additional* time you returned to an entry's
-- place/activity. The entry's own `entry_date` is the first entry; these are
-- the repeats. Total count = 1 + number of these rows (derived, never stored).
-- ON DELETE CASCADE from entries cleans them up when the entry is removed.
-- ---------------------------------------------------------------------------

create table if not exists public.entry_repeats (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id)  on delete cascade,
  entry_id    uuid not null references public.entries (id) on delete cascade,
  repeat_date date not null,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

-- Helpful indexes for the space-scoped queries the app runs.
create index if not exists space_members_user_idx on public.space_members (user_id);
create index if not exists categories_space_idx on public.categories (space_id);
create index if not exists activities_space_idx on public.activities (space_id);
create index if not exists activities_category_idx on public.activities (category_id);
create index if not exists entries_space_idx     on public.entries (space_id);
create index if not exists entries_activity_idx  on public.entries (activity_id);
create index if not exists wishlist_space_idx     on public.wishlist_items (space_id);
create index if not exists wishlist_entry_idx     on public.wishlist_items (entry_id);
create index if not exists entry_repeats_space_idx on public.entry_repeats (space_id);
create index if not exists entry_repeats_entry_idx on public.entry_repeats (entry_id);

-- ---------------------------------------------------------------------------
-- Tier lists (movies + TV + books + space-defined lists): a SHARED pool of items,
-- PER-PERSON rankings. `tier_items` is the pool — any space member can add/edit.
-- `tier_placements` holds one member's ranking of one item (tier + fractional
-- position within the tier); "unranked" is simply the absence of a placement
-- row. Placements are opinion data, so RLS below lets members READ each
-- other's but WRITE only their own — the partner's board is read-only at the
-- security boundary.
--
-- Besides the three built-in boards (kind 'movie'/'tv'/'book' — built in for
-- their title-search providers and want-to lists), a space can define its own
-- lists ("Ice Cream", "Bugs", "Fruits") in `tier_lists`. Those
-- rows are shared space data with the uniform policy; their items carry
-- kind = 'custom' plus a `list_id`, so deleting a list is ONE statement and
-- Postgres cascades everything under it.
--
-- A custom list can also be `shared`: ONE board the space ranks together
-- instead of a board per member. Its placements carry user_id = NULL (the
-- unique index treats nulls as equal, so it's still one row per item) and the
-- placement policies let any member write those null-owner rows — but only
-- for items on a list flagged shared (`is_shared_board_item`).
-- ---------------------------------------------------------------------------

-- A space-defined tier list. Behavior is fixed to one template (shared pool,
-- S–F tiers, a "Not <past>" shelf, no visible dates), so the row carries
-- WORDS — the app templates all its copy from them (customCopy in the
-- tier-list copy.ts) — plus the `shared` flag. Ice cream was a built-in kind
-- until 2026-09-13; migrations/20260913_ice_cream_custom_list.sql turned it
-- into one of these rows.
create table if not exists public.tier_lists (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  -- Display name, as typed: "Fruits".
  name        text not null,
  -- Single emoji for the picker pill and imageless cards ('' = 🏷️).
  emoji       text not null default '',
  -- Singular noun, lowercase: "fruit" → "Add a fruit".
  noun        text not null,
  -- Past participle: "tried" → the "Not tried" shelf.
  -- (`verb` lived here until 2026-09-12, when boards lost their to-<verb>
  --  list to the Lists feature; the migration drops it.)
  past        text not null default 'tried',
  -- True = one board both members rank together (null-owner placements);
  -- false = the usual board per person. Flipping it never moves rankings —
  -- the other mode's rows stay put and show again if it's flipped back.
  -- On an existing DB: see migrations/20260912_shared_tier_lists.sql.
  shared      boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists tier_lists_space_idx on public.tier_lists (space_id);

create table if not exists public.tier_items (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  -- On an existing DB, admit a new kind with:
  --   alter table public.tier_items drop constraint tier_items_kind_check;
  --   alter table public.tier_items add constraint tier_items_kind_check
  --     check (kind in ('movie', 'tv', 'book', 'custom'));
  kind        text not null check (kind in ('movie', 'tv', 'book', 'custom')),
  -- Set exactly when kind = 'custom' (the CHECK below enforces the pairing):
  -- which space-defined list this item is on. ON DELETE CASCADE is what makes
  -- deleting a list one statement.
  list_id     uuid references public.tier_lists (id) on delete cascade,
  title       text not null,
  -- Poster/cover image, pasted as a URL ('' = none; the card shows a fallback).
  image_url   text not null default '',
  -- The day we finished it (SHARED, like the item itself). Null = unknown;
  -- the client defaults it to today on add / a Lists check-off. Movies/TV
  -- only — books are read separately, so their dates are per person in
  -- `tier_item_completions.done_on` (same column name on purpose) and this
  -- stays null. Custom lists show no dates in the UI but reuse this as their
  -- shared tried/not-tried marker. Renamed from `watched_on` on 2026-09-11 —
  -- see the migration note at the end of this section.
  done_on     date,
  -- Free-text labels ("disney", "fantasy", "childhood reads") for filtering
  -- the boards. Shared like the item itself — they describe it, not an
  -- opinion of it. On an existing DB, apply with:
  --   alter table public.tier_items add column tags text[] not null default '{}';
  tags        text[] not null default '{}',
  -- Who made it — the author for books, director for movies, and so on (see
  -- `creatorLabel` in the tier-list copy.ts for the per-kind wording). Free
  -- text, shared like the title ('' = unknown/not entered). On an existing DB:
  --   alter table public.tier_items add column creator text not null default '';
  creator     text not null default '',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  -- kind and list_id always travel together: 'custom' means a list, every
  -- other kind means none. A missed insert site fails loudly here instead of
  -- writing a row on no board.
  constraint tier_items_list_kind_check check ((kind = 'custom') = (list_id is not null))
);

create table if not exists public.tier_placements (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  item_id     uuid not null references public.tier_items (id) on delete cascade,
  -- Whose ranking. NULL = the one shared board of a `shared` custom list;
  -- the client sets it explicitly (never left to the default) so a shared
  -- row isn't stamped with the writer.
  user_id     uuid references auth.users (id) on delete cascade default auth.uid(),
  tier        text not null check (tier in ('S', 'A', 'B', 'C', 'D', 'F')),
  -- Fractional ordering within the tier (midpoint insertion; the client
  -- renormalizes a tier to integers if float precision ever runs out).
  position    double precision not null,
  created_at  timestamptz not null default now(),
  -- One ranking per person per item — also the upsert conflict target.
  -- NULLS NOT DISTINCT so a shared board's null owner is one owner too
  -- (and so ON CONFLICT (item_id, user_id) can infer this index for it).
  unique nulls not distinct (item_id, user_id)
);

-- PER-PERSON completion state — today only BOOK items use it. Movies/TV are
-- watched together, so their date is the shared `done_on` above; books are
-- read separately, so each member records their own finish date here. Absence
-- of a row = that member hasn't finished it (the book sits on their Unread
-- shelf). Opinion data like placements → same split RLS below (members read
-- all, write only their own rows).
create table if not exists public.tier_item_completions (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  item_id     uuid not null references public.tier_items (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- The day this member finished it.
  done_on     date not null,
  created_at  timestamptz not null default now(),
  -- One read record per person per item — also the upsert conflict target.
  unique (item_id, user_id)
);

create index if not exists tier_items_space_idx      on public.tier_items (space_id);
create index if not exists tier_items_list_idx       on public.tier_items (list_id);
create index if not exists tier_placements_space_idx on public.tier_placements (space_id);
create index if not exists tier_placements_item_idx  on public.tier_placements (item_id);
create index if not exists tier_item_completions_space_idx on public.tier_item_completions (space_id);
create index if not exists tier_item_completions_item_idx  on public.tier_item_completions (item_id);

-- Whether an item sits on a custom list flagged `shared` — the gate for
-- writing a null-owner placement of it. SECURITY DEFINER like
-- is_space_member so the policy check doesn't recurse through the item and
-- list tables' own RLS; the calling policy still requires space membership.
create or replace function public.is_shared_board_item(target_item uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.tier_items i
    join public.tier_lists l on l.id = i.list_id
    where i.id = target_item
      and l.shared
  );
$$;

-- Migration (2026-09-11): the per-person date table was `tier_item_reads`
-- (book-specific in name only) and the shared one `tier_items.watched_on`.
-- Both now read in parallel as `done_on`. On an existing DB, run once:
--   alter table public.tier_item_reads rename to tier_item_completions;
--   alter table public.tier_item_completions rename column read_on to done_on;
--   alter index if exists tier_item_reads_space_idx rename to tier_item_completions_space_idx;
--   alter index if exists tier_item_reads_item_idx  rename to tier_item_completions_item_idx;
--   alter table public.tier_items rename column watched_on to done_on;
-- A table rename keeps the rows, constraints, RLS policies (their names are
-- unchanged — still "members read reads" and friends) and the table's
-- `supabase_realtime` publication membership, which follows the OID.

-- ---------------------------------------------------------------------------
-- Lists: the want-to lists. Their own feature since 2026-09-12 — the tier
-- boards are tiers only now. Two tables:
--   * `lists` — free-form lists the space defines from the UI ("Groceries").
--     Shared space data with the uniform member policy. The movie, TV and book
--     lists are BUILT IN and need no row here.
--   * `list_items` — one row per thing on a list. Movie/TV rows are SHARED
--     (either member adds, reorders, checks off); the book reading list is PER
--     PERSON — each member keeps their own, owned via `created_by`, and RLS
--     lets only the owner write a book row (the UI shows only the viewer's).
--     Free-form rows (kind 'custom' + `list_id`) are shared like the list.
--
-- "Done" reads two ways, by kind:
--   * movie / tv / book: checking off creates a `tier_items` row in the shared
--     pool (so it lands on the board's unranked shelf) and links to it via
--     `tier_item_id` — null = still want-to, set = done. ON DELETE SET NULL
--     means deleting that tier item later REOPENS the row rather than
--     orphaning it, and the cascaded UPDATE reaches an open Lists page as a
--     plain realtime event, so the client never needs a cross-table read.
--   * custom: there's no board to promote onto, so the row carries its own
--     `done_on` date stamp instead (null = still open).
-- Same shape as the doing-stuff wishlist -> entry pattern.
-- ---------------------------------------------------------------------------

create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  -- Display name, as typed: "Groceries".
  name        text not null,
  -- Single emoji for the picker pill ('' = the app's fallback tag emoji).
  emoji       text not null default '',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists lists_space_idx on public.lists (space_id);

create table if not exists public.list_items (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces (id) on delete cascade,
  -- The three built-in lists, plus 'custom' for a row on a `lists` row.
  kind         text not null check (kind in ('movie', 'tv', 'book', 'custom')),
  -- Set exactly when kind = 'custom' (the CHECK below enforces the pairing):
  -- which free-form list this row is on. ON DELETE CASCADE is what makes
  -- deleting a list ONE statement.
  list_id      uuid references public.lists (id) on delete cascade,
  title        text not null,
  -- Optional poster/cover, pasted as a URL; carried onto the tier item when
  -- checked off. Free-form rows show no image.
  image_url    text not null default '',
  -- Who made it (author/director — see `creatorLabel` in the lists copy.ts),
  -- carried onto the tier item when checked off, like the image. Free-form
  -- rows reuse the column as an optional free-text note.
  creator      text not null default '',
  -- Queue order within the list — it's a priority queue, top (lowest
  -- position) = watch/read/do next. Fractional midpoint insertion on drag,
  -- like tier_placements.position; the client appends new rows at max + 1.
  position     double precision not null default 0,
  -- The tier item this produced when checked off; null while still open.
  -- Movie/TV/book rows only.
  tier_item_id uuid references public.tier_items (id) on delete set null,
  -- Free-form rows only: the day it was done (null = still open). Media rows
  -- leave this null and mark done with `tier_item_id` instead.
  done_on      date,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint list_items_list_kind_check check ((kind = 'custom') = (list_id is not null))
);

create index if not exists list_items_space_idx on public.list_items (space_id);
create index if not exists list_items_tier_item_idx on public.list_items (tier_item_id);
create index if not exists list_items_list_idx on public.list_items (list_id);

-- Migration (2026-09-12): the Lists feature — run
-- supabase/migrations/20260912_lists_feature.sql once on an existing DB. It
-- creates `lists`, renames `watchlist_items` to `list_items` (a rename keeps
-- the rows, grants, RLS policies, indexes and the `supabase_realtime`
-- membership — all follow the table OID), drops its ice-cream and
-- custom-tier-board rows, re-points `list_id` at `lists`, adds `done_on`, and
-- drops the now-unused `tier_lists.verb`.

-- ---------------------------------------------------------------------------
-- Spoons: the souvenir spoon collection. Each row is one physical spoon —
-- shared space data (uniform "space members all" policy below; either member
-- can log or fix up a spoon). The photo is uploaded to the public `spoons`
-- storage bucket (see the storage section at the end) and stored here as its
-- public URL ('' = none; the UI shows a 🥄 fallback). `place` is free text
-- ("Paris", "Yellowstone gift shop") geocoded client-side (Nominatim) on save,
-- like entry addresses; lat/lng stay null when blank or unlocatable, and such
-- spoons appear in the list but not on the map.
-- ---------------------------------------------------------------------------

create table if not exists public.spoons (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  name        text not null,
  image_url   text not null default '',
  -- Where the spoon came from (free text; '' = unknown/forgotten).
  place       text not null default '',
  lat         double precision,
  lng         double precision,
  -- When Squabby got it. Null = unknown; sorts after dated spoons.
  acquired_on date,
  -- The story behind the spoon ("from the honeymoon").
  notes       text not null default '',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists spoons_space_idx on public.spoons (space_id);

-- ---------------------------------------------------------------------------
-- Park visits: the 63-national-parks tracker. The parks themselves are a
-- static in-repo list (src/features/parks/parks.ts, keyed by NPS park code) —
-- only visits live here. Each row is ONE TRIP: a park can accumulate many
-- rows (Yosemite 2019 and 2023), the date is optional ("went as a kid"), and
-- `attendee_ids` records who was on the trip so stats derive per person AND
-- together (= both ids on one row that isn't marked `separate`). Shared space
-- data with the uniform policy below — attendees are data, not ownership;
-- either member can log or fix up a trip.
-- ---------------------------------------------------------------------------

create table if not exists public.park_visits (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces (id) on delete cascade,
  -- NPS park code from the static list ('yose', 'zion', …).
  park_code    text not null,
  -- When the trip was. Null = sometime, long ago.
  visited_on   date,
  notes        text not null default '',
  -- auth.users ids of who was on the trip (the UI defaults to both members).
  attendee_ids uuid[] not null default '{}',
  -- One-row shorthand for "we've both been, but on different trips": all
  -- attendees, separate = true. Counts toward each attendee's total but NOT
  -- toward Together (same as logging one solo row per person, which derives
  -- the same "separately" state). Meaningless on solo rows.
  separate     boolean not null default false,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

create index if not exists park_visits_space_idx on public.park_visits (space_id);

-- ---------------------------------------------------------------------------
-- Recipes: the shared cookbook. Each row is one recipe we've actually made,
-- written out in full — shared space data (uniform "space members all" policy
-- below; either member can add or fix up a recipe). The text fields hold
-- plain text with light client-side structure: `ingredients` is one
-- ingredient per line, `steps` splits into numbered steps on blank lines
-- (see src/features/recipes/derive.ts). The photo is uploaded to the public
-- `recipes` storage bucket (see the storage section at the end) and stored
-- here as its public URL ('' = none; the UI shows a 🍲 fallback).
-- ---------------------------------------------------------------------------

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  title       text not null,
  image_url   text not null default '',
  -- One ingredient per line ("2 cups flour").
  ingredients text not null default '',
  -- Instructions; blank lines split them into numbered steps.
  steps       text not null default '',
  -- Where it's from ("Adapted from Smitten Kitchen", "Grandma Ruth") plus an
  -- optional link to the original.
  source      text not null default '',
  source_url  text not null default '',
  -- Free-text labels ("dinner", "soup", "thai") for the index filter pills.
  tags        text[] not null default '{}',
  -- Both plain display text, no math ("4", "6 as a side"; "45 min").
  servings    text not null default '',
  total_time  text not null default '',
  -- Our notes — tweaks and verdicts ("double the garlic next time").
  notes       text not null default '',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists recipes_space_idx on public.recipes (space_id);

-- ---------------------------------------------------------------------------
-- Little guys: the collection of little guys (Smiskis and friends). Each row
-- is one physical figurine — shared space data (uniform "space members all"
-- policy below; either member can add or fix up a little guy), even though
-- each guy belongs to ONE of you: `owner_id` is a member reference, not a
-- permission (null = nobody in particular / shared). `source` is free text for
-- who got it for you ("Meg, for my birthday") — deliberately not a member
-- reference, since gifts come from outside the space too. The photo is
-- uploaded to the public `little-guys` storage bucket (see the storage section
-- at the end) and stored here as its public URL ('' = none; the UI shows a 🗿
-- fallback).
-- ---------------------------------------------------------------------------

create table if not exists public.little_guys (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  name        text not null,
  image_url   text not null default '',
  -- Who got it for you — free text ("Meg", "found him in Kyoto").
  source      text not null default '',
  -- Whose little guy he is. A member reference (null = nobody in particular);
  -- `on delete set null` so a departing member doesn't take their guys along.
  owner_id    uuid references auth.users (id) on delete set null,
  -- Free text ("shy", "menace", "extremely tired").
  personality text not null default '',
  description text not null default '',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists little_guys_space_idx on public.little_guys (space_id);

-- ---------------------------------------------------------------------------
-- Music practice: the Bassoon circle-of-fifths daily key tracker. PERSONAL
-- practice state — each row is ONE calendar day's chosen key for ONE person.
-- `position` is the clockwise slot on the circle of fifths (0 = C, 1 = G, …,
-- 11 = F; see CIRCLE in src/features/music-practice/derive.ts). Free picker,
-- no enforced sequence; at most one key per day (upsert on
-- (user_id, practice_date)). Per-person like tier_placements: members read all
-- rows but write only their own (user_id = auth.uid()). Deliberately NOT added
-- to the realtime publication below — solo, rarely-simultaneous use; another
-- device picks it up on the next page load.
-- ---------------------------------------------------------------------------

create table if not exists public.music_practice_days (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- The practice day (the client sends its LOCAL date, not UTC).
  practice_date date not null,
  -- Clockwise position on the circle of fifths, 0 = C.
  position      int not null check (position between 0 and 11),
  -- Optional tempo practiced that day, in BPM (carried forward day-to-day in
  -- the UI as a starting point). Null = no tempo recorded.
  tempo         int check (tempo is null or tempo between 20 and 400),
  created_at    timestamptz not null default now(),
  -- One key per person per day — also the upsert conflict target.
  unique (user_id, practice_date)
);

create index if not exists music_practice_days_space_idx on public.music_practice_days (space_id);

-- ---------------------------------------------------------------------------
-- Membership helper
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it can read space_members without tripping RLS — this
-- avoids the infinite-recursion trap where a space_members policy queries
-- space_members. All data-table policies call this single function.

create or replace function public.is_space_member(target_space uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.space_members m
    where m.space_id = target_space
      and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap: when a user creates a space, make them its first member.
-- SECURITY DEFINER so the insert bypasses the space_members RLS policy.
-- ---------------------------------------------------------------------------

create or replace function public.add_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.space_members (space_id, user_id)
  values (new.id, auth.uid())
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_space_created on public.spaces;
create trigger on_space_created
  after insert on public.spaces
  for each row execute function public.add_creator_as_member();

-- ---------------------------------------------------------------------------
-- Bootstrap: mirror every new auth.users row into public.profiles so the app
-- can resolve a display name for it. SECURITY DEFINER to write across schemas.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users that signed up before this trigger existed.
insert into public.profiles (id, email, display_name)
select id, email, split_part(coalesce(email, ''), '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles read helper: true when the current user shares any space with
-- `other`. SECURITY DEFINER so it can read space_members without tripping RLS.
-- ---------------------------------------------------------------------------

create or replace function public.shares_space_with(other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.space_members me
    join public.space_members them on them.space_id = me.space_id
    where me.user_id = auth.uid()
      and them.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.spaces        enable row level security;
alter table public.space_members enable row level security;
alter table public.categories    enable row level security;
alter table public.activities    enable row level security;
alter table public.entries       enable row level security;
alter table public.profiles      enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.entry_repeats enable row level security;
alter table public.spoons        enable row level security;
alter table public.park_visits   enable row level security;
alter table public.recipes       enable row level security;
alter table public.little_guys   enable row level security;
alter table public.tier_lists       enable row level security;
alter table public.tier_items       enable row level security;
alter table public.tier_placements  enable row level security;
alter table public.tier_item_completions enable row level security;
alter table public.lists            enable row level security;
alter table public.list_items       enable row level security;
alter table public.music_practice_days enable row level security;

-- spaces ---------------------------------------------------------------------
drop policy if exists "members read space" on public.spaces;
create policy "members read space" on public.spaces
  for select using (public.is_space_member(id));

-- Any logged-in user may create a space; the trigger adds them as a member.
drop policy if exists "authenticated create space" on public.spaces;
create policy "authenticated create space" on public.spaces
  for insert with check (auth.uid() is not null);

drop policy if exists "members update space" on public.spaces;
create policy "members update space" on public.spaces
  for update using (public.is_space_member(id)) with check (public.is_space_member(id));

drop policy if exists "members delete space" on public.spaces;
create policy "members delete space" on public.spaces
  for delete using (public.is_space_member(id));

-- space_members --------------------------------------------------------------
-- Members can see co-members and invite others into a space they belong to.
drop policy if exists "members read membership" on public.space_members;
create policy "members read membership" on public.space_members
  for select using (public.is_space_member(space_id));

drop policy if exists "members add members" on public.space_members;
create policy "members add members" on public.space_members
  for insert with check (public.is_space_member(space_id));

-- A user can remove only their OWN membership (leave a space) — not kick a
-- co-member.
drop policy if exists "leave space" on public.space_members;
create policy "leave space" on public.space_members
  for delete using (user_id = auth.uid());

-- profiles -------------------------------------------------------------------
-- You can read your own profile and the profiles of anyone you share a space
-- with (so the dashboard can name who logged each entry). You can edit only
-- your own (e.g. to set a display name).
drop policy if exists "read self or co-members" on public.profiles;
create policy "read self or co-members" on public.profiles
  for select using (id = auth.uid() or public.shares_space_with(id));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- categories / activities / entries ------------------------------------------
-- Same rule for all three: full access iff you belong to the row's space.
drop policy if exists "space members all" on public.categories;
create policy "space members all" on public.categories
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.activities;
create policy "space members all" on public.activities
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.entries;
create policy "space members all" on public.entries
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.wishlist_items;
create policy "space members all" on public.wishlist_items
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.entry_repeats;
create policy "space members all" on public.entry_repeats
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.spoons;
create policy "space members all" on public.spoons
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.park_visits;
create policy "space members all" on public.park_visits
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.recipes;
create policy "space members all" on public.recipes
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

-- Little guys are shared even though each one has an owner: `owner_id` says
-- whose figurine it is, not who may edit the row (either member can fix a typo
-- or re-home a guy).
drop policy if exists "space members all" on public.little_guys;
create policy "space members all" on public.little_guys
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

-- tier lists -------------------------------------------------------------------
-- A space-defined list is shared data like the pool: either member can create,
-- re-word, or delete one (and the delete cascades its items and to-do rows).
drop policy if exists "space members all" on public.tier_lists;
create policy "space members all" on public.tier_lists
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

-- The item pool is shared: any member has full access.
drop policy if exists "space members all" on public.tier_items;
create policy "space members all" on public.tier_items
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

-- Placements are per-person: members read everyone's (the partner's board
-- renders read-only), but each user can write only rows carrying their own
-- user_id. The `with check` on update also blocks reassigning a row's owner.
-- The one exception is a SHARED custom list's board: its null-owner rows are
-- writable by any member of the space (and only for items on such a list).
drop policy if exists "members read placements" on public.tier_placements;
create policy "members read placements" on public.tier_placements
  for select using (public.is_space_member(space_id));

drop policy if exists "insert own placements" on public.tier_placements;
create policy "insert own placements" on public.tier_placements
  for insert with check (
    public.is_space_member(space_id)
    and (user_id = auth.uid() or (user_id is null and public.is_shared_board_item(item_id)))
  );

drop policy if exists "update own placements" on public.tier_placements;
create policy "update own placements" on public.tier_placements
  for update using (
    user_id = auth.uid()
    or (user_id is null and public.is_space_member(space_id) and public.is_shared_board_item(item_id))
  )
  with check (
    public.is_space_member(space_id)
    and (user_id = auth.uid() or (user_id is null and public.is_shared_board_item(item_id)))
  );

drop policy if exists "delete own placements" on public.tier_placements;
create policy "delete own placements" on public.tier_placements
  for delete using (
    user_id = auth.uid()
    or (user_id is null and public.is_space_member(space_id) and public.is_shared_board_item(item_id))
  );

-- Completions are per-person like placements: members read everyone's (the
-- partner's Unread shelf renders from theirs), but write only their own. The
-- policy NAMES still say "reads" — a table rename carries policies along, so
-- renaming them too would mean extra migration statements for no gain.
drop policy if exists "members read reads" on public.tier_item_completions;
create policy "members read reads" on public.tier_item_completions
  for select using (public.is_space_member(space_id));

drop policy if exists "insert own reads" on public.tier_item_completions;
create policy "insert own reads" on public.tier_item_completions
  for insert with check (public.is_space_member(space_id) and user_id = auth.uid());

drop policy if exists "update own reads" on public.tier_item_completions;
create policy "update own reads" on public.tier_item_completions
  for update using (user_id = auth.uid())
  with check (public.is_space_member(space_id) and user_id = auth.uid());

drop policy if exists "delete own reads" on public.tier_item_completions;
create policy "delete own reads" on public.tier_item_completions
  for delete using (user_id = auth.uid());

-- lists ------------------------------------------------------------------------
-- The free-form list rows themselves are shared space data.
drop policy if exists "space members all" on public.lists;
create policy "space members all" on public.lists
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

-- List items: movie/TV and free-form rows are shared (any member writes); book
-- rows are per-person reading-list entries, writable only by their owner
-- (`created_by`, which defaults to auth.uid()). Members still read every row —
-- the shared kinds need it, and realtime delivers one stream per table.
drop policy if exists "space members all" on public.list_items;
drop policy if exists "members read list items" on public.list_items;
create policy "members read list items" on public.list_items
  for select using (public.is_space_member(space_id));

drop policy if exists "insert shared or own list items" on public.list_items;
create policy "insert shared or own list items" on public.list_items
  for insert with check (
    public.is_space_member(space_id)
    and (kind <> 'book' or created_by = auth.uid())
  );

drop policy if exists "update shared or own list items" on public.list_items;
create policy "update shared or own list items" on public.list_items
  for update using (
    public.is_space_member(space_id)
    and (kind <> 'book' or created_by = auth.uid())
  )
  with check (
    public.is_space_member(space_id)
    and (kind <> 'book' or created_by = auth.uid())
  );

drop policy if exists "delete shared or own list items" on public.list_items;
create policy "delete shared or own list items" on public.list_items
  for delete using (
    public.is_space_member(space_id)
    and (kind <> 'book' or created_by = auth.uid())
  );

-- music practice ---------------------------------------------------------------
-- Per-person daily key, same split as tier_placements: members read everyone's
-- rows, but each user writes only rows carrying their own user_id.
drop policy if exists "members read practice days" on public.music_practice_days;
create policy "members read practice days" on public.music_practice_days
  for select using (public.is_space_member(space_id));

drop policy if exists "insert own practice days" on public.music_practice_days;
create policy "insert own practice days" on public.music_practice_days
  for insert with check (public.is_space_member(space_id) and user_id = auth.uid());

drop policy if exists "update own practice days" on public.music_practice_days;
create policy "update own practice days" on public.music_practice_days
  for update using (user_id = auth.uid())
  with check (public.is_space_member(space_id) and user_id = auth.uid());

drop policy if exists "delete own practice days" on public.music_practice_days;
create policy "delete own practice days" on public.music_practice_days
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (needed because "Automatically expose new tables" is OFF).
-- RLS still governs *which rows* — these grants just expose the tables to the
-- logged-in role through the Data API.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.spaces, public.space_members, public.categories, public.activities, public.entries,
  public.wishlist_items, public.entry_repeats, public.tier_lists, public.tier_items, public.tier_placements,
  public.tier_item_completions, public.lists, public.list_items, public.spoons, public.park_visits,
  public.recipes, public.music_practice_days, public.little_guys
  to authenticated;
grant select, update on public.profiles to authenticated;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.shares_space_with(uuid) to authenticated;
grant execute on function public.is_shared_board_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: add the space-scoped tables to the `supabase_realtime` publication
-- so an open tab streams the partner's changes live (the app subscribes via
-- postgres_changes in useActivityStore). INSERT/UPDATE events respect RLS;
-- DELETE events carry only the row's primary key. Guarded because a plain
-- ALTER PUBLICATION ... ADD TABLE errors on re-run.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array
    array['spaces', 'categories', 'activities', 'entries', 'entry_repeats', 'wishlist_items',
          'tier_lists', 'tier_items', 'tier_placements', 'tier_item_completions', 'lists', 'list_items', 'spoons',
          'park_visits', 'recipes', 'little_guys']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: the `spoons` bucket holds spoon photos, uploaded from the browser
-- (downscaled client-side to ~1200px JPEG first — see src/lib/image.ts).
-- PUBLIC bucket: photos render via plain public URLs in <img> tags and map
-- pins with no signed-URL plumbing; the URLs are unguessable (uuid filenames)
-- and it's souvenir spoons. Writes are still locked down: objects live under
-- a `<space_id>/` prefix and the policies below only let members of that
-- space write there. RLS on storage.objects is enabled by Supabase already.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spoons', 'spoons', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload spoon photos" on storage.objects;
create policy "members upload spoon photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'spoons'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "members update spoon photos" on storage.objects;
create policy "members update spoon photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'spoons'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "members delete spoon photos" on storage.objects;
create policy "members delete spoon photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'spoons'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Storage: the `recipes` bucket holds recipe photos — same design as the
-- `spoons` bucket above (public read via unguessable uuid paths, writes
-- locked to the space members of the `<space_id>/` prefix, client downscale
-- before upload).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipes', 'recipes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload recipe photos" on storage.objects;
create policy "members upload recipe photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipes'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "members update recipe photos" on storage.objects;
create policy "members update recipe photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'recipes'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "members delete recipe photos" on storage.objects;
create policy "members delete recipe photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipes'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Storage: the `little-guys` bucket holds little guy photos — same design as
-- the `spoons` and `recipes` buckets above (public read via unguessable uuid
-- paths, writes locked to the space members of the `<space_id>/` prefix,
-- client downscale before upload).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('little-guys', 'little-guys', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload little guy photos" on storage.objects;
create policy "members upload little guy photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'little-guys'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "members update little guy photos" on storage.objects;
create policy "members update little guy photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'little-guys'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "members delete little guy photos" on storage.objects;
create policy "members delete little guy photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'little-guys'
    and public.is_space_member(((storage.foldername(name))[1])::uuid)
  );

-- ============================================================================
-- Optional: seed your own space with the design's starter data. Run this AFTER
-- you've signed up once, replacing nothing — it uses your current auth.uid().
-- ----------------------------------------------------------------------------
-- with new_space as (
--   insert into public.spaces (name) values ('Our city, together') returning id
-- )
-- -- the trigger adds you as a member automatically.
-- insert into public.categories (space_id, name, color_index)
-- select id, c.name, c.ci from new_space,
--   (values ('Outdoor',0),('City',1),('Brain',2)) as c(name, ci);
-- ============================================================================

-- ============================================================================
-- Keepalive — free-tier projects pause after 7 days without API activity.
-- A Cloudflare Worker cron (keepalive-worker/) calls this no-op RPC twice a
-- week as anon. It reads no tables; anon's only grant is executing this.
-- ============================================================================
create or replace function public.keepalive()
returns timestamptz
language sql
stable
as $$ select now() $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
