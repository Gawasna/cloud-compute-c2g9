-- Minimal stand-ins for what Supabase provides, so the REAL migrations can run on plain PostgreSQL.
-- DESTRUCTIVE: only ever executed against a database whose name contains "test".
drop schema if exists public cascade;
create schema public;
drop schema if exists auth cascade;
create schema auth;
drop schema if exists extensions cascade;
create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
