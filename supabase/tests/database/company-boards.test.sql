-- The company watchlist: which boards are checked next, and boards added from job posts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Dated in the past, so they come before every real board waiting to be checked.
insert into public.company_boards (provider, slug, status, next_check_at) values
  ('greenhouse', 'test-due-second', 'idle', '2000-01-02'),
  ('greenhouse', 'test-due-first', 'unchecked', '2000-01-01'),
  ('lever', 'test-other-provider', 'unchecked', '2000-01-01'),
  ('greenhouse', 'test-watched', 'watched', null),
  ('greenhouse', 'test-gone', 'gone', null),
  ('greenhouse', 'test-later', 'idle', now() + interval '1 day');

select results_eq(
  $$ select slug from public.boards_to_check(array['greenhouse'], 2) $$,
  $$ values ('test-due-first'::text), ('test-due-second'::text) $$,
  'checks the boards that waited longest, for the providers asked for'
);

select is_empty(
  $$ select 1 from public.boards_to_check(array['greenhouse'], 100000)
     where slug in ('test-watched', 'test-gone', 'test-later') $$,
  'never checks a watched or gone board, or one not due yet'
);

select public.add_boards_to_check(
  '[{"provider": "greenhouse", "slug": "test-new"}, {"provider": "greenhouse", "slug": "test-later"},
    {"provider": "greenhouse", "slug": "test-gone"}, {"provider": "greenhouse", "slug": "test-watched"}]'
);

select results_eq(
  $$ select status from public.company_boards where provider = 'greenhouse' and slug = 'test-new' $$,
  $$ values ('unchecked'::text) $$,
  'adds a board linked from a post'
);

select ok(
  (select next_check_at <= now() from public.company_boards where slug = 'test-later'),
  'an idle board linked from a post is checked tonight'
);

select results_eq(
  $$ select slug, next_check_at from public.company_boards where slug in ('test-gone', 'test-watched') order by slug $$,
  $$ values ('test-gone'::text, null::timestamptz), ('test-watched'::text, null::timestamptz) $$,
  'a gone or watched board is left as it is'
);

select throws_ok(
  $$ insert into public.company_boards (provider, slug) values ('greenhouse', 'Acme') $$,
  '23514', null,
  'slugs are lowercase, so one board is listed once'
);

select results_eq(
  $$ select schedule, command from cron.job where jobname = 'board-check' $$,
  $$ values ('0 20 * * *'::text, $c$select public.enqueue_step('steps', 'load_board_lists', '{}'::jsonb)$c$::text) $$,
  'checks boards every night, an hour before the daily run'
);

select ok(
  not has_function_privilege('authenticated', 'public.add_boards_to_check(jsonb)', 'execute'),
  'only server code adds boards'
);

select * from finish(true);
rollback;
