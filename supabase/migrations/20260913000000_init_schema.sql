-- Supabase Migration: 20260913000000_init_schema.sql
-- Description: Core baseline schema initialization, extensions, and metadata tracking

-- 1. Enable required PostgreSQL extensions
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- 2. System metadata table for tracking environment state and migration integrity
create table if not exists public.system_meta (
    key text primary key,
    value text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. Documentation comments
comment on table public.system_meta is 'System bootstrap metadata and runtime configuration state';
comment on column public.system_meta.key is 'Unique configuration key';
comment on column public.system_meta.value is 'Configuration value string or serialized JSON';

-- 4. Audit trigger function for updated_at maintenance
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger set_system_meta_updated_at
    before update on public.system_meta
    for each row
    execute function public.handle_updated_at();
