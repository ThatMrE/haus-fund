-- Minimal stand-ins for the pieces Supabase provides, so the real schema
-- can be validated locally: the auth schema, auth.uid(), and the two
-- roles PostgREST connects as, with Supabase's default grants.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text unique);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
