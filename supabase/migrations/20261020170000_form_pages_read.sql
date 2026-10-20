-- Each form page is read in its own step, and a page may hold only the job post (no questions), so the
-- form itself records which pages are read. A second run of the reading step skips a page listed here
-- (AGENTS.md, Architecture rule 7). Questions no longer need to carry their page.

alter table public.applications add column read_page_ids uuid[] not null default '{}';

alter table public.form_answers drop column page_id;

-- The job's text is kept word for word, page after page, so answers can fit the whole job.
comment on column public.applications.job_text is 'What the form''s pages say about the job, word for word, page after page.';
