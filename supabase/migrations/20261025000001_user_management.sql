-- Phase 5: Employee account management. Run once in Supabase SQL Editor.
-- Existing accounts stay active, and historical performed_by UUIDs remain unchanged.
alter table public.profiles add column if not exists is_active boolean not null default true;
create index if not exists profiles_active_idx on public.profiles(is_active);
