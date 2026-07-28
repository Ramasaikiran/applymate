-- ================================================================
-- MIGRATION — Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ================================================================

-- ── 1. ADD NEW COLUMNS TO PROFILES ───────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name      text,
  ADD COLUMN IF NOT EXISTS last_name       text,
  ADD COLUMN IF NOT EXISTS mobile_number   text,
  ADD COLUMN IF NOT EXISTS linkedin_url    text,
  ADD COLUMN IF NOT EXISTS github_url      text,
  ADD COLUMN IF NOT EXISTS photo_url       text,
  ADD COLUMN IF NOT EXISTS country         text,
  ADD COLUMN IF NOT EXISTS address         text,
  ADD COLUMN IF NOT EXISTS role_interests  text[] default '{}',
  ADD COLUMN IF NOT EXISTS user_type       text check (user_type in ('student','professional')),
  ADD COLUMN IF NOT EXISTS is_admin        boolean not null default false,
  ADD COLUMN IF NOT EXISTS account_status  text not null default 'active'
                             check (account_status in ('pending_onboarding','active','suspended')),
  ADD COLUMN IF NOT EXISTS last_login      timestamptz;

-- ── 2. CREATE STUDENT DETAILS TABLE ──────────────────────────────
create table if not exists public.student_details (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  college_name        text,
  degree              text,
  branch              text,
  current_year        text,
  passout_year        int,
  cgpa                numeric(4,2),
  internship_done     boolean not null default false,
  internship_details  text,
  technical_skills    text[] default '{}',
  projects            text,
  resume_url          text,
  updated_at          timestamptz not null default now()
);

alter table public.student_details enable row level security;

drop policy if exists "Users manage their student details" on public.student_details;
create policy "Users manage their student details"
  on public.student_details for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- ── 3. CREATE PROFESSIONAL DETAILS TABLE ─────────────────────────
create table if not exists public.professional_details (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  years_experience    numeric(4,1),
  previous_job_title  text,
  previous_company    text,
  previous_salary     numeric(12,2),
  notice_period       boolean not null default false,
  notice_period_days  int,
  technical_skills    text[] default '{}',
  resume_url          text,
  updated_at          timestamptz not null default now()
);

alter table public.professional_details enable row level security;

drop policy if exists "Users manage their professional details" on public.professional_details;
create policy "Users manage their professional details"
  on public.professional_details for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- ── 4. CREATE SUBSCRIPTIONS TABLE ────────────────────────────────
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  plan                  text not null check (plan in ('monthly','quarterly','halfyearly','yearly')),
  amount_paise          int not null,
  status                text not null default 'pending'
                          check (status in ('pending','active','expired','cancelled','failed')),
  payu_txnid            text unique,
  payu_mihpayid         text unique,
  payu_hash             text,
  starts_at             timestamptz,
  ends_at               timestamptz,
  created_at            timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users view own subscriptions"   on public.subscriptions;
drop policy if exists "Users insert own subscriptions" on public.subscriptions;
create policy "Users view own subscriptions"
  on public.subscriptions for select using (auth.uid() = user_id);
create policy "Users insert own subscriptions"
  on public.subscriptions for insert with check (auth.uid() = user_id);

-- ── 5. CREATE JOBS TABLE ─────────────────────────────────────────
create table if not exists public.jobs (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  company                 text not null,
  description             text,
  required_skills         text[] default '{}',
  required_experience_min numeric(4,1) default 0,
  required_experience_max numeric(4,1),
  job_type                text check (job_type in ('full-time','internship','contract','part-time')),
  role_category           text,
  location                text,
  country                 text,
  salary_min              numeric(12,2),
  salary_max              numeric(12,2),
  apply_url               text,
  is_active               boolean not null default true,
  posted_at               timestamptz not null default now(),
  created_by              uuid references public.profiles(id)
);

alter table public.jobs enable row level security;

drop policy if exists "Admins manage all jobs" on public.jobs;
create policy "Admins manage all jobs"
  on public.jobs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ── 6. CREATE JOB APPLICATIONS TABLE ─────────────────────────────
create table if not exists public.job_applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  job_id          uuid references public.jobs(id) on delete set null,
  job_title       text,
  company         text,
  admin_id        uuid references public.profiles(id),
  status          text not null default 'applied'
                    check (status in ('applied','shortlisted','interview','rejected','hired')),
  matched_skills  text[] default '{}',
  applied_at      timestamptz not null default now(),
  notes           text
);

alter table public.job_applications enable row level security;

drop policy if exists "Users view own applications"    on public.job_applications;
drop policy if exists "Admins manage all applications" on public.job_applications;
create policy "Users view own applications"
  on public.job_applications for select using (auth.uid() = user_id);
create policy "Admins manage all applications"
  on public.job_applications for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ── 7. APPLICATION STATS FUNCTION ────────────────────────────────
create or replace function public.get_application_stats(p_user_id uuid)
returns json language plpgsql security definer as $$
begin
  return json_build_object(
    'last_7_days',   (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '7 days'),
    'last_30_days',  (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '30 days'),
    'last_90_days',  (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '90 days'),
    'last_365_days', (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '365 days'),
    'all_time',      (select count(*) from public.job_applications where user_id = p_user_id),
    'shortlisted',   (select count(*) from public.job_applications where user_id = p_user_id and status = 'shortlisted'),
    'hired',         (select count(*) from public.job_applications where user_id = p_user_id and status = 'hired')
  );
