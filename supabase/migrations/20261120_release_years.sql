-- Release years (2026-11-20). Run this once in the Supabase SQL Editor (or via
-- the connector's apply_migration) — schema.sql already includes the end
-- state for fresh installs.
--
-- A shared `release_year` on movie / TV / book / game rows, on both the tier
-- pool and the want-to lists (a list row carries it onto the tier item when
-- checked off, like the image and creator). Year only — the title searches
-- (TMDB, Open Library, IGDB) fill it on a pick. Null = unknown; custom boards
-- and free-form lists leave it null.
--
-- Safe to apply before the client ships: the old client never selects or
-- writes the column.

begin;

alter table public.tier_items add column if not exists release_year integer
  constraint tier_items_release_year_check check (release_year between 1000 and 9999);

alter table public.list_items add column if not exists release_year integer
  constraint list_items_release_year_check check (release_year between 1000 and 9999);

commit;
