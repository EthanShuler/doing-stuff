-- Code-review fixes (2026-07-19). Run this once in the Supabase SQL Editor —
-- schema.sql already includes all of it for fresh installs.
--
-- 1. Every reference to auth.users gets an ON DELETE action, so deleting an
--    account (dashboard or GDPR-style) no longer fails on FK violations:
--    `created_by` attribution columns keep the row and null out; the personal
--    opinion rows (placements, read records) go with their owner.
-- 2. The space_members "leave space" policy loses its `is_space_member()`
--    disjunct, which let either member delete the OTHER's membership row.
-- 3. Indexes on FK columns walked by cascades/set-null and membership lookups.

begin;

-- 1a. created_by → on delete set null -----------------------------------------
alter table public.entries
  drop constraint entries_created_by_fkey,
  add constraint entries_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table public.wishlist_items
  drop constraint wishlist_items_created_by_fkey,
  add constraint wishlist_items_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table public.entry_repeats
  drop constraint entry_repeats_created_by_fkey,
  add constraint entry_repeats_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table public.tier_items
  drop constraint tier_items_created_by_fkey,
  add constraint tier_items_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table public.watchlist_items
  drop constraint watchlist_items_created_by_fkey,
  add constraint watchlist_items_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table public.spoons
  drop constraint spoons_created_by_fkey,
  add constraint spoons_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table public.park_visits
  drop constraint park_visits_created_by_fkey,
  add constraint park_visits_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table public.recipes
  drop constraint recipes_created_by_fkey,
  add constraint recipes_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

-- 1b. personal user_id rows → on delete cascade -------------------------------
alter table public.tier_placements
  drop constraint tier_placements_user_id_fkey,
  add constraint tier_placements_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.tier_item_reads
  drop constraint tier_item_reads_user_id_fkey,
  add constraint tier_item_reads_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

-- 2. Leave-space policy: only your own membership row -------------------------
drop policy if exists "leave space" on public.space_members;
create policy "leave space" on public.space_members
  for delete using (user_id = auth.uid());

-- 3. FK / lookup indexes -------------------------------------------------------
create index if not exists space_members_user_idx on public.space_members (user_id);
create index if not exists activities_category_idx on public.activities (category_id);
create index if not exists wishlist_entry_idx on public.wishlist_items (entry_id);
create index if not exists watchlist_items_tier_item_idx on public.watchlist_items (tier_item_id);

commit;

-- If a drop constraint errors on the name, list the real one with:
--   select conname from pg_constraint where conrelid = 'public.<table>'::regclass;
