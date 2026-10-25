-- C++ compile/run daily usage. Apply once in the Supabase SQL editor, or with
-- `supabase db push`. The app does not apply this file on its own. Until it is
-- applied, /api/code/cpp answers with a clear "not ready" message and does not
-- start a sandbox.
--
-- Authenticated users can read their own rows. They cannot insert, update, or
-- delete, so the counter can't be reset from the client. The increment lives in
-- a security-definer function in the unexposed `private` schema.
-- `public.increment_cpp_run_usage` is a thin invoker wrapper the API can call.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.cpp_run_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day),
  constraint cpp_run_usage_count_nonnegative check (count >= 0)
);

comment on table public.cpp_run_usage is
  'Per-user UTC-day counts for C++ Run and Submit. Each call that is about to start a sandbox increments count.';

alter table public.cpp_run_usage enable row level security;

revoke all on table public.cpp_run_usage from public, anon, authenticated;
grant select on table public.cpp_run_usage to authenticated;

drop policy if exists cpp_run_usage_select_own on public.cpp_run_usage;
create policy cpp_run_usage_select_own
  on public.cpp_run_usage
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.increment_cpp_run_usage(p_limit integer)
returns table (run_count integer, allowed boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  utc_day date := (pg_catalog.timezone('utc', pg_catalog.now()))::date;
  cur_count integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid limit';
  end if;

  insert into public.cpp_run_usage (user_id, day, count)
  values (uid, utc_day, 0)
  on conflict (user_id, day) do nothing;

  select c.count
    into cur_count
  from public.cpp_run_usage c
  where c.user_id = uid and c.day = utc_day
  for update;

  if cur_count >= p_limit then
    return query select cur_count, false, 'daily'::text;
    return;
  end if;

  update public.cpp_run_usage as c
  set count = c.count + 1
  where c.user_id = uid and c.day = utc_day
  returning c.count
  into cur_count;

  return query select cur_count, true, 'ok'::text;
end;
$$;

revoke all on function private.increment_cpp_run_usage(integer) from public, anon;
grant execute on function private.increment_cpp_run_usage(integer) to authenticated;

create or replace function public.increment_cpp_run_usage(p_limit integer)
returns table (run_count integer, allowed boolean, reason text)
language sql
security invoker
set search_path = ''
as $$
  select run_count, allowed, reason
  from private.increment_cpp_run_usage(p_limit);
$$;

revoke all on function public.increment_cpp_run_usage(integer) from public, anon;
grant execute on function public.increment_cpp_run_usage(integer) to authenticated;

comment on function public.increment_cpp_run_usage(integer) is
  'Atomically counts one C++ run for auth.uid() on the current UTC day. Does not increment once p_limit is reached.';
