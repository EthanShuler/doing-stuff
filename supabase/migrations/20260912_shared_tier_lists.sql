-- Shared tier lists (2026-09-12). Run this once in the Supabase SQL Editor —
-- schema.sql already includes the end state for fresh installs.
--
-- A custom tier list can now be SHARED: one board the whole space ranks
-- together instead of a board per member.
--
-- 1. `tier_lists.shared` — the flag (default false; existing lists stay
--    per-person).
-- 2. `tier_placements.user_id` becomes nullable: NULL = the shared board's
--    ranking. The unique (item_id, user_id) constraint is re-created NULLS
--    NOT DISTINCT so the null owner is one owner (one row per item) and the
--    client's upsert ON CONFLICT (item_id, user_id) still infers it.
-- 3. `is_shared_board_item(item_id)` + widened placement policies: any space
--    member may insert/update/delete a null-owner row, but only for an item
--    on a list flagged shared. Personal rows keep the "own rows only" rule.
--
-- Nothing here touches existing rows (220 personal placements at the time
-- of writing). Constraint names were verified against the live project.

begin;

-- 1. The flag ---------------------------------------------------------------------
alter table public.tier_lists
  add column if not exists shared boolean not null default false;

-- 2. Null-owner placements ----------------------------------------------------------
alter table public.tier_placements alter column user_id drop not null;

alter table public.tier_placements drop constraint if exists tier_placements_item_id_user_id_key;
alter table public.tier_placements
  add constraint tier_placements_item_id_user_id_key unique nulls not distinct (item_id, user_id);

-- 3. Who may write them -----------------------------------------------------------------
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
grant execute on function public.is_shared_board_item(uuid) to authenticated;

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

commit;
