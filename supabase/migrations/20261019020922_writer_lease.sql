-- One worker at a time per application (PLAN.md item 2.2).
--
-- The writer's loop runs one stage per queued step. A step first claims a short lease on the
-- application; a step that finds it held does nothing, so two workers never run the same loop at once.
-- If a worker dies, its lease runs out and the queue's retry carries on from the last saved stage.
alter table public.applications add column writer_lease_until timestamptz;
