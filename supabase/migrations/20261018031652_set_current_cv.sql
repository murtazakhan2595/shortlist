-- Makes a newly uploaded CV the current one for its variant (PLAN.md item 1.7, P2).
-- One transaction, so there is never a moment with no current CV, or two.
create function public.set_current_cv(cv_variant text, cv_file_name text, cv_storage_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cv_file_id uuid;
begin
  update public.cv_files set is_current = false where variant = cv_variant and is_current;

  insert into public.cv_files (variant, file_name, storage_path, is_current)
  values (cv_variant, cv_file_name, cv_storage_path, true)
  returning id into cv_file_id;

  return cv_file_id;
end;
$$;

revoke execute on function public.set_current_cv(text, text, text) from public, anon, authenticated;
grant execute on function public.set_current_cv(text, text, text) to service_role;
