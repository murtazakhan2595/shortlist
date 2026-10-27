-- The CV that fits a listing best, picked by the same model call that scores it, so every job on the list
-- says which CV to attach. Null for listings scored before this column.
alter table public.scores add column cv_variant text;
