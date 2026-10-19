-- The writer (PLAN.md item 2.2): LangGraph's saved state, and cached tokens in the cost records.

-- ---------------------------------------------------------------------------
-- LangGraph checkpoints
-- ---------------------------------------------------------------------------
--
-- The write, check and revise loop runs one stage per queued step. After each stage LangGraph saves
-- the loop's state here (a checkpoint), and the next step carries on from it.
--
-- Ported from: https://github.com/langchain-ai/langgraphjs/blob/4510774dd362264f44efd34b29b4f5648eeb4c4c/libs/checkpoint-postgres/src/migrations.ts (MIT)
-- These are the tables PostgresSaver.setup() would create, in their final form, so they are versioned
-- here like every other table instead of being created by code at run time. The migration rows below
-- tell the saver they exist, so setup() is never needed.
--
-- A schema of their own: the Data API does not expose it, so neither visitors nor the owner's browser
-- session can reach it. Only server code connecting with the database URL can.

create schema langgraph;

create table langgraph.checkpoint_migrations (
  v integer primary key
);

create table langgraph.checkpoints (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  parent_checkpoint_id text,
  type text,
  checkpoint jsonb not null,
  metadata jsonb not null default '{}',
  primary key (thread_id, checkpoint_ns, checkpoint_id)
);

create table langgraph.checkpoint_blobs (
  thread_id text not null,
  checkpoint_ns text not null default '',
  channel text not null,
  version text not null,
  type text not null,
  blob bytea,
  primary key (thread_id, checkpoint_ns, channel, version)
);

create table langgraph.checkpoint_writes (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  task_id text not null,
  idx integer not null,
  channel text not null,
  type text,
  blob bytea not null,
  task_path text not null default '',
  primary key (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

-- The saver's own six migrations (versions 0 to 5) are all contained in the tables above.
insert into langgraph.checkpoint_migrations (v) values (0), (1), (2), (3), (4), (5);

-- ---------------------------------------------------------------------------
-- Cached input tokens
-- ---------------------------------------------------------------------------

-- Input the provider read from its prompt cache, charged at a lower price. Part of input_tokens.
alter table public.model_calls
  add column cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  add constraint model_calls_cached_within_input check (cached_input_tokens <= input_tokens);
