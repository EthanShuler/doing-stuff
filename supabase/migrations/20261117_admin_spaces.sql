-- Admin + multi-space groundwork (2026-11-17). Run this once in the Supabase
-- SQL Editor — schema.sql already includes the end state for fresh installs.
-- Safe to apply while the previous client is still deployed: it writes only
-- the home_* columns on `spaces`, selects explicit columns, and never writes
-- `profiles` or `space_members`. One exception: a login with NO membership
-- would now hit an error splash (its auto-create-a-space insert is refused),
-- so create no accounts and remove no one's last membership until the
-- space-model client ships.
--
-- 1. `app_admins` (RLS on, no policies, no grants) + `is_admin()`. The one
--    admin is seeded by hand (bottom of this file).
-- 2. `spaces.enabled_features text[]` — the per-space feature allow-list.
--    Existing rows stay NULL (= every feature, future ones included).
-- 3. Spaces and membership become admin-managed: drop the "authenticated
--    create space" and "leave space" policies and the on_space_created
--    trigger with its function. Members keep SELECT on both tables, plus
--    UPDATE on the three home_* columns of `spaces` only.
-- 4. `profiles`: self-update narrowed to `display_name`; `handle_new_user`
--    prefers a `display_name` passed as user metadata at creation.
-- 5. Admin RPCs (SECURITY DEFINER, each opens with an is_admin() check). RPCs
--    rather than `or is_admin()` in RLS, so the admin's own feature pages
--    never see other spaces' people or data.
-- 6. `copied_from uuid` on tier_items / tier_lists / recipes — the lineage
--    a cross-space pull matches on.
-- 7. Music practice is per person: its SELECT policy also admits your own
--    rows, whichever space they were logged in.

begin;

-- 1. Admins ------------------------------------------------------------------
-- Seeded by hand (bottom of this file). RLS on, no policies, no grants: the
-- Data API can't see it; only is_admin() and the SQL Editor can.
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  );
$$;

-- 2. Per-space feature allow-list ---------------------------------------------
-- NULL = every feature, future ones included (the home space). An array is an
-- allow-list. Added WITHOUT a default so existing spaces stay NULL; the default
-- set afterwards only applies to rows created from now on.
alter table public.spaces add column if not exists enabled_features text[];
alter table public.spaces alter column enabled_features set default '{}';

-- 3. Spaces and membership become admin-managed -------------------------------
drop policy if exists "authenticated create space" on public.spaces;
drop policy if exists "leave space" on public.space_members;
drop trigger if exists on_space_created on public.spaces;
drop function if exists public.add_creator_as_member();

-- Members keep SELECT, and UPDATE on the home columns only. (Revoking the
-- table-level UPDATE also drops any column grants, so the grant comes after.)
revoke insert, update, delete on public.spaces from authenticated;
grant update (home_address, home_lat, home_lng) on public.spaces to authenticated;
revoke insert, update, delete on public.space_members from authenticated;

-- 4. Profiles -----------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- A display name passed as user_metadata at creation wins over the email's
-- local part. (Display only — never use user_metadata for authorization.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- 5. Admin RPCs ---------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, display_name text, created_at timestamptz,
  last_sign_in_at timestamptz, has_password boolean, is_admin_user boolean,
  space_ids uuid[]
)
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
    select
      u.id,
      u.email::text,
      p.display_name,
      u.created_at,
      u.last_sign_in_at,
      coalesce(u.encrypted_password, '') <> '',
      exists (select 1 from public.app_admins a where a.user_id = u.id),
      coalesce(
        (select array_agg(m.space_id order by m.created_at)
           from public.space_members m where m.user_id = u.id),
        '{}'::uuid[])
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at;
end;
$$;

create or replace function public.admin_list_spaces()
returns table (
  id uuid, name text, enabled_features text[], created_at timestamptz, member_ids uuid[]
)
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
    select
      s.id, s.name, s.enabled_features, s.created_at,
      coalesce(
        (select array_agg(m.user_id order by m.created_at)
           from public.space_members m where m.space_id = s.id),
        '{}'::uuid[])
    from public.spaces s
    order by s.created_at;
