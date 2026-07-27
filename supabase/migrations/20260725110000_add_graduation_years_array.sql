-- Adds graduation_years as an integer array so admins can enter
-- multiple eligible graduation years per job (comma-separated in the
-- UI), instead of a single year.
--
-- required_passout_year (int, singular) exists in schema.sql but was
-- never wired into the admin form or any query — dropping it here in
-- favor of the new array column so there's only one source of truth.

alter table public.jobs add column if not exists graduation_years int[] default '{}';
alter table public.jobs drop column if exists required_passout_year;
