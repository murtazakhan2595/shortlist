-- Discovery (PLAN.md items 4.1 and 4.2): what a listing needs once jobs are fetched every night, and
-- saving only the new ones.
--
-- The job's text is kept in the row, not in a file at raw_path (owner's decision, 21 October 2026): scoring
-- and notes read it, and expired listings are deleted (Himalayas' API terms), so the table stays small.
-- The table is empty, so seniority can change type.

alter table public.listings
  drop column raw_path,
  add column description text not null,
  add column employment_type text,
  add column categories text[] not null default '{}',
  add column expires_at timestamptz,
  -- The daily run that found the listing, so the app can show each morning's list.
  add column run_id uuid references public.runs (id) on delete set null,
  alter column seniority type text[] using case when seniority is null then '{}' else array[seniority] end,
  alter column seniority set default '{}',
  alter column seniority set not null;

create index listings_run_id on public.listings (run_id);

-- How jobKey (frontend/src/server/job-key.ts) writes a name, without its length cap: lower case, and every
-- run of other characters as one hyphen. jobKey keeps the base letter of an accented one, where this drops
-- it; the only effect is a rare missed match.
create function public.job_slug(name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Saves the listings that are new and returns their ids (D2, X6). A listing is skipped when the same source
-- gave it before (source, source_id), another source gave the same job (fingerprint), or the owner already
-- captured the job or answered a form for it (the same company and role).
create function public.save_new_listings(new_listings jsonb)
returns setof uuid
language sql
set search_path = ''
as $$
  insert into public.listings (
    source, source_id, url, title, company, location, countries, salary_min, salary_max, salary_currency,
    salary_period, seniority, employment_type, categories, tags, eligibility, eligibility_reason, description,
    fingerprint, posted_at, expires_at, run_id
  )
  select
    l.source, l.source_id, l.url, l.title, l.company, l.location, l.countries, l.salary_min, l.salary_max,
    l.salary_currency, l.salary_period, l.seniority, l.employment_type, l.categories, l.tags, l.eligibility,
    l.eligibility_reason, l.description, l.fingerprint, l.posted_at, l.expires_at, l.run_id
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

-- Himalayas' API terms: remove jobs once they expire. Kept, never shown again: listings the owner marked
-- apply or skip (the test set for check E2), and listings an application was prepared for, so every draft
-- can be explained. Returns how many were deleted.
create function public.delete_expired_listings()
returns integer
language sql
set search_path = ''
as $$
  with deleted as (
    delete from public.listings l
    where l.expires_at < now()
      and l.label is null
      and not exists (select 1 from public.applications a where a.listing_id = l.id)
    returning 1
  )
  select count(*)::integer from deleted;
$$;

-- New functions in public are callable by everyone by default; only server code may use these.
revoke execute on function public.job_slug(text), public.save_new_listings(jsonb), public.delete_expired_listings()
  from public, anon, authenticated;
grant execute on function public.job_slug(text), public.save_new_listings(jsonb), public.delete_expired_listings()
  to service_role;
