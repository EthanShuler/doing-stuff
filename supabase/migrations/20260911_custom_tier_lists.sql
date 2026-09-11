-- Custom tier lists (2026-09-11). Run this once in the Supabase SQL Editor —
-- schema.sql already includes all of it for fresh installs.
--
-- 1. Generalize the per-person date table: `tier_item_reads` was book-specific
--    in name only (its shape is "one member's personal done-date for a shared
--    item"), and `tier_items.watched_on` already doubled as ice cream's tried
--    marker. Both sides become `done_on` so they read in parallel. A rename
--    keeps the rows, constraints, RLS policies (their names are unchanged) and
--    the table's `supabase_realtime` membership, which follows the OID.
-- 2. `tier_lists`: space-defined boards ("Bugs", "Fruits"). Shared space data
--    with the uniform member policy.
-- 3. `tier_items` / `watchlist_items` gain `kind = 'custom'` + a `list_id` FK,
--    so deleting a list is one statement and Postgres cascades the items
--    (and with them every member's placements and completions) plus the
--    list's to-do rows. The book reading-list RLS is untouched: custom rows
--    are 'custom', never 'book'.

begin;

-- 1. Rename the done-date columns/table ---------------------------------------
alter table public.tier_item_reads rename to tier_item_completions;
alter table public.tier_item_completions rename column read_on to done_on;
alter index if exists tier_item_reads_space_idx rename to tier_item_completions_space_idx;
alter index if exists tier_item_reads_item_idx rename to tier_item_completions_item_idx;
alter table public.tier_items rename column watched_on to done_on;

-- 2. The lists themselves ------------------------------------------------------
create table if not exists public.tier_lists (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  name        text not null,
  emoji       text not null default '',
  noun        text not null,
  verb        text not null default 'try',
  past        text not null default 'tried',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists tier_lists_space_idx on public.tier_lists (space_id);
alter table public.tier_lists enable row level security;
drop policy if exists "space members all" on public.tier_lists;
create policy "space members all" on public.tier_lists
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
grant select, insert, update, delete on public.tier_lists to authenticated;

-- 3. Items and to-do rows can belong to a list ---------------------------------
alter table public.tier_items add column if not exists list_id uuid references public.tier_lists (id) on delete cascade;
alter table public.tier_items drop constraint if exists tier_items_kind_check;
alter table public.tier_items add constraint tier_items_kind_check
  check (kind in ('movie', 'tv', 'book', 'ice-cream', 'custom'));
alter table public.tier_items drop constraint if exists tier_items_list_kind_check;
alter table public.tier_items add constraint tier_items_list_kind_check
  check ((kind = 'custom') = (list_id is not null));
create index if not exists tier_items_list_idx on public.tier_items (list_id);

alter table public.watchlist_items add column if not exists list_id uuid references public.tier_lists (id) on delete cascade;
alter table public.watchlist_items drop constraint if exists watchlist_items_kind_check;
alter table public.watchlist_items add constraint watchlist_items_kind_check
  check (kind in ('movie', 'tv', 'book', 'ice-cream', 'custom'));
alter table public.watchlist_items drop constraint if exists watchlist_items_list_kind_check;
alter table public.watchlist_items add constraint watchlist_items_list_kind_check
  check ((kind = 'custom') = (list_id is not null));
create index if not exists watchlist_items_list_idx on public.watchlist_items (list_id);

commit;

-- Realtime last: ALTER PUBLICATION can't run inside the transaction above on
-- every Postgres version, and it's guarded so re-running is harmless.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tier_lists'
  ) then
    alter publication supabase_realtime add table public.tier_lists;
  end if;
end $$;
