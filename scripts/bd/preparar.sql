-- Imita o mínimo do Supabase que as migrações assumem: roles, schema extensions,
-- publication supabase_realtime e privilégios por omissão do schema public.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator noinherit login;
grant anon, authenticated, service_role to authenticator;

create schema extensions;
grant usage on schema public, extensions to anon, authenticated, service_role;

-- No Supabase, os objetos novos do schema public ficam acessíveis a anon/authenticated;
-- as migrações é que retiram o que não deve ser acessível.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Vazia, como no Supabase; a migração acrescenta as tabelas.
create publication supabase_realtime;
