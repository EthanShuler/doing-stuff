-- Seasons (2026-09-26). Run this once in the Supabase SQL Editor —
-- schema.sql already includes the end state for fresh installs.
--
-- The seasonal bucket list: a `seasons` row is one season ("Fall 2026", a
-- date range) and `season_items` are the things we want to do in it, grouped
-- by free-text section / subsection, optionally nested one level (a
-- sub-option like "Sweetland" under "apple orchard"), and planned onto a day.
-- Both tables are shared space data with the uniform member policy. Nothing
-- touches existing rows.

begin;

create table if not exists public.seasons (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  -- Display name, as typed: "Fall 2026".
  name        text not null,
  -- Single emoji for the picker pill.
  emoji       text not null default '🍂',
  -- The season's date range (inclusive); the planner shows its weekends.
  starts_on   date not null,
  ends_on     date not null,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists seasons_space_idx on public.seasons (space_id);

create table if not exists public.season_items (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  -- Deleting a season takes its items with it.
  season_id   uuid not null references public.seasons (id) on delete cascade,
  -- null = top-level. ONE level of nesting only (enforced app-side): a
  -- sub-option under its parent. Deleting the parent takes its children.
  parent_id   uuid references public.season_items (id) on delete cascade,
  -- Free-text grouping: "Food" › "Baked goods". '' subsection = none.
  section     text not null,
  subsection  text not null default '',
  title       text not null,
  note        text not null default '',
  url         text not null default '',
  -- Fractional order within the season (midpoint insertion, src/lib/order.ts).
  position    double precision not null,
  -- The event has a set date: the item sits on that day, not re-plannable.
  fixed_on    date,
  -- "Do it before" deadline.
  by_on       date,
  -- The day we plan to do it (one per item — duplicate to do it twice).
  planned_on  date,
  -- Set = done, on this day.
  done_on     date,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists season_items_space_idx  on public.season_items (space_id);
create index if not exists season_items_season_idx on public.season_items (season_id);
create index if not exists season_items_parent_idx on public.season_items (parent_id);

alter table public.seasons      enable row level security;
alter table public.season_items enable row level security;

drop policy if exists "space members all" on public.seasons;
create policy "space members all" on public.seasons
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.season_items;
create policy "space members all" on public.season_items
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

grant select, insert, update, delete on public.seasons, public.season_items to authenticated;

commit;

-- Realtime last: guarded so re-running is harmless.
do $$
declare
  t text;
begin
  foreach t in array array['seasons', 'season_items']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
