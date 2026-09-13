-- Ice cream becomes a space-defined list (2026-09-13). Run this once in the
-- Supabase SQL Editor — schema.sql already includes the end state for fresh
-- installs.
--
-- Only movies, TV and books stay built-in tier boards: each has a title-search
-- provider (TMDB / Open Library) and a want-to list in the Lists feature. Ice
-- cream had neither — it was just the template custom lists copy — so it
-- becomes one of them:
--
-- 1. For every space with ice-cream items, insert an "Ice Cream" `tier_lists`
--    row (🍦 / flavor / tried, per-person rankings), dated to the space's
--    first flavor so it keeps its place ahead of newer lists in the picker.
-- 2. Re-point those items at it: kind 'custom' + list_id. Placements and
--    completions hang off the item id, so rankings are untouched.
-- 3. Drop 'ice-cream' from the `tier_items.kind` CHECK.
--
-- Safe in either deploy order: the current app already renders custom lists,
-- and the new app simply can't route to 'ice-cream' rows until they're moved.
-- Constraint name verified against the live project.

begin;

with spaces_with_ice_cream as (
  select space_id, min(created_at) as first_flavor_at
  from public.tier_items
  where kind = 'ice-cream'
  group by space_id
),
new_lists as (
  insert into public.tier_lists (space_id, name, emoji, noun, past, shared, created_at)
  select space_id, 'Ice Cream', '🍦', 'flavor', 'tried', false, first_flavor_at
  from spaces_with_ice_cream
  returning id, space_id
)
update public.tier_items i
set kind = 'custom', list_id = l.id
from new_lists l
where i.space_id = l.space_id
  and i.kind = 'ice-cream';

alter table public.tier_items drop constraint if exists tier_items_kind_check;
alter table public.tier_items
  add constraint tier_items_kind_check check (kind in ('movie', 'tv', 'book', 'custom'));

commit;
