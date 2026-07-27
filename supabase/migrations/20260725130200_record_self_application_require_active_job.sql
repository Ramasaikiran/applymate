-- record_self_application() let a user apply to ANY job id, including
-- inactive/closed ones — it never checked is_active. Since jobs are
-- looked up by id (a UUID a user could see in old links, admin
-- screenshots, etc.), this let applications land on jobs that were
-- never meant to be open. Require is_active = true, matching the
-- same gate the jobs SELECT RLS policy already uses.

create or replace function public.record_self_application(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
begin
  select title, company into v_job from public.jobs where id = p_job_id and is_active = true;
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
