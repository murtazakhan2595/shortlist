-- Sprint 7, item 7.4: a listing whose post gives an email address keeps it, so a listing on the night's list
-- can get an email and a Gmail draft, as a capture does. The address is read from the post by code, never by
-- a model, so text in a post can never choose where a draft goes (X5).
alter table public.listings add column contact_email text;

-- As before (20261021100000_listing_details.sql), now saving contact_email too.
create or replace function public.save_new_listings(new_listings jsonb)
returns setof uuid
language sql
set search_path = ''
as $$
  insert into public.listings (
    source, source_id, url, title, company, location, countries, salary_min, salary_max, salary_currency,
    salary_period, seniority, employment_type, categories, tags, eligibility, eligibility_reason, description,
    fingerprint, posted_at, expires_at, run_id, contact_email
  )
  select
    l.source, l.source_id, l.url, l.title, l.company, l.location, l.countries, l.salary_min, l.salary_max,
    l.salary_currency, l.salary_period, l.seniority, l.employment_type, l.categories, l.tags, l.eligibility,
    l.eligibility_reason, l.description, l.fingerprint, l.posted_at, l.expires_at, l.run_id, l.contact_email
  from jsonb_populate_recordset(null::public.listings, new_listings) as l
  where not exists (
      select 1 from public.captures c
      where public.job_slug(c.company) = public.job_slug(l.company)
        and public.job_slug(c.role) = public.job_slug(l.title)
    )
    and not exists (
      select 1 from public.applications a
      where a.route = 'form'
        and public.job_slug(a.job_company) = public.job_slug(l.company)
        and public.job_slug(a.job_role) = public.job_slug(l.title)
    )
  on conflict do nothing
  returning id;
$$;
