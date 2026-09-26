-- Personal tier-list tags (2026-09-26). Run this once in the Supabase SQL
-- Editor — schema.sql already includes the end state for fresh installs.
--
-- The existing `tier_items.tags` become the SHARED tags; this adds each
-- member's OWN tags per item. Same split RLS as tier_item_completions
-- (members read all, write only their own). Nothing touches existing rows.

begin;

create table if not exists public.tier_item_user_tags (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  item_id     uuid not null references public.tier_items (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  -- One tag row per person per item — also the upsert conflict target.
  unique (item_id, user_id)
);

create index if not exists tier_item_user_tags_space_idx on public.tier_item_user_tags (space_id);
create index if not exists tier_item_user_tags_item_idx  on public.tier_item_user_tags (item_id);

alter table public.tier_item_user_tags enable row level security;

drop policy if exists "members read user tags" on public.tier_item_user_tags;
create policy "members read user tags" on public.tier_item_user_tags
  for select using (public.is_space_member(space_id));

drop policy if exists "insert own user tags" on public.tier_item_user_tags;
create policy "insert own user tags" on public.tier_item_user_tags
  for insert with check (public.is_space_member(space_id) and user_id = auth.uid());

drop policy if exists "update own user tags" on public.tier_item_user_tags;
create policy "update own user tags" on public.tier_item_user_tags
  for update using (user_id = auth.uid())
  with check (public.is_space_member(space_id) and user_id = auth.uid());

drop policy if exists "delete own user tags" on public.tier_item_user_tags;
create policy "delete own user tags" on public.tier_item_user_tags
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.tier_item_user_tags to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tier_item_user_tags'
  ) then
    alter publication supabase_realtime add table public.tier_item_user_tags;
  end if;
end $$;

commit;
