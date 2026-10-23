-- Companies whose jobs the owner never wants (owner's decision, 23 October 2026): the filter drops them
-- before any model call, so they are never scored and get no note. The owner edits the list in Settings,
-- or blocks a company from the jobs page, so it is data, not a constant in code.
alter table public.settings add column blocked_companies text[] not null default '{}';

-- micro1 posts expert-contract gigs (attorneys, domain experts); KDCI posted many near-identical listings
-- that looked fake and took most of a night's list.
update public.settings set blocked_companies = '{micro1,KDCI}';
