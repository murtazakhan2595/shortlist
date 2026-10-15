-- The step queue (PLAN.md item 1.8): background work as short queued steps.
--
-- A step is added with enqueue_step, which also calls the app's worker route at once through pg_net.
-- Supabase Cron calls the worker every minute as well, in case an instant call is missed.
-- The worker runs one step per call: read_next_step, then complete_step, retry_step_later or fail_step.
--
-- The app's address and the worker's secret are read from Supabase Vault (secrets "app_url" and
-- "internal_api_secret"), so moving host means changing one Vault value (PLAN.md portability rule 6).
-- They are set outside migrations, because secrets never enter the repository.

create extension if not exists pgmq;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- "steps" holds real work. "steps_test" is used only by tests, so they never touch real work.
select pgmq.create('steps');
select pgmq.create('steps_test');

-- Steps that failed every attempt, with the last error (shown in the app by item 5.6).
create table public.failed_steps (
  id uuid primary key default gen_random_uuid(),
  queue text not null,
  message_id bigint not null,
  step text not null,
  payload jsonb not null,
  attempts integer not null check (attempts > 0),
  error text not null,
  failed_at timestamptz not null default now()
);

alter table public.failed_steps enable row level security;

create policy "owner only" on public.failed_steps
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- ---------------------------------------------------------------------------
-- Waking the worker
-- ---------------------------------------------------------------------------

-- Calls POST /api/worker without waiting for the answer. Does nothing until the Vault secrets are set.
create function public.wake_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  internal_api_secret text;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into internal_api_secret from vault.decrypted_secrets where name = 'internal_api_secret';

  if app_url is null or internal_api_secret is null then
    raise notice 'Worker not woken: the app_url and internal_api_secret Vault secrets are not set';
    return;
  end if;

  perform net.http_post(
    url := app_url || '/api/worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || internal_api_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    -- Longer than the worker's 25-second budget, so a slow step is not reported as a timeout.
    timeout_milliseconds := 30000
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Queue functions, for server code only
-- ---------------------------------------------------------------------------

create function private.check_queue_name(queue_name text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if queue_name not in ('steps', 'steps_test') then
    raise exception 'Unknown queue: %', queue_name;
  end if;
end;
$$;

-- Adds a step. Only the real queue wakes the worker, and only when asked (wake is turned off by tests
-- and by the check of the every-minute schedule).
create function public.enqueue_step(queue_name text, step text, payload jsonb, wake boolean default true)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_id bigint;
begin
  perform private.check_queue_name(queue_name);
  select pgmq.send(queue_name, jsonb_build_object('step', step, 'payload', payload)) into message_id;

  if wake and queue_name = 'steps' then
    perform public.wake_worker();
  end if;

  return message_id;
end;
$$;

-- Takes the oldest waiting step and hides it from other workers for visibility_seconds.
-- If the worker does not finish it in that time, the step becomes visible again and is retried.
create function public.read_next_step(queue_name text, visibility_seconds integer)
returns table (message_id bigint, attempts integer, step text, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_queue_name(queue_name);
  return query
    select m.msg_id, m.read_ct, m.message ->> 'step', m.message -> 'payload'
    from pgmq.read(queue_name, visibility_seconds, 1) as m;
end;
$$;

create function public.complete_step(queue_name text, message_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_queue_name(queue_name);
  perform pgmq.delete(queue_name, message_id);
end;
$$;

-- Makes a failed step visible again after delay_seconds.
create function public.retry_step_later(queue_name text, message_id bigint, delay_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_queue_name(queue_name);
  perform pgmq.set_vt(queue_name, message_id, delay_seconds);
end;
$$;

-- Records a step that failed every attempt and removes it from the queue, in one transaction.
create function public.fail_step(
  queue_name text,
  message_id bigint,
  step text,
  payload jsonb,
  attempts integer,
  error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_queue_name(queue_name);
  insert into public.failed_steps (queue, message_id, step, payload, attempts, error)
  values (queue_name, message_id, step, payload, attempts, error);
  perform pgmq.delete(queue_name, message_id);
end;
$$;

-- Only server code (the secret key's service_role) may use the queue.
revoke execute on function public.wake_worker() from public, anon, authenticated;
revoke execute on function public.enqueue_step(text, text, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.read_next_step(text, integer) from public, anon, authenticated;
revoke execute on function public.complete_step(text, bigint) from public, anon, authenticated;
revoke execute on function public.retry_step_later(text, bigint, integer) from public, anon, authenticated;
revoke execute on function public.fail_step(text, bigint, text, jsonb, integer, text) from public, anon, authenticated;

grant execute on function public.wake_worker() to service_role;
grant execute on function public.enqueue_step(text, text, jsonb, boolean) to service_role;
grant execute on function public.read_next_step(text, integer) to service_role;
grant execute on function public.complete_step(text, bigint) to service_role;
grant execute on function public.retry_step_later(text, bigint, integer) to service_role;
grant execute on function public.fail_step(text, bigint, text, jsonb, integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- The every-minute schedule
-- ---------------------------------------------------------------------------

select cron.schedule('wake-worker', '* * * * *', 'select public.wake_worker()');
