-- SECURITY FIX: get_admin_dashboard_stats() and get_user_app_stats(uuid)
-- are SECURITY DEFINER (bypass RLS) and were only ever meant to be
-- called from the admin dashboard — but neither function checked that
-- the caller was actually an admin. Postgres grants EXECUTE to PUBLIC
-- by default, and PostgREST exposes every public-schema function as
-- /rest/v1/rpc/<name>, so any authenticated (non-admin) user could
-- call these directly and:
--   - get_admin_dashboard_stats(): read aggregate business metrics
--     (total users, active subscriber count, etc.)
--   - get_user_app_stats(p_user_id): read ANY other user's application
--     stats just by passing their UUID — an IDOR, since RLS on
--     job_applications would normally block that.
-- Both now raise an exception for non-admin callers.

create or replace function public.get_admin_dashboard_stats()
returns json language plpgsql security definer set search_path = public as $$
declare
  result json;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select json_build_object(
    'total_users',           (select count(*) from public.profiles where is_admin = false),
    'active_subscribers',    (select count(*) from public.subscriptions where status = 'active' and ends_at > now()),
    'apps_today',             (select count(*) from public.job_applications where applied_at >= current_date),
    'apps_week',              (select count(*) from public.job_applications where applied_at >= now() - interval '7 days'),
    'apps_month',             (select count(*) from public.job_applications where applied_at >= now() - interval '30 days'),
    'total_interviews',       (select count(*) from public.job_applications where status in ('interview','hr_round')),
    'total_offers',           (select count(*) from public.job_applications where status in ('offer','joined','hired')),
    'expiring_subscriptions', (select count(*) from public.subscriptions where status = 'active'
                                  and ends_at between now() and now() + interval '7 days')
  ) into result;
  return result;
end;
$$;

create or replace function public.get_user_app_stats(p_user_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  result json;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select json_build_object(
    'total_applications', (select count(*) from public.job_applications where user_id = p_user_id),
    'interviews',          (select count(*) from public.job_applications where user_id = p_user_id and status in ('interview','hr_round')),
    'rejections',          (select count(*) from public.job_applications where user_id = p_user_id and status = 'rejected'),
    'offers',              (select count(*) from public.job_applications where user_id = p_user_id and status in ('offer','joined','hired'))
  ) into result;
  return result;
end;
$$;

-- Same class of bug, three more functions — these are called by users
-- about THEMSELVES (p_user_id = their own profile.id), so the fix here
-- is "self or admin" rather than admin-only.

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
    'last_365_days',(select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '365 days'),
    'all_time',     (select count(*) from public.job_applications where user_id = p_user_id),
    'shortlisted',  (select count(*) from public.job_applications where user_id = p_user_id and status = 'shortlisted'),
    'hired',        (select count(*) from public.job_applications where user_id = p_user_id and status = 'hired')
  ) into result;
  return result;
end;
$$;

create or replace function public.get_matched_jobs_count(p_user_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  user_skills text[];
  matched int;
begin
  if auth.uid() <> p_user_id and not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select technical_skills into user_skills from public.student_details where id = p_user_id;
  if user_skills is null then
    select technical_skills into user_skills from public.professional_details where id = p_user_id;
  end if;
  if user_skills is null then return 0; end if;

  select count(*) into matched
  from public.jobs
  where is_active = true
    and required_skills && user_skills;

  return coalesce(matched, 0);
end;
$$;

create or replace function public.get_active_subscription(p_user_id uuid)
returns table (plan text, ends_at timestamptz) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() <> p_user_id and not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
    select s.plan, s.ends_at from public.subscriptions s
    where s.user_id = p_user_id and s.status = 'active' and s.ends_at > now()
    order by s.ends_at desc limit 1;
end;
$$;
