-- Database tests and integration tests each get their own test queue. CI runs them at the same time,
-- and sharing steps_test let one take the other's test step.
select pgmq.create('steps_db_test');

create or replace function private.check_queue_name(queue_name text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if queue_name not in ('steps', 'steps_test', 'steps_db_test') then
    raise exception 'Unknown queue: %', queue_name;
  end if;
end;
$$;
