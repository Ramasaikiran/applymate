-- Public, aggregate-only callback statistics for the landing page.
-- Returns counts only (no rows, no user data).
--
-- Cohort: users whose first Pro / Max Pro subscription started at least N days
-- ago and who have at least one tracked application since it started.
-- "Got a call" = at least one of their applications reached interview, hr_round,
-- offer, joined or hired. 'shortlisted' is deliberately NOT counted.
-- Windows are cumulative: a user counts for "within 60 days" if the application
-- that led to the call was submitted within 60 days of the subscription start.
create or replace function public.get_callback_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with first_paid as (
    select user_id, min(starts_at) as started
    from public.subscriptions
    where plan in ('pro','maxpro')
      and status in ('active','expired')
      and starts_at is not null
    group by user_id
  ),
  cohort as (
    select fp.user_id, fp.started,
      -- years_experience lives in professional_details; students count as 0
      coalesce(pd.years_experience, case when p.user_type = 'student' then 0 end) as years_experience,
      (select min(a.applied_at)
         from public.job_applications a
        where a.user_id = fp.user_id
          and a.applied_at >= fp.started
          and a.status in ('interview','hr_round','offer','joined','hired')) as first_call
    from first_paid fp
    join public.profiles p on p.id = fp.user_id
    left join public.professional_details pd on pd.id = fp.user_id
    where exists (
      select 1 from public.job_applications a
      where a.user_id = fp.user_id and a.applied_at >= fp.started
    )
  ),
  windows as (
    select d as days,
      count(*) filter (where c.started <= now() - make_interval(days => d)) as eligible,
      count(*) filter (
        where c.started <= now() - make_interval(days => d)
          and c.first_call is not null
          and c.first_call <= c.started + make_interval(days => d)
      ) as got_call
    from cohort c, (values (30),(60),(90)) as w(d)
    group by d
  ),
  exp as (
    select
      case when c.years_experience < 1 then 'Student / fresher (under 1 year)'
           when c.years_experience < 3 then '1–2 years'
           when c.years_experience < 6 then '3–5 years'
           else '6+ years' end as bucket,
      min(case when c.years_experience < 1 then 1
               when c.years_experience < 3 then 2
               when c.years_experience < 6 then 3 else 4 end) as ord,
      count(*) as eligible,
      count(*) filter (where c.first_call is not null) as got_call
    from cohort c
    where c.years_experience is not null
      and c.started <= now() - interval '30 days'
    group by 1
  )
  select json_build_object(
    'windows', coalesce((select json_agg(json_build_object('days', days, 'eligible', eligible, 'got_call', got_call) order by days) from windows), '[]'::json),
    'experience', coalesce((select json_agg(json_build_object('bucket', bucket, 'eligible', eligible, 'got_call', got_call) order by ord) from exp), '[]'::json)
  );
$$;

revoke all on function public.get_callback_stats() from public;
grant execute on function public.get_callback_stats() to anon, authenticated;
