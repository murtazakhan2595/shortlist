-- Only the owner can see or change data (U6, principle 6).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Two signed-in users: the owner and someone else.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@example.test');
update public.settings set owner_user_id = '00000000-0000-0000-0000-00000000000a';

insert into public.documents (kind, name, content) values ('profile', 'access-test', 'private text');

-- Visitor who is not signed in.
set local role anon;
select is_empty(
  $$ select 1 from public.documents where name = 'access-test' $$,
  'a visitor who is not signed in sees nothing'
);
select throws_ok(
  $$ insert into public.documents (kind, name, content) values ('profile', 'by-anon', 'x') $$,
  '42501', null,
  'a visitor who is not signed in cannot add data'
);
reset role;

-- Signed in, but not the owner.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is_empty(
  $$ select 1 from public.documents where name = 'access-test' $$,
  'another signed-in user sees nothing'
);
select is_empty(
  $$ select 1 from public.current_documents where name = 'access-test' $$,
  'another signed-in user sees nothing through the current_documents view'
);
select throws_ok(
  $$ insert into public.documents (kind, name, content) values ('profile', 'by-stranger', 'x') $$,
  '42501', null,
  'another signed-in user cannot add data'
);
reset role;

-- The owner.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select isnt_empty(
  $$ select 1 from public.documents where name = 'access-test' $$,
  'the owner sees their data'
);
select lives_ok(
  $$ insert into public.documents (kind, name, content) values ('profile', 'by-owner', 'x') $$,
  'the owner can add data'
);
reset role;

select * from finish(true);
rollback;
