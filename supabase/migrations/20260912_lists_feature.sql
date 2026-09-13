-- Lists feature (2026-09-12). Run this once in the Supabase SQL Editor —
-- schema.sql already includes the end state for fresh installs.
--
-- The want-to lists leave the tier boards and become their own feature:
--
-- 1. `lists`: free-form space lists ("Groceries") — shared space data with the
--    uniform member policy. Movie / TV / book lists need no row here; they're
--    built in.
-- 2. `watchlist_items` → `list_items`. The movie/TV/book rows carry over
--    untouched (a table rename keeps rows, grants, RLS, indexes and the
--    `supabase_realtime` membership — all follow the table OID). Ice-cream and
--    custom-tier-board to-do rows are dropped: tier boards are tiers-only now.
--    `list_id` re-points at `lists`; `done_on` marks a free-form row done
--    (media rows still mark done via `tier_item_id`, which the Lists check-off
--    keeps writing exactly as before).
-- 3. `tier_lists.verb` is unused now that boards have no to-<verb> list.
--
-- Constraint and index names below were verified against the live project
-- (they're Postgres's auto-generated names from schema.sql).

begin;

-- 1. Free-form lists -----------------------------------------------------------
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  -- Display name, as typed: "Groceries".
  name        text not null,
  -- Single emoji for the picker pill ('' = 🏷️).
  emoji       text not null default '',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists lists_space_idx on public.lists (space_id);
alter table public.lists enable row level security;
drop policy if exists "space members all" on public.lists;
create policy "space members all" on public.lists
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
grant select, insert, update, delete on public.lists to authenticated;

-- 2. watchlist_items → list_items --------------------------------------------------
delete from public.watchlist_items where kind in ('ice-cream', 'custom');

alter table public.watchlist_items drop constraint if exists watchlist_items_list_id_fkey;
alter table public.watchlist_items drop constraint if exists watchlist_items_kind_check;
-- The live FK lacked the `on delete set null` schema.sql declares; re-create it.
alter table public.watchlist_items drop constraint if exists watchlist_items_created_by_fkey;

alter table public.watchlist_items rename to list_items;

alter table public.list_items
  add constraint list_items_list_id_fkey
    foreign key (list_id) references public.lists (id) on delete cascade,
  add constraint list_items_kind_check
    check (kind in ('movie', 'tv', 'book', 'custom')),
  add constraint list_items_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null,
  -- Free-form rows: set = done. Media rows leave it null and use tier_item_id.
  add column if not exists done_on date;

alter table public.list_items rename constraint watchlist_items_pkey to list_items_pkey;
alter table public.list_items rename constraint watchlist_items_space_id_fkey to list_items_space_id_fkey;
alter table public.list_items rename constraint watchlist_items_tier_item_id_fkey to list_items_tier_item_id_fkey;
alter table public.list_items rename constraint watchlist_items_list_kind_check to list_items_list_kind_check;

alter index if exists watchlist_items_space_idx     rename to list_items_space_idx;
alter index if exists watchlist_items_tier_item_idx rename to list_items_tier_item_idx;
alter index if exists watchlist_items_list_idx      rename to list_items_list_idx;

-- Same predicates as before — members read everything; book rows (the
-- per-person reading list) are writable only by their owner.
drop policy if exists "members read watchlist" on public.list_items;
drop policy if exists "insert shared or own watchlist" on public.list_items;
drop policy if exists "update shared or own watchlist" on public.list_items;
drop policy if exists "delete shared or own watchlist" on public.list_items;

create policy "members read list items" on public.list_items
  for select using (public.is_space_member(space_id));
create policy "insert shared or own list items" on public.list_items
  for insert with check (public.is_space_member(space_id) and (kind <> 'book' or created_by = auth.uid()));
create policy "update shared or own list items" on public.list_items
  for update using (public.is_space_member(space_id) and (kind <> 'book' or created_by = auth.uid()))
  with check (public.is_space_member(space_id) and (kind <> 'book' or created_by = auth.uid()));
create policy "delete shared or own list items" on public.list_items
  for delete using (public.is_space_member(space_id) and (kind <> 'book' or created_by = auth.uid()));

-- 3. tier boards have no to-<verb> list anymore ------------------------------------
alter table public.tier_lists drop column if exists verb;

commit;

-- Realtime last: ALTER PUBLICATION can't run inside the transaction above on
-- every Postgres version, and it's guarded so re-running is harmless.
-- `list_items` keeps its membership through the rename; only `lists` is new.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lists'
  ) then
    alter publication supabase_realtime add table public.lists;
  end if;
end $$;
