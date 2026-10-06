-- Recipe cross-offs (2026-10-06). Run this once in the Supabase SQL Editor —
-- schema.sql already includes the end state for fresh installs.
--
-- The detail page's tap-to-cross-off marks (ingredients in the bowl, steps
-- done) move from ephemeral component state onto the recipe row, so they
-- persist and stream to the partner over the existing `recipes` realtime
-- subscription. Existing rows start with nothing checked.

begin;

alter table public.recipes
  add column if not exists crossed_ingredients int[] not null default '{}',
  add column if not exists done_steps          int[] not null default '{}';

-- One tap = add/remove ONE index, atomically in SQL, so two people tapping
-- at once can't clobber each other's marks the way a whole-array write
-- would. SECURITY INVOKER: the recipes RLS still decides who may update.
create or replace function public.set_recipe_mark(
  target_recipe uuid, target_list text, target_index int, is_marked boolean
) returns void
language sql security invoker set search_path = '' as $$
  update public.recipes set
    crossed_ingredients = case
      when target_list <> 'ingredients' then crossed_ingredients
      when is_marked then array_append(array_remove(crossed_ingredients, target_index), target_index)
      else array_remove(crossed_ingredients, target_index)
    end,
    done_steps = case
      when target_list <> 'steps' then done_steps
      when is_marked then array_append(array_remove(done_steps, target_index), target_index)
      else array_remove(done_steps, target_index)
    end
  where id = target_recipe;
$$;

revoke execute on function public.set_recipe_mark(uuid, text, int, boolean) from public, anon;
grant execute on function public.set_recipe_mark(uuid, text, int, boolean) to authenticated;

commit;
