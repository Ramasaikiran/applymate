-- ================================================================
-- Recruiters see ALL paid candidates (opt-in removed)
--  * recruiter_search_candidates(): no recruiter_visible filter; adds a
--    keyword search (name, college, branch, role, company, skill)
--  * recruiter_view_candidate() / recruiter_send_invite(): same rule
-- Still enforced: approved recruiter only, paid + active candidates only,
-- 50 profile opens/day, 20 invites/day, candidate is notified on every view.
-- ================================================================

drop function if exists public.recruiter_search_candidates(text[], numeric, int, int, int);

create or replace function public.recruiter_search_candidates(
  p_query      text    default null,
  p_skills     text[]  default '{}',
  p_min_exp    numeric default null,
  p_passout    int     default null,
  p_limit      int     default 20,
  p_offset     int     default 0
) returns table (
  candidate_id uuid, first_name text, user_type text, country text,
  technical_skills text[], years_experience numeric, previous_job_title text,
  college_name text, branch text, passout_year int, cgpa numeric
) language plpgsql stable security definer set search_path = public as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
begin
  if not public.is_approved_recruiter() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
    select p.id, p.first_name, p.user_type, p.country,
           coalesce(sd.technical_skills, pd.technical_skills),
           pd.years_experience, pd.previous_job_title,
           sd.college_name, sd.branch, sd.passout_year, sd.cgpa
    from public.profiles p
    left join public.student_details      sd on sd.id = p.id
    left join public.professional_details pd on pd.id = p.id
    where p.account_status = 'active'
      and not p.is_admin
      and p.user_type is not null
      and public.is_paid_user(p.id)
      and (p_passout is null or sd.passout_year = p_passout)
      and (p_min_exp is null or pd.years_experience >= p_min_exp)
      and (
        coalesce(cardinality(p_skills), 0) = 0
        or exists (
          select 1 from unnest(coalesce(sd.technical_skills, pd.technical_skills)) s
          where lower(s) in (select lower(trim(x)) from unnest(p_skills) x)
        )
      )
      and (
        q = ''
        or strpos(lower(coalesce(p.full_name, '')), q) > 0
        or strpos(lower(coalesce(sd.college_name, '')), q) > 0
        or strpos(lower(coalesce(sd.branch, '')), q) > 0
        or strpos(lower(coalesce(pd.previous_job_title, '')), q) > 0
        or strpos(lower(coalesce(pd.previous_company, '')), q) > 0
        or exists (
          select 1 from unnest(coalesce(sd.technical_skills, pd.technical_skills)) s
          where strpos(lower(s), q) > 0
        )
      )
    order by p.last_login desc nulls last
    limit least(coalesce(p_limit, 20), 20)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

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
    and p.account_status = 'active'
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
                 where p.id = p_candidate_id
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

revoke execute on function public.recruiter_search_candidates(text,text[],numeric,int,int,int) from public, anon;
grant  execute on function public.recruiter_search_candidates(text,text[],numeric,int,int,int) to authenticated;
revoke execute on function public.recruiter_view_candidate(uuid) from public, anon;
grant  execute on function public.recruiter_view_candidate(uuid) to authenticated;
revoke execute on function public.recruiter_send_invite(uuid,text,text,uuid) from public, anon;
grant  execute on function public.recruiter_send_invite(uuid,text,text,uuid) to authenticated;

select 'Recruiters now see all paid candidates ✓' as status;
