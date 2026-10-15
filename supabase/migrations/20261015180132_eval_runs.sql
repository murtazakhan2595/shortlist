-- Evaluation runs (PLAN.md item 1.6): each `pnpm eval` run is recorded as a run of kind "eval",
-- and its model calls link to it, so eval spending is visible and kept apart from daily runs.
alter table public.runs drop constraint runs_kind_check;
alter table public.runs add constraint runs_kind_check check (kind in ('daily', 'capture', 'eval'));
