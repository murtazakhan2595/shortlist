-- Model spending per month and step, summed from model_calls (B1; PLAN.md item 5.3, shown early on the
-- settings page). Months are calendar months in UTC. security_invoker makes the view obey the table's
-- access rules, so only the owner sees it.
create view public.monthly_spend
with (security_invoker = true)
as
  select
    to_char(created_at at time zone 'UTC', 'YYYY-MM') as month,
    step,
    count(*)::integer as calls,
    sum(cost_usd) as cost_usd
  from public.model_calls
  group by 1, 2;
