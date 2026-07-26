-- Add graduation-year targeting to jobs.
-- Null = visible to all years. Set = visible only to students with matching passout_year.
alter table public.jobs
  add column if not exists required_passout_year int;
