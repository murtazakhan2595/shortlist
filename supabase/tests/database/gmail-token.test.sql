-- The Gmail token is reachable only by server code (PLAN.md item 2.3, AGENTS.md rule 9).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

set local role anon;
select throws_ok($$ select public.gmail_token() $$, '42501', null, 'a visitor cannot read the Gmail token');
select throws_ok($$ select public.save_gmail_token('x') $$, '42501', null, 'a visitor cannot replace the Gmail token');
reset role;

set local role authenticated;
select throws_ok($$ select public.gmail_token() $$, '42501', null, 'a signed-in user cannot read the Gmail token');
reset role;

-- Saving twice keeps one secret, holding the latest token.
set local role service_role;
select public.save_gmail_token('first-token');
select public.save_gmail_token('second-token');
select is(public.gmail_token(), 'second-token', 'server code reads the latest saved token');
reset role;
select is((select count(*) from vault.secrets where name = 'gmail_refresh_token'), 1::bigint, 'one secret is kept');

select * from finish(true);
rollback;
