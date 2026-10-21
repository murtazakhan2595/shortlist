-- The daily run (PLAN.md item 4.5, D1): Supabase Cron starts it every night with no action from the owner.
--
-- Cron calls this function, not a route on the app (owner's decision, 21 October 2026): it records the run
-- and queues its first step, fetch_listings. The worker then runs it like any other step, so a failure,
-- such as Himalayas refusing too many requests, is retried by the queue instead of being lost until the
-- next night.
create function public.start_daily_run()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
begin
  insert into public.runs (kind) values ('daily') returning id into run_id;
  perform public.enqueue_step('steps', 'fetch_listings', jsonb_build_object('runId', run_id));
  return run_id;
end;
$$;

revoke execute on function public.start_daily_run() from public, anon, authenticated;
grant execute on function public.start_daily_run() to service_role;

-- 02:00 in Pakistan (21:00 UTC), so the list is ready long before the morning.
select cron.schedule('daily-run', '0 21 * * *', 'select public.start_daily_run()');
