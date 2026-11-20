-- Video Games board (2026-11-20). Run this once in the Supabase SQL Editor
-- (or via the connector's apply_migration) — schema.sql already includes the
-- end state for fresh installs.
--
-- A fourth built-in tier board, kind 'game' (route /games). Played dates are
-- per person, exactly like books: they live in `tier_item_completions`, which
-- already accepts any item, so the only DB change is admitting the new kind.
-- No want-to list: `list_items` keeps its four kinds.
--
-- Safe to apply before the client ships: the old client never writes 'game'.
-- Title search goes through the new `igdb` Edge Function
-- (supabase/functions/igdb/), deployed separately with its two Twitch secrets.

begin;

alter table public.tier_items drop constraint if exists tier_items_kind_check;
alter table public.tier_items
  add constraint tier_items_kind_check check (kind in ('movie', 'tv', 'book', 'game', 'custom'));

commit;
