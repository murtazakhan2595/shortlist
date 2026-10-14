-- Private file storage (PLAN.md item 1.2): CVs, screenshots of posts and forms, and raw listings.
-- Only the owner can read or write; server code uses the secret key.

insert into storage.buckets (id, name, public)
values
  ('cvs', 'cvs', false),
  ('screenshots', 'screenshots', false),
  ('raw-listings', 'raw-listings', false);

create policy "owner only" on storage.objects
  for all to authenticated
  using (bucket_id in ('cvs', 'screenshots', 'raw-listings') and (select private.is_owner()))
  with check (bucket_id in ('cvs', 'screenshots', 'raw-listings') and (select private.is_owner()));
