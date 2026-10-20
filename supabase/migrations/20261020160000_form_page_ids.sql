-- Forms are read one page per queued step: reading several screenshots and copying the job's text in one
-- model call took longer than the 20-second limit. So a question records the one page it was read from.

alter table public.form_answers rename column batch_id to page_id;
alter index public.form_answers_batch_id rename to form_answers_page_id;

-- job_text now holds a short summary of the job, which is quicker to write than the full text.
comment on column public.applications.job_text is 'A short summary of the job, read from the form''s pages.';
