-- ================================================================
-- Recruiter role: follow-up patch (idempotent)
--  * jobs.status uses 'inactive' (matches the app + live CHECK), not 'closed'
--  * recruiter_send_invite() now returns invite_id so the client can
--    trigger the invite-email edge function
-- Safe to run whether or not 20261011000000 was applied before.
-- ================================================================

create or replace function public.close_jobs_when_recruiter_unapproved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'approved' and old.status = 'approved' then
    update public.jobs set status = 'inactive' where recruiter_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.recruiter_send_invite(
  p_candidate_id uuid, p_type text, p_message text default null, p_job_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_daily_cap constant int := 20;
  v_company text;
  v_rname   text;
  v_job     text;
  v_invite  uuid;
begin
  if not public.is_approved_recruiter() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_type not in ('assessment', 'interview') then
    return jsonb_build_object('ok', false, 'error', 'Invalid invite type');
  end if;

  if not exists (select 1 from public.recruiter_profile_views
                 where recruiter_id = auth.uid() and candidate_id = p_candidate_id
                   and viewed_at > now() - interval '30 days') then
    return jsonb_build_object('ok', false, 'error', 'View the profile before inviting');
  end if;

  if not exists (select 1 from public.profiles p
                 where p.id = p_candidate_id and p.recruiter_visible
                   and p.account_status = 'active' and public.is_paid_user(p.id)) then
    return jsonb_build_object('ok', false, 'error', 'Candidate not available');
  end if;

  if (select count(*) from public.recruiter_invites
      where recruiter_id = auth.uid() and created_at > now() - interval '1 day') >= c_daily_cap then
    return jsonb_build_object('ok', false, 'error', 'Daily invite limit reached');
  end if;

  if p_job_id is not null then
    select title into v_job from public.jobs where id = p_job_id and recruiter_id = auth.uid();
    if not found then return jsonb_build_object('ok', false, 'error', 'Job not found'); end if;
  end if;

  select r.company_name, p.full_name into v_company, v_rname
  from public.recruiters r join public.profiles p on p.id = r.id where r.id = auth.uid();

  insert into public.recruiter_invites (recruiter_id, candidate_id, job_id, invite_type, message)
  values (auth.uid(), p_candidate_id, p_job_id, p_type, left(p_message, 1000))
  returning id into v_invite;

  insert into public.notifications (user_id, title, message, type)
  values (p_candidate_id,
          case p_type when 'assessment' then 'Assessment invite from ' || v_company
                      else 'Interview invite from ' || v_company end,
          v_rname || ' from ' || v_company
            || case when v_job is not null then ' invited you for ' || v_job else ' sent you an invite' end
            || '.',
          case p_type when 'interview' then 'interview' else 'info' end);

  return jsonb_build_object('ok', true, 'invite_id', v_invite);
end;
$$;
revoke execute on function public.recruiter_send_invite(uuid,text,text,uuid) from public, anon;

grant execute on function public.is_approved_recruiter()                  to authenticated;
grant execute on function public.apply_as_recruiter(text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_review_recruiter(uuid,text,text)   to authenticated;
grant execute on function public.recruiter_search_candidates(text[],numeric,int,int,int) to authenticated;
grant execute on function public.recruiter_view_candidate(uuid)           to authenticated;
grant execute on function public.recruiter_send_invite(uuid,text,text,uuid) to authenticated;
-- is_paid_user stays server-side only (used inside definer functions).
-- is_work_email is callable pre-signup so the form can show a clear error.
grant execute on function public.is_work_email(text) to anon, authenticated;

select 'Recruiter role migration complete ✓' as status;

revoke execute on function public.recruiter_send_invite(uuid,text,text,uuid) from public, anon;
grant  execute on function public.recruiter_send_invite(uuid,text,text,uuid) to authenticated;
revoke execute on function public.close_jobs_when_recruiter_unapproved() from public, anon, authenticated;

-- Serialize concurrent profile opens (no double views / double notifications).
create or replace function public.recruiter_view_candidate(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_daily_cap constant int := 50;       -- distinct candidates per recruiter per day
  c_renotify  constant interval := interval '7 days';
  v_company   text;
  v_rname     text;
  v_prof      record;
  v_student   jsonb;
  v_pro       jsonb;
  v_seen_24h  boolean;
  v_seen_7d   boolean;
begin
  if not public.is_approved_recruiter() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  -- Serialize concurrent opens of the same profile (double-click, retries)
  -- so one open can never log two views or send two notifications.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || p_candidate_id::text));

  select r.company_name, p.full_name into v_company, v_rname
  from public.recruiters r join public.profiles p on p.id = r.id
  where r.id = auth.uid();

  select * into v_prof from public.profiles p
  where p.id = p_candidate_id
    and p.recruiter_visible and p.account_status = 'active'
    and not p.is_admin and p.user_type is not null
    and public.is_paid_user(p.id);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Candidate not available');
  end if;

  select exists (select 1 from public.recruiter_profile_views
                 where recruiter_id = auth.uid() and candidate_id = p_candidate_id
                   and viewed_at > now() - interval '1 day') into v_seen_24h;
  select exists (select 1 from public.recruiter_profile_views
                 where recruiter_id = auth.uid() and candidate_id = p_candidate_id
                   and viewed_at > now() - c_renotify) into v_seen_7d;

  if not v_seen_24h then
    if (select count(distinct candidate_id) from public.recruiter_profile_views
        where recruiter_id = auth.uid() and viewed_at > now() - interval '1 day') >= c_daily_cap then
      return jsonb_build_object('ok', false, 'error', 'Daily profile view limit reached');
    end if;
    insert into public.recruiter_profile_views (recruiter_id, candidate_id)
    values (auth.uid(), p_candidate_id);
  end if;

  if not v_seen_7d then
    insert into public.notifications (user_id, title, message, type)
    values (p_candidate_id, 'A recruiter viewed your profile',
            v_rname || ' from ' || v_company || ' viewed your profile.', 'profile_view');
  end if;

  select to_jsonb(sd) - 'id' into v_student from public.student_details sd where sd.id = p_candidate_id;
  -- previous_salary is intentionally NOT returned.
  select to_jsonb(pd) - 'id' - 'previous_salary' into v_pro
  from public.professional_details pd where pd.id = p_candidate_id;

  return jsonb_build_object(
    'ok', true,
    'candidate', jsonb_build_object(
      'id', v_prof.id, 'full_name', v_prof.full_name, 'user_type', v_prof.user_type,
      'country', v_prof.country, 'photo_url', coalesce(v_prof.photo_url, v_prof.avatar_url),
      'linkedin_url', v_prof.linkedin_url, 'github_url', v_prof.github_url,
      'email', v_prof.email, 'mobile_number', v_prof.mobile_number
    ),
    'student', v_student,
    'professional', v_pro
  );
end;
$$;

revoke execute on function public.recruiter_view_candidate(uuid) from public, anon;
grant  execute on function public.recruiter_view_candidate(uuid) to authenticated;

select 'Recruiter follow-up patch complete ✓' as status;
