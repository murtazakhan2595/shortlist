-- Size and type limits on the file buckets, enforced by Storage itself.
--
-- The app checks the size and type the browser reports before it creates a signed upload link
-- (frontend/src/lib/uploads.ts), but a signed link accepts any body. These limits make Storage refuse a
-- file the app would not have allowed. 10 MB matches MAX_UPLOAD_BYTES.

update storage.buckets
set file_size_limit = 10485760, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'screenshots';

update storage.buckets
set file_size_limit = 10485760, allowed_mime_types = array['application/pdf']
where id = 'cvs';