end;
$$;

-- Create (target_space null) or update a space, and set its membership to
-- EXACTLY member_ids. features: null = all features, array = allow-list.
create or replace function public.admin_save_space(
  target_space uuid, space_name text, features text[], member_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid := target_space;
  ids uuid[] := coalesce(member_ids, '{}'::uuid[]);
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if nullif(btrim(space_name), '') is null then
    raise exception 'A space needs a name.' using errcode = '22023';
  end if;

  if sid is null then
    sid := gen_random_uuid();
    insert into public.spaces (id, name, enabled_features)
    values (sid, btrim(space_name), features);
  else
    update public.spaces s
       set name = btrim(space_name), enabled_features = features
     where s.id = sid;
    if not found then
      raise exception 'No such space.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.space_members m
   where m.space_id = sid and not (m.user_id = any (ids));
  insert into public.space_members (space_id, user_id)
  select sid, u from unnest(ids) as u
  on conflict do nothing;

  return sid;
end;
$$;

-- Set one user's memberships to EXACTLY space_ids (People tab, and step two
-- of creating an account).
create or replace function public.admin_set_user_spaces(target_user uuid, space_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := coalesce(space_ids, '{}'::uuid[]);
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  delete from public.space_members m
   where m.user_id = target_user and not (m.space_id = any (ids));
  insert into public.space_members (space_id, user_id)
  select s, target_user from unnest(ids) as s
  on conflict do nothing;
end;
$$;

create or replace function public.admin_set_display_name(target_user uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  update public.profiles p
     set display_name = nullif(btrim(new_name), '')
   where p.id = target_user;
  if not found then
    raise exception 'No such user.' using errcode = 'P0002';
  end if;
end;
$$;

-- 6. Pull lineage -------------------------------------------------------------
-- The ROOT row a copy descends from, in whichever space. No FK on purpose: the
-- origin may be deleted or live in a space this row's readers can't see.
alter table public.tier_items add column if not exists copied_from uuid;
alter table public.tier_lists add column if not exists copied_from uuid;
alter table public.recipes    add column if not exists copied_from uuid;

-- 7. Music practice is per person, not per space ------------------------------
drop policy if exists "members read practice days" on public.music_practice_days;
create policy "members read practice days" on public.music_practice_days
  for select using (public.is_space_member(space_id) or user_id = (select auth.uid()));

-- 8. Function grants (same pattern as the other helpers) ----------------------
revoke execute on function public.is_admin()                                   from public, anon;
revoke execute on function public.admin_list_users()                           from public, anon;
revoke execute on function public.admin_list_spaces()                          from public, anon;
revoke execute on function public.admin_save_space(uuid, text, text[], uuid[]) from public, anon;
revoke execute on function public.admin_set_user_spaces(uuid, uuid[])          from public, anon;
revoke execute on function public.admin_set_display_name(uuid, text)           from public, anon;
revoke execute on function public.handle_new_user()                            from public, anon;
grant execute on function public.is_admin()                                    to authenticated;
grant execute on function public.admin_list_users()                            to authenticated;
grant execute on function public.admin_list_spaces()                           to authenticated;
grant execute on function public.admin_save_space(uuid, text, text[], uuid[])  to authenticated;
grant execute on function public.admin_set_user_spaces(uuid, uuid[])           to authenticated;
grant execute on function public.admin_set_display_name(uuid, text)            to authenticated;

commit;

-- Seed the one admin (by hand, once):
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = '<owner email>'
--   on conflict do nothing;
--
-- Sanity checks — expect UPDATE on spaces only for the three home_* columns,
-- on profiles only for display_name, and nothing at all on app_admins:
--   select table_name, column_name from information_schema.column_privileges
--   where table_schema = 'public' and grantee = 'authenticated'
--     and privilege_type = 'UPDATE' and table_name in ('spaces', 'profiles');
--   select table_name, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon', 'authenticated')
--     and table_name in ('spaces', 'space_members', 'app_admins');
