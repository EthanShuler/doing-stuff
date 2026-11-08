-- Recipe grocery lists (2026-11-08). Run this once in the Supabase SQL Editor —
-- schema.sql already includes the end state for fresh installs.
--
-- Each recipe gets an optional shopping-list version of its ingredients:
-- `grocery_list` is one item per line with the prep stripped ("onion", not
-- "1 onion, finely diced"), and `staple_items` names the lines (by text) that
-- are pantry staples, so the meal plan's grocery step starts them unticked.
-- Only the edit modal shows these; the meal plan reads them instead of the
-- ingredient lines when the list isn't blank. Existing rows default to empty,
-- so nothing changes until a list is filled in.

alter table public.recipes
  add column if not exists grocery_list text not null default '',
  add column if not exists staple_items text[] not null default '{}';
