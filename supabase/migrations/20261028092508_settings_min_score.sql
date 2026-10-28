-- Jobs that scored below this are hidden on the Jobs page. 0 shows every job.
alter table public.settings add column min_score integer not null default 0 check (min_score between 0 and 100);