end;
$$;

create or replace function public.get_matched_jobs_count(p_user_id uuid)
returns int language plpgsql security definer as $$
declare
  user_skills text[];
  matched int;
begin
  select technical_skills into user_skills from public.student_details where id = p_user_id;
  if user_skills is null then
    select technical_skills into user_skills from public.professional_details where id = p_user_id;
  end if;
  if user_skills is null then return 0; end if;
  select count(*) into matched from public.jobs where is_active = true and required_skills && user_skills;
  return matched;
end;
$$;

-- ── 8. STORAGE BUCKETS ───────────────────────────────────────────
-- NOTE: If these fail, create manually in Supabase Dashboard → Storage
insert into storage.buckets (id, name, public) values ('photos',  'photos',  true)  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false) on conflict (id) do nothing;

-- ── 9. SET YOUR ACCOUNT AS ADMIN ─────────────────────────────────
-- UPDATE public.profiles SET is_admin = true WHERE email = 'ramasaikiranm@gmail.com';

-- ── DONE ─────────────────────────────────────────────────────────
select 'Migration complete ✓' as status;

-- ── RATE LIMITING TABLE ───────────────────────────────────────────
create table if not exists public.rate_limits (
  id         uuid primary key default gen_random_uuid(),
  identifier text not null,           -- IP or user_id
  action     text not null,           -- 'signup', 'payment', 'order'
  hit_at     timestamptz not null default now()
);
create index if not exists idx_rate_limits_lookup on public.rate_limits(identifier, action, hit_at);
-- Auto-delete entries older than 1 hour
create or replace function public.check_rate_limit(
  p_identifier text, p_action text, p_max_hits int, p_window_minutes int
) returns boolean language plpgsql security definer as $$
declare
  hit_count int;
begin
  -- Clean old entries
  delete from public.rate_limits
  where identifier = p_identifier and action = p_action
    and hit_at < now() - (p_window_minutes || ' minutes')::interval;
  -- Count recent hits
  select count(*) into hit_count from public.rate_limits
  where identifier = p_identifier and action = p_action;
  if hit_count >= p_max_hits then return false; end if;
  -- Record this hit
  insert into public.rate_limits (identifier, action) values (p_identifier, p_action);
  return true;
end;
$$;

-- ── SIGNUP PROGRESSIVE RATE LIMIT ──────────────────────────────────
-- attempt 1: immediate. attempt 2: needs 30s gap. attempt 3: needs 60s
-- gap. attempt 4+: blocked for 2 hours from 3rd attempt.
create or replace function public.check_signup_rate_limit(p_ip text)
returns jsonb language plpgsql security definer as $$
declare
  hits timestamptz[];
  cnt int;
  last_hit timestamptz;
  third_hit timestamptz;
  now_ts timestamptz := now();
begin
  delete from public.rate_limits
  where identifier = p_ip and action = 'signup' and hit_at < now_ts - interval '2 hours';

  select array_agg(hit_at order by hit_at) into hits
  from public.rate_limits where identifier = p_ip and action = 'signup';

  cnt := coalesce(array_length(hits, 1), 0);

  if cnt >= 3 then
    third_hit := hits[3];
    if now_ts - third_hit < interval '2 hours' then
      return jsonb_build_object('allowed', false,
        'retry_after_seconds', ceil(extract(epoch from (third_hit + interval '2 hours' - now_ts)))::int,
        'reason', 'cooldown');
    end if;
    delete from public.rate_limits where identifier = p_ip and action = 'signup';
    cnt := 0;
  end if;

  if cnt >= 1 then
    last_hit := hits[cnt];
    declare required_gap interval := case cnt when 1 then interval '30 seconds' else interval '60 seconds' end;
    begin
      if now_ts - last_hit < required_gap then
        return jsonb_build_object('allowed', false,
          'retry_after_seconds', ceil(extract(epoch from (last_hit + required_gap - now_ts)))::int,
          'reason', 'delay');
      end if;
    end;
  end if;

  insert into public.rate_limits (identifier, action) values (p_ip, 'signup');
  return jsonb_build_object('allowed', true);
end;
$$;

-- ── ONE IDENTITY PER ACCOUNT ──────────────────────────────────────
-- Prevent changing user_type once it's been set
-- Prevent admin from being a student or professional simultaneously

CREATE OR REPLACE FUNCTION public.enforce_single_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Admin accounts cannot have a user_type
  IF NEW.is_admin = true AND NEW.user_type IS NOT NULL THEN
    RAISE EXCEPTION 'Admin accounts cannot be registered as student or professional.';
  END IF;

  -- user_type cannot be changed once set (prevents re-registration as different role)
  IF OLD.user_type IS NOT NULL AND NEW.user_type IS NOT NULL AND OLD.user_type != NEW.user_type THEN
    RAISE EXCEPTION 'Account role cannot be changed. You are already registered as %.', OLD.user_type;
  END IF;

  -- Cannot become admin if already registered as student/professional
  IF OLD.user_type IS NOT NULL AND NEW.is_admin = true THEN
    RAISE EXCEPTION 'A student or professional account cannot be converted to admin.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_identity_trigger ON public.profiles;
CREATE TRIGGER enforce_single_identity_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_identity();
