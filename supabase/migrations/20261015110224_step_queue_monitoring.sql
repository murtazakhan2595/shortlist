-- Keeping an eye on the step queue (PLAN.md item 1.8).

-- How many steps are waiting, including any being worked on. Used by the live queue check,
-- and later to warn when the daily run did not finish (item 5.6).
create function public.queue_length(queue_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_queue_name(queue_name);
  return (select queue_length from pgmq.metrics(queue_name));
end;
$$;

revoke execute on function public.queue_length(text) from public, anon, authenticated;
grant execute on function public.queue_length(text) to service_role;

-- The every-minute schedule writes a history row per run, about 1,440 a day. Keep a week of history,
-- so the free plan's 500 MB database does not fill up (PLAN.md section 8).
select cron.schedule(
  'clean-cron-history',
  '0 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$
);
