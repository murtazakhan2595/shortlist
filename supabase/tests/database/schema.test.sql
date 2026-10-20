-- Rules the schema itself enforces, whoever is connected.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'every public table has row-level security'
);

select throws_ok(
  $$ insert into public.settings default values $$,
  '23505', null,
  'settings has a single row'
);

select lives_ok(
  $$ insert into public.documents (kind, name, content) values ('profile', 'schema-test', 'v1');
     insert into public.documents (kind, name, content, version) values ('profile', 'schema-test', 'v2', 2) $$,
  'a document can have several versions'
);

select throws_ok(
  $$ insert into public.documents (kind, name, content) values ('profile', 'schema-test', 'again') $$,
  '23505', null,
  'a document version cannot be stored twice'
);

select is(
  (select content from public.current_documents where kind = 'profile' and name = 'schema-test'),
  'v2',
  'current_documents shows the latest version'
);

select throws_ok(
  $$ insert into public.captures (input_type) values ('screenshot') $$,
  '23514', null,
  'a screenshot capture needs at least one image'
);

select lives_ok(
  $$ insert into public.applications (route, fingerprint) values ('email', 'acme|engineer') $$,
  'an application can be stored'
);

select throws_ok(
  $$ insert into public.applications (route, fingerprint) values ('note', 'acme|engineer') $$,
  '23505', null,
  'the same job cannot get a second application (X6)'
);

select throws_ok(
  $$ insert into public.form_answers (application_id, position, question, status, batch_id)
     select id, 1, 'Name', 'guessed', gen_random_uuid() from public.applications where fingerprint = 'acme|engineer' $$,
  '23514', null,
  'a form question is only in one of the known statuses'
);

select throws_ok(
  $$ insert into public.form_answers (application_id, position, question, status)
     select id, 1, 'Name', 'pending' from public.applications where fingerprint = 'acme|engineer' $$,
  '23502', null,
  'a form question records the batch of pages it was read from'
);

select lives_ok(
  $$ insert into public.runs (kind) values ('eval') $$,
  'an evaluation run can be recorded'
);

select * from finish(true);
rollback;
