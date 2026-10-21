-- The daily run (D1): scheduled every night, it records a run and queues its first step.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select results_eq(
  $$ select schedule, command from cron.job where jobname = 'daily-run' $$,
  $$ values ('0 21 * * *'::text, 'select public.start_daily_run()'::text) $$,
  'runs every night at 02:00 in Pakistan'
);

-- Queued on the real queue, but this transaction is rolled back, so the step is never run.
select public.start_daily_run() as run_id \gset

select results_eq(
  format($$ select kind, status from public.runs where id = %L $$, :'run_id'),
  $$ values ('daily'::text, 'running'::text) $$,
  'records a daily run'
);

select results_eq(
  format(
    $$ select message->>'step', message->'payload'->>'runId' from pgmq.q_steps where message->'payload'->>'runId' = %L $$,
    :'run_id'
  ),
  format($$ values ('fetch_listings', %L) $$, :'run_id'),
  'queues the run''s first step'
);

select ok(
  not has_function_privilege('authenticated', 'public.start_daily_run()', 'execute'),
  'only the schedule and server code can start a run'
);

select * from finish(true);
rollback;
