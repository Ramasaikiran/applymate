-- BUG FIX: get_application_stats() dropped 'last_90_days' when it was
-- rewritten in 20260729000000_require_admin_on_stats_rpcs.sql (security
-- fix for caller checks). Dashboard's "Last 90 days" filter was reading
-- an undefined key ever since, so it always showed 0.
-- Restoring the 90-day bucket, keeping the auth check from that migration.

create or replace function public.get_application_stats(p_user_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  result json;
begin
  if auth.uid() <> p_user_id and not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select json_build_object(
    'last_7_days',  (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '7 days'),
    'last_30_days', (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '30 days'),
    'last_90_days', (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '90 days'),
    'last_365_days',(select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '365 days'),
    'all_time',     (select count(*) from public.job_applications where user_id = p_user_id),
    'shortlisted',  (select count(*) from public.job_applications where user_id = p_user_id and status = 'shortlisted'),
    'hired',        (select count(*) from public.job_applications where user_id = p_user_id and status = 'hired')
  ) into result;
  return result;
end;
$$;
