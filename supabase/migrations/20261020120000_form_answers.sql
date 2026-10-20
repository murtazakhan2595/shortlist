-- Form answers (PLAN.md sprint 3): a form supplied as screenshots or pasted text comes back with answers.

-- ---------------------------------------------------------------------------
-- The form and the job it is for
-- ---------------------------------------------------------------------------

-- A form is an application on the "form" route. Its screenshots are in form_image_paths; pasted pages
-- are kept here. The owner often adds the job post or its description with the form's own pages, so
-- the job is read from the same pages: a form needs no captured post.
alter table public.applications
  add column form_text text,
  add column job_role text,
  add column job_company text,
  -- What the pages say about the job (description, requirements, location, pay), so answers can fit it.
  add column job_text text;

-- ---------------------------------------------------------------------------
-- Questions and answers
-- ---------------------------------------------------------------------------

-- Each question moves through these, one queued step at a time:
--   pending       read from the form, not answered yet
--   checking      answered from the profile or answer bank, not checked yet
--   answered      answered and checked, or answered by the owner
--   needs_input   no supported answer: the owner answers it (F5)
--   asset_needed  the form wants something the system cannot write, such as a video or a file (F6)
alter table public.form_answers drop constraint form_answers_status_check;
alter table public.form_answers add constraint form_answers_status_check check (
  status in ('pending', 'checking', 'answered', 'needs_input', 'asset_needed')
);

alter table public.form_answers
  -- The choices a multiple-choice, checkbox or dropdown question offers. Empty for a free answer.
  add column options text[] not null default '{}',
  -- Why a question needs the owner, or which stored asset covers it.
  add column note text,
  -- The pages the question was read from: each time the owner adds pages they get a new batch id, so a
  -- second run of the reading step can see the batch is already read (AGENTS.md, Architecture rule 7).
  add column batch_id uuid not null;

create index form_answers_batch_id on public.form_answers (batch_id);
