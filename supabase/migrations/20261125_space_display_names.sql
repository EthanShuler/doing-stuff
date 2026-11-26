-- Per-space display names (2026-11-25). Run this once in the Supabase SQL
-- Editor (or via the connector's apply_migration) — schema.sql already
-- includes the end state for fresh installs.
--
-- A person can go by a different name in each space: a nullable
-- `display_name` on their `space_members` row. Null = use their one
-- `profiles.display_name` (which stays the default everywhere). Members
-- already SELECT the table, so the feature stores read it with the
-- membership; only the admin writes it, through
-- admin_set_space_display_name. admin_list_space_names feeds the admin page.
-- admin_save_space / admin_set_user_spaces keep the rows of people who stay,
-- so a name survives a membership save; removing someone from a space drops
-- their name there with the row.
--
-- Safe to apply before the client ships: the old client never selects or
-- writes the column.

begin;

alter table public.space_members add column if not exists display_name text;

create or replace function public.admin_list_space_names()
returns table (space_id uuid, user_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
    select m.space_id, m.user_id, m.display_name
      from public.space_members m
     where m.display_name is not null;
end;
$$;

create or replace function public.admin_set_space_display_name(
  target_space uuid, target_user uuid, new_name text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  update public.space_members m
     set display_name = nullif(btrim(new_name), '')
   where m.space_id = target_space and m.user_id = target_user;
  if not found then
    raise exception 'They are not in that space.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_list_space_names()                        from public, anon;
revoke execute on function public.admin_set_space_display_name(uuid, uuid, text)  from public, anon;
grant execute on function public.admin_list_space_names()                         to authenticated;
grant execute on function public.admin_set_space_display_name(uuid, uuid, text)   to authenticated;

commit;
