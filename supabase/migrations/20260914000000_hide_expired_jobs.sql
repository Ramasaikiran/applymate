-- get_eligible_jobs never checked jobs.last_date, so a job stayed
-- visible in the user dashboard indefinitely even after its
-- application deadline passed. Reported by a user who kept seeing
-- an already-closed job.
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
      and (j.last_date is null or j.last_date >= current_date)
      and (
        j.graduation_years is null
        or array_length(j.graduation_years, 1) is null
        or v_passout_year = any(j.graduation_years)
      )
    order by j.posted_at desc;
end;
$$;

select 'Expired jobs (past last_date) no longer shown to users ✓' as status;

-- Same fix, defense-in-depth: a user could still have an old job link
-- saved (browser history, a screenshot) from before its deadline
-- passed. record_self_application already blocks inactive jobs for
-- the same reason -- extending that same guard to last_date.
create or replace function public.record_self_application(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
begin
  select title, company into v_job from public.jobs
  where id = p_job_id and is_active = true and (last_date is null or last_date >= current_date);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Job not found');
  end if;

  begin
    insert into public.job_applications (user_id, job_id, job_title, company, status, admin_id)
    values (auth.uid(), p_job_id, v_job.title, v_job.company, 'applied', null);
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'You already applied to this job');
    when others then
      return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  return jsonb_build_object('ok', true);
end;
$$;

