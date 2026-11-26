-- Recipe shelves (2026-11-25). Run this once in the Supabase SQL Editor (or
-- via the connector's apply_migration) — schema.sql already includes the end
-- state for fresh installs.
--
-- One shared `shelf` per recipe: 'pinned' (first on the cookbook index),
-- '' (normal), or 'hidden' (in a collapsed drawer at the bottom — still
-- searchable, still offered by the meal plan). Set from the recipe page as a
-- one-column UPDATE.
--
-- Safe to apply before the client ships: the old client never selects or
-- writes the column.

begin;

alter table public.recipes add column if not exists shelf text not null default ''
  constraint recipes_shelf_check check (shelf in ('', 'pinned', 'hidden'));

commit;
