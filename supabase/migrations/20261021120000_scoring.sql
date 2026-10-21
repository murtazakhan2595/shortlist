-- Scoring (PLAN.md item 4.4; D5): one score per listing, and each night's top listings.

-- A listing is scored once, so a step that runs twice cannot store two scores.
-- The unique constraint's index replaces the plain one.
drop index public.scores_listing_id;
alter table public.scores add constraint scores_listing_id_key unique (listing_id);

-- The listing's place in its run's top N (1 is the best), or null when it was not kept. Stored, not worked
-- out again later, so check E2 can tell which listings were in each night's top N after the daily target changes.
alter table public.listings add column top_rank integer check (top_rank > 0);
