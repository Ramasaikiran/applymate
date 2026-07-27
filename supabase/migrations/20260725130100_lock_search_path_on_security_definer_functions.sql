-- 11 SECURITY DEFINER functions had no locked search_path — a known
-- Postgres privilege-escalation vector (flagged by Supabase's own
-- linter as function_search_path_mutable). Without an explicit
-- search_path, a SECURITY DEFINER function resolves unqualified
-- object names using the CALLER's search_path, so a caller able to
-- create objects earlier in that path could shadow a table/function
-- the definer intended and have it execute with the definer's
-- privileges. Locking search_path to `public` removes that vector
-- with zero change to function logic.

alter function public.check_free_tier_application_cap() set search_path = public;
alter function public.check_rate_limit(text, text, integer, integer) set search_path = public;
alter function public.check_signup_rate_limit(text) set search_path = public;
alter function public.get_active_subscription(uuid) set search_path = public;
alter function public.get_application_stats(uuid) set search_path = public;
alter function public.get_eligible_jobs() set search_path = public;
alter function public.get_matched_jobs_count(uuid) set search_path = public;
alter function public.get_my_application_usage() set search_path = public;
alter function public.get_recent_activity() set search_path = public;
alter function public.record_self_application(uuid) set search_path = public;
alter function public.record_signup_attempt(text) set search_path = public;
