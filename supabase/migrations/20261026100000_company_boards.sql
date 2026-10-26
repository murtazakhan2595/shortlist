-- Company job boards on Greenhouse, Lever and Ashby, and which of them are worth reading every night.
--   unchecked: listed, not read yet
--   watched: has a remote developer job open to the owner's country, so the nightly run reads it
--   idle: has none; read again after a month
--   gone: the board no longer exists
create table public.company_boards (
  provider text not null check (provider in ('greenhouse', 'lever', 'ashby')),
  slug text not null check (slug <> '' and slug = lower(slug)),
  company text,
  status text not null default 'unchecked' check (status in ('unchecked', 'watched', 'idle', 'gone')),
  -- Null when the board is not checked again: watched boards are read every night instead, gone ones never.
  next_check_at timestamptz default now(),
  checked_at timestamptz,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (provider, slug)
);

create index company_boards_due on public.company_boards (next_check_at, slug) where next_check_at is not null;
create index company_boards_watched on public.company_boards (provider) where status = 'watched';

alter table public.company_boards enable row level security;
create policy "owner only" on public.company_boards
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- The boards to check next, longest waiting first.
create function public.boards_to_check(providers text[], how_many integer)
returns setof public.company_boards
language sql
stable
set search_path = ''
as $$
  select *
  from public.company_boards
  where next_check_at <= now() and provider = any(providers)
  order by next_check_at, slug
  limit how_many;
$$;

-- Boards linked from a job that passed the filter: new ones are added, and an idle one is checked again
-- tonight, since the company is hiring.
create function public.add_boards_to_check(boards jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.company_boards (provider, slug)
  select b.provider, b.slug
  from jsonb_to_recordset(boards) as b (provider text, slug text)
  on conflict (provider, slug) do update
    set next_check_at = now()
    where public.company_boards.status = 'idle';
$$;

revoke execute on function public.boards_to_check(text[], integer) from public, anon, authenticated;
revoke execute on function public.add_boards_to_check(jsonb) from public, anon, authenticated;
grant execute on function public.boards_to_check(text[], integer) to service_role;
grant execute on function public.add_boards_to_check(jsonb) to service_role;

-- An hour before the daily run, so boards found tonight are read tonight.
select cron.schedule(
  'board-check',
  '0 20 * * *',
  $$select public.enqueue_step('steps', 'load_board_lists', '{}'::jsonb)$$
);
