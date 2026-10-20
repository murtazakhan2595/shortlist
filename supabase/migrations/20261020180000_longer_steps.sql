-- The step budget goes from 25 to 60 seconds (owner's decision, 20 October 2026): reading one full-page
-- form screenshot took 22 seconds. Vercel allows 300 seconds per call; Amplify allows 30, so a move there
-- would bring this back down.
--
-- The same function as in the step_queue migration, with a longer wait for the worker's answer.

create or replace function public.wake_worker()
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
    -- Longer than the worker's 60-second budget, so a slow step is not reported as a timeout.
    timeout_milliseconds := 90000
  );
end;
$$;
