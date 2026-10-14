-- Shortlist: initial schema (PLAN.md item 1.2).
--
-- Access: one owner. Every table has row-level security, and the only policy lets the
-- signed-in owner (settings.owner_user_id) read and write. Server code uses the secret key,
-- which bypasses these rules and never reaches the browser.

-- ---------------------------------------------------------------------------
-- Settings and the owner check
-- ---------------------------------------------------------------------------

-- A single row. The id column only exists to stop a second row being added.
create table public.settings (
  id boolean primary key default true check (id),
  owner_user_id uuid references auth.users (id) on delete set null,
  daily_target integer not null default 20 check (daily_target > 0),
  monthly_cap_usd numeric(10, 2) not null default 50 check (monthly_cap_usd >= 0),
  pay_floor_usd_month integer not null default 3000 check (pay_floor_usd_month >= 0),
  excluded_countries text[] not null default '{India}'
);

insert into public.settings default values;

-- Kept out of the public schema so the API does not expose it.
create schema private;

create function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.settings where owner_user_id = (select auth.uid())
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_owner() to authenticated;

-- Which model each step uses (B3). Rows are added with the model module (item 1.4).
create table public.step_models (
  step text primary key,
  provider text not null,
  model text not null,
  effort text
);

-- ---------------------------------------------------------------------------
-- The owner's material
-- ---------------------------------------------------------------------------

-- Profile, answer bank, voice examples and email patterns, as plain text (Q8).
-- An edit adds a new version instead of overwriting, so every draft can point to what it used.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('profile', 'answer_bank', 'voice_example', 'email_pattern')),
  name text not null,
  content text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (kind, name, version)
);

-- The latest version of each document. security_invoker makes the view obey the table's access rules.
create view public.current_documents
with (security_invoker = true)
as
  select distinct on (kind, name) *
  from public.documents
  order by kind, name, version desc;

create table public.cv_files (
  id uuid primary key default gen_random_uuid(),
  variant text not null check (variant in ('full_stack', 'ai_engineer', 'ai_full_stack')),
  file_name text not null,
  storage_path text not null unique,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

-- Only one current CV per variant.
create unique index cv_files_one_current_per_variant on public.cv_files (variant) where is_current;

-- ---------------------------------------------------------------------------
-- Jobs coming in
-- ---------------------------------------------------------------------------

-- Posts the owner sends in by pasting text or sharing a screenshot.
create table public.captures (
  id uuid primary key default gen_random_uuid(),
  input_type text not null check (input_type in ('text', 'screenshot')),
  raw_text text,
  image_paths text[] not null default '{}',
  post_url text,
  role text,
  company text,
  poster_name text,
  contact_email text,
  form_url text,
  email_confirmed boolean not null default false,
  fingerprint text,
  status text not null default 'received'
    check (status in ('received', 'awaiting_confirmation', 'processing', 'done', 'duplicate', 'failed')),
  created_at timestamptz not null default now(),
  check (
    (input_type = 'text' and raw_text is not null)
    or (input_type = 'screenshot' and cardinality(image_paths) > 0)
  )
);

-- Not unique: a repeated post is still recorded, then marked as a duplicate.
create index captures_fingerprint on public.captures (fingerprint);

-- Jobs found automatically. The full listing is stored as a file at raw_path.
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  url text not null,
  title text not null,
  company text not null,
  location text,
  countries text[] not null default '{}',
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_period text check (salary_period in ('hour', 'month', 'year')),
  seniority text,
  tags text[] not null default '{}' check (tags <@ array['remote', 'contractor', 'visa']),
  eligibility text not null check (eligibility in ('eligible', 'unclear', 'excluded')),
  eligibility_reason text,
  raw_path text,
  -- The same job from two sources has the same fingerprint, so it is stored once (D2).
  fingerprint text not null unique,
  label text check (label in ('apply', 'skip')),
  labelled_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

-- ---------------------------------------------------------------------------
-- Tracking
-- ---------------------------------------------------------------------------

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily', 'capture')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  listings_fetched integer not null default 0,
  listings_kept integer not null default 0,
  listings_scored integer not null default 0,
  applications_prepared integer not null default 0
);

-- ---------------------------------------------------------------------------
-- What gets prepared
-- ---------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid references public.captures (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  route text not null check (route in ('email', 'note', 'form')),
  cv_file_id uuid references public.cv_files (id) on delete set null,
  presented_title text,
  email_pattern_id uuid references public.documents (id) on delete set null,
  recipient_email text,
  subject text,
  body text,
  form_image_paths text[] not null default '{}',
  gmail_draft_id text,
  status text not null default 'preparing'
    check (status in ('preparing', 'ready', 'blocked', 'failed', 'sent', 'skipped', 'replied', 'interview')),
  blocked_reason text,
  sent_at timestamptz,
  -- One application per job, whichever path it arrived by (X6).
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  -- An application comes from a capture or a listing, never both.
  constraint applications_one_origin check (capture_id is null or listing_id is null)
);

create index applications_capture_id on public.applications (capture_id);
create index applications_listing_id on public.applications (listing_id);
create index applications_cv_file_id on public.applications (cv_file_id);
create index applications_email_pattern_id on public.applications (email_pattern_id);

create table public.form_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  position integer not null check (position > 0),
  question text not null,
  answer text,
  status text not null check (status in ('answered', 'needs_input', 'asset_needed')),
  created_at timestamptz not null default now(),
  unique (application_id, position)
);

-- Every model call and its cost (B1). Run and monthly costs are summed from here.
create table public.model_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.runs (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  step text not null,
  provider text not null,
  model text not null,
  effort text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  duration_ms integer check (duration_ms >= 0),
  error text,
  created_at timestamptz not null default now()
);

create index model_calls_run_id on public.model_calls (run_id);
create index model_calls_application_id on public.model_calls (application_id);
create index model_calls_created_at on public.model_calls (created_at);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  reasons text not null,
  model_call_id uuid references public.model_calls (id) on delete set null,
  created_at timestamptz not null default now()
);

create index scores_listing_id on public.scores (listing_id);
create index scores_model_call_id on public.scores (model_call_id);

-- ---------------------------------------------------------------------------
-- Access rules: the owner only
-- ---------------------------------------------------------------------------

alter table public.settings enable row level security;
alter table public.step_models enable row level security;
alter table public.documents enable row level security;
alter table public.cv_files enable row level security;
alter table public.captures enable row level security;
alter table public.listings enable row level security;
alter table public.runs enable row level security;
alter table public.applications enable row level security;
alter table public.form_answers enable row level security;
alter table public.model_calls enable row level security;
alter table public.scores enable row level security;

create policy "owner only" on public.settings
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.step_models
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.documents
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.cv_files
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.captures
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.listings
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.runs
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.applications
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.form_answers
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.model_calls
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owner only" on public.scores
  for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
