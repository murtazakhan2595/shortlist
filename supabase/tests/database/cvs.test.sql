-- CV versions (P2): a new CV replaces the current one for its variant, in one step.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select public.set_current_cv('full_stack', 'first.pdf', 'cvs/00000000-0000-0000-0000-000000000001.pdf');
select public.set_current_cv('full_stack', 'second.pdf', 'cvs/00000000-0000-0000-0000-000000000002.pdf');

select results_eq(
  $$ select file_name from public.cv_files where variant = 'full_stack' and is_current $$,
  $$ values ('second.pdf') $$,
  'the newest CV is the current one'
);

select results_eq(
  $$ select is_current from public.cv_files where file_name = 'first.pdf' $$,
  $$ values (false) $$,
  'the older CV is kept, no longer current'
);

select ok(
  not has_function_privilege('authenticated', 'public.set_current_cv(text, text, text)', 'execute'),
  'only server code can change the current CV'
);

select * from finish(true);
rollback;
