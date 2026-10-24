-- Dive-deeper daily usage. Apply once in the Supabase SQL editor, or with `supabase db push`.
-- Authenticated users can read their own rows. They cannot insert, update, or delete,
-- so the counter can't be reset from the client. The increment lives in a security-definer
-- function in the unexposed `private` schema. `public.increment_chat_usage` is a thin
-- invoker wrapper the API can call.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.chat_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  web_count integer not null default 0,
  primary key (user_id, day),
  constraint chat_usage_count_nonnegative check (count >= 0),
  constraint chat_usage_web_count_nonnegative check (web_count >= 0),
  constraint chat_usage_web_within_count check (web_count <= count)
);

comment on table public.chat_usage is
  'Per-user UTC-day counts for dive-deeper chat. count is every message; web_count is messages sent with web lookup.';

alter table public.chat_usage enable row level security;

revoke all on table public.chat_usage from public, anon, authenticated;
grant select on table public.chat_usage to authenticated;

drop policy if exists chat_usage_select_own on public.chat_usage;
create policy chat_usage_select_own
  on public.chat_usage
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.increment_chat_usage(
  p_web boolean,
  p_limit integer,
  p_web_limit integer
)
returns table (message_count integer, web_count integer, allowed boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  utc_day date := (pg_catalog.timezone('utc', pg_catalog.now()))::date;
  cur_count integer;
  cur_web integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_limit is null or p_limit < 1 or p_web_limit is null or p_web_limit < 1 then
    raise exception 'invalid limit';
  end if;

  insert into public.chat_usage (user_id, day, count, web_count)
  values (uid, utc_day, 0, 0)
  on conflict (user_id, day) do nothing;

  select c.count, c.web_count
    into cur_count, cur_web
  from public.chat_usage c
  where c.user_id = uid and c.day = utc_day
  for update;

  if cur_count >= p_limit then
    return query select cur_count, cur_web, false, 'daily'::text;
    return;
  end if;

  if p_web and cur_web >= p_web_limit then
    return query select cur_count, cur_web, false, 'web'::text;
    return;
  end if;

  update public.chat_usage as c
  set count = c.count + 1,
      web_count = c.web_count + case when p_web then 1 else 0 end
  where c.user_id = uid and c.day = utc_day
  returning c.count, c.web_count
  into cur_count, cur_web;

  return query select cur_count, cur_web, true, 'ok'::text;
end;
$$;

revoke all on function private.increment_chat_usage(boolean, integer, integer) from public, anon;
grant execute on function private.increment_chat_usage(boolean, integer, integer) to authenticated;

create or replace function public.increment_chat_usage(
  p_web boolean,
  p_limit integer,
  p_web_limit integer
)
returns table (message_count integer, web_count integer, allowed boolean, reason text)
language sql
security invoker
set search_path = ''
as $$
  select message_count, web_count, allowed, reason
  from private.increment_chat_usage(p_web, p_limit, p_web_limit);
$$;

revoke all on function public.increment_chat_usage(boolean, integer, integer) from public, anon;
grant execute on function public.increment_chat_usage(boolean, integer, integer) to authenticated;

comment on function public.increment_chat_usage(boolean, integer, integer) is
  'Atomically counts one dive-deeper message for auth.uid() on the current UTC day. Does not increment once the passed caps are reached.';
