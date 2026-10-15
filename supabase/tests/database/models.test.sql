-- Every model step has a starting model (B3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select set_eq(
  $$ select step from public.step_models $$,
  array[
    'extract_capture', 'write_email', 'check_email', 'read_form', 'answer_form',
    'check_form_answers', 'score_listing', 'write_note', 'check_note'
  ],
  'every model step has a starting model'
);

select * from finish(true);
rollback;
