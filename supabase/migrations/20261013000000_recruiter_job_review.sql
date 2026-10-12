-- ================================================================
-- Recruiter jobs must be approved by an admin before paid users see them.
--
--  * New jobs by recruiters start as review_status = 'pending'. The job is
--    held at status 'draft' (publish_requested remembers their intent), so
--    get_eligible_jobs() and every other reader keeps working unchanged.
--  * Editing a job's content sends it back to 'pending' (re-verified).
--  * Pausing/publishing an already approved job does not need re-review.
--  * Only admins can change review_status (admin_review_job).
-- ================================================================

alter table public.jobs
  add column if not exists review_status      text not null default 'approved'
    check (review_status in ('pending','approved','rejected')),
  add column if not exists review_note        text,
  add column if not exists reviewed_by        uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at        timestamptz,
  add column if not exists publish_requested  boolean not null default false;

create index if not exists idx_jobs_review on public.jobs(review_status) where recruiter_id is not null;

-- Existing recruiter jobs must be (re)verified. Admin-posted jobs are untouched.
update public.jobs
   set review_status = 'pending',
       publish_requested = (status = 'published'),
       status = case when status = 'published' then 'draft' else status end
 where recruiter_id is not null and review_status = 'approved';

create or replace function public.enforce_recruiter_job_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company text;
  v_name    text;
  c_ignore  constant text[] := array[
    'status','is_active','updated_at','review_status','review_note',
    'reviewed_by','reviewed_at','publish_requested'];
begin
  -- Service role / SQL editor / admins keep full control.
  if auth.role() is distinct from 'authenticated' or public.is_admin() then
    return new;
  end if;

  select r.company_name, p.full_name into v_company, v_name
  from public.recruiters r join public.profiles p on p.id = r.id
  where r.id = auth.uid() and r.status = 'approved';

  if not found then raise exception 'Only approved recruiters can post jobs'; end if;

  new.recruiter_id    := auth.uid();
  new.created_by      := auth.uid();
  new.company         := v_company;
  new.recruiter_name  := v_name;
  new.plan_visibility := array['basic','pro','maxpro'];

  if tg_op = 'INSERT' then
    new.review_status := 'pending';
    new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    new.publish_requested := (new.status = 'published');
    if new.status = 'published' then new.status := 'draft'; end if;
    return new;
  end if;

  -- UPDATE: recruiters can never touch review fields.
  new.review_status := old.review_status;
  new.review_note   := old.review_note;
  new.reviewed_by   := old.reviewed_by;
  new.reviewed_at   := old.reviewed_at;

  -- Content edits send the job back for verification.
  if (to_jsonb(new) - c_ignore) is distinct from (to_jsonb(old) - c_ignore) then
    new.review_status := 'pending';
    new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    new.publish_requested := (new.status = 'published' or old.status = 'published' or old.publish_requested);
    if new.status = 'published' then new.status := 'draft'; end if;
    return new;
  end if;

  -- No content change: publish / pause toggles.
  if new.status = 'published' and new.review_status <> 'approved' then
    new.publish_requested := true;
    new.status := 'draft';
  elsif new.status <> 'published' then
    new.publish_requested := false;
  end if;
  return new;
end;
$$;

create or replace function public.admin_review_job(
  p_job_id uuid, p_decision text, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_job   record;
  v_admin text;
begin
  if not public.is_admin() then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'Invalid decision');
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Add a reason for the rejection.');
  end if;

  select * into v_job from public.jobs where id = p_job_id and recruiter_id is not null;
  if not found then return jsonb_build_object('ok', false, 'error', 'Job not found'); end if;

  if p_decision = 'approved' then
    update public.jobs set
      review_status = 'approved', review_note = nullif(trim(p_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now(),
      status = case when v_job.publish_requested then 'published' else v_job.status end,
      publish_requested = false
    where id = p_job_id;
  else
    update public.jobs set
      review_status = 'rejected', review_note = trim(p_note),
      reviewed_by = auth.uid(), reviewed_at = now(),
      status = case when v_job.status = 'published' then 'draft' else v_job.status end,
      publish_requested = false
    where id = p_job_id;
  end if;

  select full_name into v_admin from public.profiles where id = auth.uid();
  insert into public.admin_activity_log (admin_id, action, target_user_id, details, admin_name, target_name)
  values (auth.uid(), 'job_' || p_decision, v_job.recruiter_id, v_job.title || coalesce(': ' || nullif(trim(p_note), ''), ''),
          v_admin, v_job.recruiter_name);

  insert into public.notifications (user_id, title, message, type)
  values (v_job.recruiter_id,
          case p_decision when 'approved' then 'Job approved: ' || v_job.title else 'Job rejected: ' || v_job.title end,
          case p_decision
            when 'approved' then case when v_job.publish_requested then 'It is now live for paid members.' else 'Approved. Publish it when you are ready.' end
            else 'Reason: ' || trim(p_note) end,
          'info');

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.enforce_recruiter_job_fields() from public, anon, authenticated;
revoke execute on function public.admin_review_job(uuid,text,text) from public, anon;
grant  execute on function public.admin_review_job(uuid,text,text) to authenticated;

select 'Recruiter job review enabled ✓' as status;
