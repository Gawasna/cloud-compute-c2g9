-- Supabase Migration: 20260913000001_enable_rls.sql
-- Description: Enable Row Level Security (RLS) and define explicit access policies on public tables

-- 1. Enable Row Level Security on system_meta
alter table public.system_meta enable row level security;

-- 2. Access policy for service_role (full administrative access)
create policy "service_role_manage_system_meta"
    on public.system_meta
    for all
    to service_role
    using (true)
    with check (true);

-- 3. Access policy for authenticated users (read-only metadata access)
create policy "authenticated_read_system_meta"
    on public.system_meta
    for select
    to authenticated
    using (true);
