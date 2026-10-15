-- The starting model for each step (PLAN.md item 1.4, section 4).
--
-- The owner changes these from the settings screen (U4), so they live in the database.
-- The steps, providers, effort levels and model prices are constants in code:
-- src/lib/model-catalog.ts.

alter table public.step_models alter column effort set not null;

-- Checking steps run at medium effort, because they guard against unsupported claims (principle 2).
-- Capture-path writing runs at low effort to meet the one-minute target (C6).
insert into public.step_models (step, provider, model, effort) values
  ('extract_capture', 'openai', 'gpt-6.1-sol', 'low'),
  ('write_email', 'openai', 'gpt-6.1-sol', 'low'),
  ('check_email', 'openai', 'gpt-6.1-sol', 'medium'),
  ('read_form', 'openai', 'gpt-6.1-sol', 'low'),
  ('answer_form', 'openai', 'gpt-6.1-sol', 'low'),
  ('check_form_answers', 'openai', 'gpt-6.1-sol', 'medium'),
  ('score_listing', 'openai', 'gpt-6-luna', 'medium'),
  ('write_note', 'openai', 'gpt-6.1-sol', 'medium'),
  ('check_note', 'openai', 'gpt-6.1-sol', 'medium');
