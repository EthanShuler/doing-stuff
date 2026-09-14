-- Custom tier lists lose their "Not <past>" shelf (2026-09-13). Run this once
-- in the Supabase SQL Editor — schema.sql already reflects the end state for
-- fresh installs.
--
-- A custom board ("Ice Cream", "Fruits") tracked no date the UI ever showed:
-- `tier_items.done_on` was only a tried/not-tried marker, and its whole job
-- was to split unplaced items between the Unranked shelf and a second
-- "Not <past>" one. That split is gone — an item on a custom board is now
-- either ranked or Unranked — so the `past` word has nothing left to name.
--
-- Nothing else reads the column: the app already stopped selecting and writing
-- it, so running this at any time after the deploy is safe (and running it
-- before the deploy would break the old build's list queries — deploy first).
--
-- `tier_items.done_on` itself stays: movies and TV still use it as the shared
-- watched date. On custom-list rows it's simply ignored from here on.

alter table public.tier_lists drop column if exists past;
