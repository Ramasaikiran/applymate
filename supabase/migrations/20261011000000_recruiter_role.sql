-- ================================================================
-- Recruiter role (third login)
--
-- Rules implemented:
--  1. Recruiters sign up with a WORK email + email OTP. Free-mail
--     domains (gmail, yahoo, ...) are blocked server-side.
--  2. Recruiters stay 'pending' until an admin approves them.
--  3. Approved recruiters can post jobs. Those jobs are visible only
--     to paid candidates (plan_visibility forced to paid plans).
--  4. Paid candidates see recruiter NAME + COMPANY on the job and in
--     notifications. They never get access to the recruiters table.
--  5. Approved recruiters can search/view only paid candidates who
--     opted in (profiles.recruiter_visible). Contact details are
--     returned only by recruiter_view_candidate(), which logs the view
--     and notifies the candidate ("<name> from <company> viewed your
--     profile").
--  6. Recruiters can send assessment/interview invites after a view.
--
-- All recruiter writes go through SECURITY DEFINER RPCs. There are no
-- client insert/update policies on recruiters, views, or invites.
-- ================================================================

-- ── 1. WORK-EMAIL CHECK ──────────────────────────────────────────
create table if not exists public.blocked_email_domains (
  domain text primary key
);
alter table public.blocked_email_domains enable row level security;
drop policy if exists "Admins manage blocked domains" on public.blocked_email_domains;
create policy "Admins manage blocked domains"
  on public.blocked_email_domains for all
  using (public.is_admin()) with check (public.is_admin());

insert into public.blocked_email_domains (domain) values
  ('gmail.com'), ('googlemail.com'),
  ('yahoo.com'), ('yahoo.in'), ('yahoo.co.in'), ('yahoo.co.uk'), ('ymail.com'), ('rocketmail.com'),
  ('outlook.com'), ('hotmail.com'), ('live.com'), ('msn.com'),
  ('icloud.com'), ('me.com'), ('aol.com'),
  ('proton.me'), ('protonmail.com'), ('tutanota.com'),
  ('rediffmail.com'), ('zoho.com'), ('mail.com'), ('gmx.com'), ('yandex.com'),
  ('mailinator.com'), ('guerrillamail.com'), ('10minutemail.com'), ('tempmail.com')
on conflict do nothing;

create or replace function public.is_work_email(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and not exists (
       select 1 from public.blocked_email_domains d
       where d.domain = lower(split_part(p_email, '@', 2))
     );
$$;

-- Server-side backstop. The sign-up form should also call is_work_email()
-- for a friendly message; this trigger stops direct API calls.
create or replace function public.block_free_email_recruiter_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'account_type', '') = 'recruiter'
     and not public.is_work_email(new.email) then
    raise exception 'Recruiters must sign up with a work email address.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_block_free_recruiter on auth.users;
create trigger on_auth_user_block_free_recruiter
  before insert on auth.users
  for each row execute function public.block_free_email_recruiter_signup();

-- ── 2. DO NOT GIVE RECRUITERS THE FREE CANDIDATE PLAN ────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  _full text; _first text; _last text;
  _is_recruiter boolean := coalesce(new.raw_user_meta_data->>'account_type', '') = 'recruiter';
begin
  _full  := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  _first := coalesce(new.raw_user_meta_data->>'given_name',  split_part(_full, ' ', 1));
  _last  := coalesce(new.raw_user_meta_data->>'family_name',
              case when position(' ' in _full) > 0
                   then substring(_full from position(' ' in _full) + 1)
                   else null end);
  insert into public.profiles (id, full_name, first_name, last_name, email, avatar_url, account_status)
  values (new.id, _full, _first, _last, new.email, new.raw_user_meta_data->>'avatar_url',
          case when new.email_confirmed_at is not null then 'active' else 'pending_onboarding' end)
  on conflict (id) do nothing;

  if not _is_recruiter then
    insert into public.subscriptions (user_id, plan, amount_paise, status, starts_at)
    values (new.id, 'free', 0, 'active', now())
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

-- ── 3. RECRUITERS ────────────────────────────────────────────────
create table if not exists public.recruiters (
  id               uuid primary key references public.profiles(id) on delete cascade,
  company_name     text not null,
  company_website  text not null,
  designation      text not null,
  linkedin_url     text not null,
  gstin            text,
  cin              text,
  work_email       text not null,
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected','suspended')),
  review_note      text,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.recruiters enable row level security;
drop policy if exists "Recruiters view own record" on public.recruiters;
create policy "Recruiters view own record"
  on public.recruiters for select using (auth.uid() = id);
drop policy if exists "Admins view all recruiters" on public.recruiters;
create policy "Admins view all recruiters"
  on public.recruiters for select using (public.is_admin());
-- No insert/update/delete policies on purpose. Use the RPCs below.

create or replace function public.is_approved_recruiter()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.recruiters where id = auth.uid() and status = 'approved');
$$;

-- Recruiter submits (or resubmits) company details for review.
create or replace function public.apply_as_recruiter(
  p_company_name    text,
  p_company_website text,
  p_designation     text,
  p_linkedin_url    text,
  p_gstin           text default null,
  p_cin             text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email     text;
  v_confirmed timestamptz;
  v_existing  text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select email, email_confirmed_at into v_email, v_confirmed
  from auth.users where id = auth.uid();

  if v_confirmed is null then
    return jsonb_build_object('ok', false, 'error', 'Verify your email with the OTP first.');
  end if;
  if not public.is_work_email(v_email) then
    return jsonb_build_object('ok', false, 'error', 'A work email address is required.');
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and (user_type is not null or is_admin)) then
    return jsonb_build_object('ok', false, 'error', 'This account is already a candidate account. Use a separate work email.');
  end if;
  if coalesce(trim(p_company_name), '') = '' or coalesce(trim(p_designation), '') = ''
     or coalesce(trim(p_company_website), '') = '' or coalesce(trim(p_linkedin_url), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Company name, website, designation and LinkedIn are required.');
  end if;

  select status into v_existing from public.recruiters where id = auth.uid();
  if v_existing in ('approved', 'suspended') then
    return jsonb_build_object('ok', false, 'error', 'Your recruiter account is already ' || v_existing || '.');
  end if;

  insert into public.recruiters
    (id, company_name, company_website, designation, linkedin_url, gstin, cin, work_email, status)
  values
    (auth.uid(), trim(p_company_name), trim(p_company_website), trim(p_designation),
     trim(p_linkedin_url), nullif(trim(p_gstin), ''), nullif(trim(p_cin), ''), v_email, 'pending')
  on conflict (id) do update set
    company_name = excluded.company_name, company_website = excluded.company_website,
    designation = excluded.designation, linkedin_url = excluded.linkedin_url,
    gstin = excluded.gstin, cin = excluded.cin, work_email = excluded.work_email,
    status = 'pending', review_note = null, reviewed_by = null, reviewed_at = null;

  return jsonb_build_object('ok', true);
end;
$$;

-- Admin approves / rejects / suspends.
create or replace function public.admin_review_recruiter(
  p_recruiter_id uuid, p_status text, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_admin_name text;
  v_target     text;
begin
  if not public.is_admin() then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_status not in ('approved', 'rejected', 'suspended') then
    return jsonb_build_object('ok', false, 'error', 'Invalid status');
  end if;

  update public.recruiters
     set status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_recruiter_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Recruiter not found'); end if;

  select full_name into v_admin_name from public.profiles where id = auth.uid();
  select full_name into v_target     from public.profiles where id = p_recruiter_id;

  insert into public.admin_activity_log (admin_id, action, target_user_id, details, admin_name, target_name)
  values (auth.uid(), 'recruiter_' || p_status, p_recruiter_id, coalesce(p_note, ''), v_admin_name, v_target);

  insert into public.notifications (user_id, title, message, type)
  values (p_recruiter_id,
          case p_status when 'approved' then 'Recruiter account approved'
                        when 'rejected' then 'Recruiter application rejected'
                        else 'Recruiter account suspended' end,
          coalesce(p_note, ''), 'info');

  return jsonb_build_object('ok', true);
end;
$$;

-- When a recruiter stops being approved, close all their jobs.
create or replace function public.close_jobs_when_recruiter_unapproved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'approved' and old.status = 'approved' then
    update public.jobs set status = 'inactive' where recruiter_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_close_jobs_when_recruiter_unapproved on public.recruiters;
create trigger trg_close_jobs_when_recruiter_unapproved
  after update on public.recruiters
  for each row execute function public.close_jobs_when_recruiter_unapproved();

-- ── 4. RECRUITER JOBS ────────────────────────────────────────────
alter table public.jobs
  add column if not exists recruiter_id   uuid references public.profiles(id) on delete set null,
  add column if not exists recruiter_name text;

create index if not exists idx_jobs_recruiter on public.jobs(recruiter_id);

-- Force ownership and visibility for recruiter-written rows. Recruiters
-- cannot spoof company, name, or widen visibility to free users.
create or replace function public.enforce_recruiter_job_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company text;
  v_name    text;
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
  return new;
end;
$$;
drop trigger if exists trg_enforce_recruiter_job_fields on public.jobs;
create trigger trg_enforce_recruiter_job_fields
  before insert or update on public.jobs
  for each row execute function public.enforce_recruiter_job_fields();

drop policy if exists "Recruiters manage own jobs" on public.jobs;
create policy "Recruiters manage own jobs"
  on public.jobs for all
  using (recruiter_id = auth.uid() and public.is_approved_recruiter())
  with check (recruiter_id = auth.uid() and public.is_approved_recruiter());

-- IMPORTANT: schema.sql defines a policy that lets ANY signed-in user
-- (including free) SELECT active jobs directly, bypassing plan_visibility.
-- Candidates read jobs through get_eligible_jobs() (SECURITY DEFINER), so
-- this policy is not needed and would leak recruiter jobs to free users.
drop policy if exists "All authenticated users view active jobs" on public.jobs;

-- get_eligible_jobs() already filters by plan_visibility and returns
-- `select * from jobs`, so recruiter_name flows through unchanged.

-- ── 5. CANDIDATE OPT-IN + PAID CHECK ─────────────────────────────
alter table public.profiles
  add column if not exists recruiter_visible boolean not null default false;

-- "Paid" = active, non-free, unexpired plan. Trial plans count.
-- To exclude trials, add:  and not s.is_trial
create or replace function public.is_paid_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      and s.plan <> 'free'
      and s.ends_at > now()
  );
$$;

-- ── 6. VIEW LOG + INVITES ────────────────────────────────────────
create table if not exists public.recruiter_profile_views (
  id            uuid primary key default gen_random_uuid(),
  recruiter_id  uuid not null references public.profiles(id) on delete cascade,
  candidate_id  uuid not null references public.profiles(id) on delete cascade,
  viewed_at     timestamptz not null default now()
);
create index if not exists idx_rpv_recruiter on public.recruiter_profile_views(recruiter_id, viewed_at desc);
create index if not exists idx_rpv_candidate on public.recruiter_profile_views(candidate_id, viewed_at desc);
alter table public.recruiter_profile_views enable row level security;
drop policy if exists "Recruiters view own view log" on public.recruiter_profile_views;
create policy "Recruiters view own view log"
  on public.recruiter_profile_views for select using (auth.uid() = recruiter_id);
drop policy if exists "Admins view all view logs" on public.recruiter_profile_views;
create policy "Admins view all view logs"
  on public.recruiter_profile_views for select using (public.is_admin());

create table if not exists public.recruiter_invites (
  id            uuid primary key default gen_random_uuid(),
  recruiter_id  uuid not null references public.profiles(id) on delete cascade,
  candidate_id  uuid not null references public.profiles(id) on delete cascade,
  job_id        uuid references public.jobs(id) on delete set null,
  invite_type   text not null check (invite_type in ('assessment','interview')),
  message       text check (char_length(message) <= 1000),
  email_sent_at timestamptz,          -- unused: invites are emailed by the recruiter from their own mailbox
  created_at    timestamptz not null default now()
);
create index if not exists idx_ri_candidate on public.recruiter_invites(candidate_id, created_at desc);
alter table public.recruiter_invites enable row level security;
drop policy if exists "Recruiters view own invites" on public.recruiter_invites;
create policy "Recruiters view own invites"
  on public.recruiter_invites for select using (auth.uid() = recruiter_id);
drop policy if exists "Candidates view invites sent to them" on public.recruiter_invites;
create policy "Candidates view invites sent to them"
  on public.recruiter_invites for select using (auth.uid() = candidate_id);
drop policy if exists "Admins view all invites" on public.recruiter_invites;
create policy "Admins view all invites"
  on public.recruiter_invites for select using (public.is_admin());

-- ── 7. RECRUITER RPCs ────────────────────────────────────────────

-- Search: NO name beyond first name, NO contact, NO salary.
create or replace function public.recruiter_search_candidates(
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
    where p.recruiter_visible
      and p.account_status = 'active'
      and not p.is_admin
      and p.user_type is not null
      and public.is_paid_user(p.id)
      and (p_passout is null or sd.passout_year = p_passout)
      and (p_min_exp is null or pd.years_experience >= p_min_exp)
      and (
        coalesce(cardinality(p_skills), 0) = 0
        or exists (
          select 1 from unnest(coalesce(sd.technical_skills, pd.technical_skills)) s
          where lower(s) in (select lower(x) from unnest(p_skills) x)
        )
      )
    order by p.last_login desc nulls last
    limit least(coalesce(p_limit, 20), 20)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Open a full profile. This is the only path that returns contact details.
-- Logs the view, enforces a daily cap, and notifies the candidate.
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

-- Send an assessment / interview invite. Requires a recent profile view.
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

-- ── 8. LOCK DOWN EXECUTE ─────────────────────────────────────────
revoke execute on function public.block_free_email_recruiter_signup() from public, anon, authenticated;
revoke execute on function public.close_jobs_when_recruiter_unapproved() from public, anon, authenticated;
revoke execute on function public.enforce_recruiter_job_fields()          from public, anon, authenticated;

revoke execute on function public.is_approved_recruiter()                 from public, anon;
revoke execute on function public.is_paid_user(uuid)                      from public, anon;
revoke execute on function public.apply_as_recruiter(text,text,text,text,text,text) from public, anon;
revoke execute on function public.admin_review_recruiter(uuid,text,text)  from public, anon;
revoke execute on function public.recruiter_search_candidates(text[],numeric,int,int,int) from public, anon;
revoke execute on function public.recruiter_view_candidate(uuid)          from public, anon;
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
