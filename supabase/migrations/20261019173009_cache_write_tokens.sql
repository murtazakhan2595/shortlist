-- Input the provider wrote to its prompt cache (PLAN.md item 2.2). On newer OpenAI models a cache write
-- costs 1.25 times the normal input price, so it is recorded apart. Part of input_tokens.
alter table public.model_calls
  add column cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  drop constraint model_calls_cached_within_input,
  add constraint model_calls_cache_within_input check (cached_input_tokens + cache_write_tokens <= input_tokens);
