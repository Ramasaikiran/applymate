-- record_self_application never stored job_url, so self-apply users
-- (free/basic plan) had no job link saved on their applications
-- either -- same gap as the admin-applied side, just noticed while
-- adding the job-link display on the user dashboard.
create or replace function public.record_self_application(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
begin
  select title, company, apply_url into v_job from public.jobs
  where id = p_job_id and is_active = true and (last_date is null or last_date >= current_date);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Job not found');
  end if;

  begin
    insert into public.job_applications (user_id, job_id, job_title, company, job_url, status, admin_id)
    values (auth.uid(), p_job_id, v_job.title, v_job.company, v_job.apply_url, 'applied', null);
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'You already applied to this job');
    when others then
      return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  return jsonb_build_object('ok', true);
end;
$$;
