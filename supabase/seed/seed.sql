-- Supabase Seed Data: supabase/seed/seed.sql
-- Description: Deterministic baseline seed data for local development and CI testing environments

insert into public.system_meta (key, value, created_at, updated_at)
values
    ('schema_version', '20260913000000', now(), now()),
    ('environment', 'development', now(), now()),
    ('seed_status', 'completed', now(), now()),
    ('app_name', 'cc-prj', now(), now())
on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;
