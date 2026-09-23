-- Lock down membership + finish the 2026-07-19 FK fixes (2026-09-23). Run this
-- once in the Supabase SQL Editor — schema.sql already includes all of it for
-- fresh installs.
--
-- 1. Finish part 1 of 20260719_code_review_fixes.sql, which never fully landed:
--    nine auth.users FKs still had no ON DELETE action, so deleting an account
--    failed. (tier_item_completions still carries its pre-rename constraint
--    name, tier_item_reads_user_id_fkey — renamed here.)
-- 2. Drop "members add members": it let any member insert ANY user into a
--    space they own, and sign-up is open — a stranger could pull you into
--    their space. Sharing is SQL-Editor-only by design; the editor runs as
--    postgres and bypasses RLS, and the on_space_created trigger is SECURITY
--    DEFINER, so neither needs this policy.
-- 3. Drop "members delete space": the app never deletes a space, and one call
--    from either member (or a stolen session) would cascade away everything.
-- 4. Revoke the default PUBLIC execute on the helper/trigger functions, so
--    anon can't call them. keepalive() keeps its deliberate anon grant.

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

alter table public.tier_item_completions
  drop constraint tier_item_reads_user_id_fkey,
  add constraint tier_item_completions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

-- 2 + 3. Membership and space-delete policies ---------------------------------
drop policy if exists "members add members" on public.space_members;
drop policy if exists "members delete space" on public.spaces;

-- 4. Function execute grants --------------------------------------------------
revoke execute on function public.is_space_member(uuid)      from public, anon;
revoke execute on function public.shares_space_with(uuid)    from public, anon;
revoke execute on function public.is_shared_board_item(uuid) from public, anon;
revoke execute on function public.add_creator_as_member()    from public, anon;
revoke execute on function public.handle_new_user()          from public, anon;
grant execute on function public.is_space_member(uuid)      to authenticated;
grant execute on function public.shares_space_with(uuid)    to authenticated;
grant execute on function public.is_shared_board_item(uuid) to authenticated;

commit;

-- Sanity check afterwards — no row should have confdeltype = 'a' (no action);
-- expect only 'c' (cascade) and 'n' (set null):
--   select conrelid::regclass, conname, confdeltype from pg_constraint
--   where contype = 'f' and confrelid = 'auth.users'::regclass;
