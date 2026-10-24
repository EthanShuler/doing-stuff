-- Meal plan (2026-10-24). Run this once in the Supabase SQL Editor —
-- schema.sql already includes the end state for fresh installs.
--
-- The Recipes feature's weekly dinner planner. A `meal_plan_days` row is one
-- planned dinner, at most one per day per space: a recipe, free text, or
-- leftovers of an earlier day. `groceries_sent` remembers which of the
-- recipe's ingredient lines the grocery step already put on the Groceries
-- list, so re-running it only offers what's new. `grocery_staples` is the
-- pantry list ("salt", "olive oil") whose matching ingredient lines start
-- unchecked. Both are shared space data with the uniform member policy.
-- Nothing touches existing rows.

begin;

create table if not exists public.meal_plan_days (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references public.spaces (id) on delete cascade,
  day             date not null,
  kind            text not null check (kind in ('recipe', 'text', 'leftovers')),
  -- kind = 'recipe'. ON DELETE SET NULL: a deleted recipe leaves the day
  -- planned but unnamed rather than silently emptying it.
  recipe_id       uuid references public.recipes (id) on delete set null,
  -- kind = 'text': the free-text dinner ("Pizza night").
  text            text not null default '',
  -- kind = 'leftovers': the earlier day whose cook this eats.
  leftovers_of    uuid references public.meal_plan_days (id) on delete set null,
  -- Ingredient lines (by text) already sent to the Groceries list.
  groceries_sent  text[] not null default '{}',
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  constraint meal_plan_days_space_day_key unique (space_id, day)
);

create index if not exists meal_plan_days_recipe_idx on public.meal_plan_days (recipe_id);
create index if not exists meal_plan_days_leftovers_idx on public.meal_plan_days (leftovers_of);

create table if not exists public.grocery_staples (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  -- As typed: "olive oil". Matched as whole words, case-insensitively.
  name        text not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists grocery_staples_space_name_key on public.grocery_staples (space_id, lower(name));

alter table public.meal_plan_days enable row level security;
alter table public.grocery_staples enable row level security;

drop policy if exists "space members all" on public.meal_plan_days;
create policy "space members all" on public.meal_plan_days
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

drop policy if exists "space members all" on public.grocery_staples;
create policy "space members all" on public.grocery_staples
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

grant select, insert, update, delete on public.meal_plan_days, public.grocery_staples to authenticated;

commit;

-- Realtime last: guarded so re-running is harmless.
do $$
declare
  t text;
begin
  foreach t in array array['meal_plan_days', 'grocery_staples']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
