-- Two migrations landed at the same time from different sessions:
--   20260725110000 (this conversation)  → added jobs.graduation_years int[]
--   20260726000000 + 20260726000100     → re-added jobs.required_passout_year
--                                          (singular) and built
--                                          get_eligible_jobs() around it
--
-- The explicit ask was for multiple years per job (comma-separated in
-- the admin UI), so this migration is the tie-breaker: drops the
-- singular column for good and rewrites the matching function to
-- check against the array instead. A job with an empty/null
-- graduation_years array is visible to everyone, same "no restriction"
-- behavior as before.

alter table public.jobs drop column if exists required_passout_year;

create or replace function public.get_eligible_jobs()
returns setof public.jobs language plpgsql security definer set search_path = public as $$
declare
  v_plan text;
  v_active boolean;
  v_passout_year int;
begin
  select s.plan,
         (s.status = 'active' and (s.plan = 'free' or s.ends_at > now()))
    into v_plan, v_active
  from public.subscriptions s
  where s.user_id = auth.uid()
  order by s.ends_at desc nulls last
  limit 1;

  if v_plan is null then
    v_plan := 'free';
    v_active := true;
  end if;

  if not coalesce(v_active, false) then
    return;
  end if;

  select sd.passout_year into v_passout_year
  from public.student_details sd
  where sd.id = auth.uid();

  return query
    select * from public.jobs j
    where j.status = 'published'
      and v_plan = any(j.plan_visibility)
      and (
        j.graduation_years is null
        or array_length(j.graduation_years, 1) is null
        or v_passout_year = any(j.graduation_years)
      )
    order by j.posted_at desc;
end;
$$;

select 'Graduation-year job filtering now uses graduation_years[] ✓' as status;
