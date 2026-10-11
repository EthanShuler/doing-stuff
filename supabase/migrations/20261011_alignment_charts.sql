-- Alignment charts (2026-10-11). Run this once in the Supabase SQL Editor —
-- schema.sql already includes the end state for fresh installs.
--
-- Any number of D&D-style 3×3 alignment charts. A row is one chart: a title
-- plus the text in each of the nine FIXED squares, one column per square —
-- so filling in one square is a one-column UPDATE that can't clobber the
-- partner's edit of another. Shared space data with the uniform member
-- policy. Nothing touches existing rows.

begin;

create table if not exists public.alignment_charts (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null references public.spaces (id) on delete cascade,
  -- Display name, as typed: "Sandwiches".
  title            text not null,
  -- The nine squares. '' = not filled in yet.
  lawful_good      text not null default '',
  neutral_good     text not null default '',
  chaotic_good     text not null default '',
  lawful_neutral   text not null default '',
  true_neutral     text not null default '',
  chaotic_neutral  text not null default '',
  lawful_evil      text not null default '',
  neutral_evil     text not null default '',
  chaotic_evil     text not null default '',
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);

create index if not exists alignment_charts_space_idx on public.alignment_charts (space_id);

alter table public.alignment_charts enable row level security;

drop policy if exists "space members all" on public.alignment_charts;
create policy "space members all" on public.alignment_charts
  for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

grant select, insert, update, delete on public.alignment_charts to authenticated;

commit;

-- Realtime last: guarded so re-running is harmless.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alignment_charts'
  ) then
    alter publication supabase_realtime add table public.alignment_charts;
  end if;
end $$;
