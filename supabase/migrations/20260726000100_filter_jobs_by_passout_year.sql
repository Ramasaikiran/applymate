-- Jobs can now target a specific graduation year (jobs.required_passout_year).
-- A job with that column set should only be returned to students whose
-- student_details.passout_year matches. Null on either side = visible to all
-- (professionals have no student_details row, so they still see
-- year-agnostic jobs; a year-targeted job simply won't match them).

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
      and (j.required_passout_year is null or j.required_passout_year = v_passout_year)
    order by j.posted_at desc;
end;
$$;

select 'Graduation-year job filtering complete ✓' as status;
