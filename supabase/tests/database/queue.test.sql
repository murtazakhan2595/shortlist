-- The step queue (item 1.8): only server code can use it, and steps move through it correctly.
-- Uses its own queue, steps_db_test, so it never meets the integration tests' steps_test queue.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select ok(
  not has_function_privilege('anon', 'public.enqueue_step(text, text, jsonb, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.enqueue_step(text, text, jsonb, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.read_next_step(text, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.wake_worker()', 'execute'),
  'visitors and signed-in users cannot use the queue'
);

select ok(
  has_function_privilege('service_role', 'public.enqueue_step(text, text, jsonb, boolean)', 'execute'),
  'server code can use the queue'
);

select throws_ok(
  $$ select public.enqueue_step('other_queue', 'queue_check', '{}', false) $$,
  'Unknown queue: other_queue',
  'only known queues can be used'
);

select public.enqueue_step('steps_db_test', 'queue_check', '{"sentAt": "now"}', false);

select results_eq(
  $$ select step, payload, attempts from public.read_next_step('steps_db_test', 60) $$,
  $$ values ('queue_check', '{"sentAt": "now"}'::jsonb, 1) $$,
  'a worker takes the waiting step'
);

select is_empty(
  $$ select * from public.read_next_step('steps_db_test', 60) $$,
  'a step being worked on is hidden from other workers'
);

select lives_ok(
  $$ select public.complete_step('steps_db_test', (select msg_id from pgmq.q_steps_db_test limit 1)) $$,
  'a finished step is completed'
);

select is_empty($$ select * from pgmq.q_steps_db_test $$, 'a completed step leaves the queue');

select public.enqueue_step('steps_db_test', 'queue_check', '{}', false);
select public.fail_step(
  'steps_db_test', (select msg_id from pgmq.q_steps_db_test limit 1), 'queue_check', '{}', 3, 'Error: it broke'
);

select results_eq(
  $$ select step, attempts, error from public.failed_steps where queue = 'steps_db_test' $$,
  $$ values ('queue_check', 3, 'Error: it broke') $$,
  'a step that failed every attempt is recorded with its error'
);

select is_empty($$ select * from pgmq.q_steps_db_test $$, 'a failed step leaves the queue');

select isnt_empty(
  $$ select 1 from cron.job where jobname = 'wake-worker' and schedule = '* * * * *' $$,
  'the worker is woken every minute'
);

select is(public.queue_length('steps_db_test'), 0::bigint, 'the queue length can be read');

select isnt_empty(
  $$ select 1 from cron.job where jobname = 'clean-cron-history' $$,
  'schedule history older than a week is cleaned up daily'
);

select * from finish(true);
rollback;
