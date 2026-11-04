-- Meal plan: lunch and dinner (2026-11-03). Run this once in the Supabase SQL
-- Editor — schema.sql already includes the end state for fresh installs.
--
-- A `meal_plan_days` row becomes one planned MEAL on one day: a new `meal`
-- column ('lunch' | 'dinner'), and the one-row-per-day key widens to one row
-- per day per meal. Every existing row was a dinner, so the column defaults
-- to 'dinner' and nothing else changes.

begin;

alter table public.meal_plan_days
  add column if not exists meal text not null default 'dinner';

alter table public.meal_plan_days
  drop constraint if exists meal_plan_days_meal_check;
alter table public.meal_plan_days
  add constraint meal_plan_days_meal_check check (meal in ('lunch', 'dinner'));

alter table public.meal_plan_days
  drop constraint if exists meal_plan_days_space_day_key;
alter table public.meal_plan_days
  drop constraint if exists meal_plan_days_space_day_meal_key;
alter table public.meal_plan_days
  add constraint meal_plan_days_space_day_meal_key unique (space_id, day, meal);

commit;
