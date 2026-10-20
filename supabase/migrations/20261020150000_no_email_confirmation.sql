-- An email read from a screenshot goes straight to the writer (owner's decision, 20 October 2026).
-- The owner sees the address in the Gmail draft before sending, so captures no longer wait for it to be
-- confirmed: the awaiting_confirmation status and the email_confirmed flag go.

alter table public.captures drop column email_confirmed;

alter table public.captures drop constraint captures_status_check;
alter table public.captures add constraint captures_status_check check (
  status in ('received', 'processing', 'needs_form', 'no_contact', 'done', 'duplicate', 'failed')
);
