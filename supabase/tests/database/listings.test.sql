-- Listings (D2, X6): only new jobs are saved, and expired ones are removed as Himalayas' terms ask.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- A listing as the daily run sends it, with every column it fills.
create function pg_temp.listing(source_id text, company text, title text, expires_at timestamptz default now() + interval '30 days')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'source', 'pgtap-listings', 'source_id', source_id, 'url', 'https://example.com/' || source_id,
    'title', title, 'company', company, 'location', null, 'countries', '{}'::text[],
    'salary_min', null, 'salary_max', null, 'salary_currency', null, 'salary_period', null,
    'seniority', '{}'::text[], 'employment_type', 'Full Time', 'categories', '{}'::text[], 'tags', '{remote}'::text[],
    'eligibility', 'eligible', 'eligibility_reason', null, 'description', 'A job.',
    'fingerprint', public.job_slug(company) || '_' || public.job_slug(title),
    'posted_at', now(), 'expires_at', expires_at, 'run_id', null
  );
$$;

select is(
  (select count(*)::integer from public.save_new_listings(jsonb_build_array(
    pg_temp.listing('1', 'Acme', 'Full-Stack Engineer'),
    pg_temp.listing('2', 'ACME', 'Full Stack Engineer'),
    pg_temp.listing('3', 'Globex', 'AI Engineer')
  ))),
  2,
  'saves each job once, even when one run gives it twice under another spelling'
);

select is(
  (select count(*)::integer from public.save_new_listings(jsonb_build_array(pg_temp.listing('3', 'Globex', 'AI Engineer (new title)')))),
  0,
  'skips a listing the same source gave before'
);

insert into public.captures (input_type, raw_text, company, role) values ('text', 'A post', 'Initech', 'Backend Developer');
select is(
  (select count(*)::integer from public.save_new_listings(jsonb_build_array(pg_temp.listing('4', 'initech', 'Backend developer')))),
  0,
  'skips a job the owner already captured'
);

insert into public.applications (route, fingerprint, job_company, job_role) values ('form', 'form:test', 'Hooli', 'React Developer');
select is(
  (select count(*)::integer from public.save_new_listings(jsonb_build_array(pg_temp.listing('5', 'Hooli', 'React Developer')))),
  0,
  'skips a job the owner already answered a form for'
);

select is(
  (select count(*)::integer from public.listings where source = 'pgtap-listings' and source_id in ('1', '2')),
  1,
  'keeps one of the two spellings of the same job'
);

-- Expired: one plain, one the owner marked, one with an application.
select is(
  (select count(*)::integer from public.save_new_listings(jsonb_build_array(
    pg_temp.listing('6', 'Expired', 'Plain', now() - interval '1 day'),
    pg_temp.listing('7', 'Expired', 'Marked', now() - interval '1 day'),
    pg_temp.listing('8', 'Expired', 'Applied', now() - interval '1 day')
  ))),
  3,
  'saves listings of different jobs at the same company'
);
update public.listings set label = 'skip' where source = 'pgtap-listings' and source_id = '7';
insert into public.applications (route, fingerprint, listing_id)
select 'note', 'test:applied', id from public.listings where source = 'pgtap-listings' and source_id = '8';

-- The function deletes across the whole table, which other tests running at the same time share, so its
-- count can include their rows; which of this test's own rows are left is what is checked.
select ok(public.delete_expired_listings() >= 1, 'deletes expired listings');
select results_eq(
  $$ select source_id from public.listings where source = 'pgtap-listings' and source_id not in ('1', '2') order by source_id $$,
  $$ values ('3'), ('7'), ('8') $$,
  'deletes only the expired listing that is not marked or applied for, and keeps open ones'
);

select ok(
  not has_function_privilege('authenticated', 'public.save_new_listings(jsonb)', 'execute'),
  'only server code can save listings'
);
select ok(
  not has_function_privilege('authenticated', 'public.delete_expired_listings()', 'execute'),
  'only server code can delete listings'
);

select * from finish(true);
rollback;
