-- Reading captured posts (PLAN.md item 2.1).

-- Each capture is its own run, so every model call made for one post (extraction now, writing and
-- checking later) is linked to it, and its cost can be explained afterwards (B1).
alter table public.captures add column run_id uuid references public.runs (id) on delete set null;

create index captures_run_id on public.captures (run_id);

-- Two outcomes of extraction that need the owner:
--   needs_form  the post links to a form, so the owner adds screenshots of it (sprint 3)
--   no_contact  the post gives neither an email nor a form link
alter table public.captures drop constraint captures_status_check;
alter table public.captures add constraint captures_status_check check (
  status in (
    'received', 'awaiting_confirmation', 'processing', 'needs_form', 'no_contact', 'done', 'duplicate', 'failed'
  )
);
