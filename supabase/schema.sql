-- ================================================================
-- ApplyMate — Full Production Schema v2
-- Run in Supabase SQL editor (drop existing tables first if migrating)
-- ================================================================

-- ── 1. PROFILES ──────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null,
  first_name      text,
  last_name       text,
  email           text not null,
  mobile_number   text,
  linkedin_url    text,
  github_url      text,
  avatar_url      text,           -- Google OAuth photo
  photo_url       text,           -- manually uploaded photo
  country         text,
  address         text,
  role_interests  text[] default '{}',
  user_type       text check (user_type in ('student', 'professional')),
  is_admin        boolean not null default false,
  account_status  text not null default 'pending_onboarding'
                    check (account_status in ('pending_onboarding', 'active', 'suspended')),
  created_at      timestamptz not null default now(),
  last_login      timestamptz
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER avoids infinite recursion when policies check is_admin.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Normal signup never needs this — handle_new_user() below runs
-- SECURITY DEFINER and bypasses RLS entirely. This exists for
-- AuthCallback.tsx's client-side fallback insert, which fires when a
-- profile row isn't visible yet right after an OAuth redirect (a real
-- trigger-vs-client race). Without this policy that fallback insert is
-- silently rejected by RLS.
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- ── 2. AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _full text;
  _first text;
  _last text;
begin
  _full  := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  _first := coalesce(new.raw_user_meta_data->>'given_name',  split_part(_full, ' ', 1));
  _last  := coalesce(new.raw_user_meta_data->>'family_name',
            case when position(' ' in _full) > 0
                 then substring(_full from position(' ' in _full) + 1)
                 else null end);
  insert into public.profiles
    (id, full_name, first_name, last_name, email, avatar_url, account_status)
  values (
    new.id, _full, _first, _last, new.email,
    new.raw_user_meta_data->>'avatar_url',
    case when new.email_confirmed_at is not null then 'active' else 'pending_onboarding' end
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 3. EMAIL CONFIRM → ACTIVATE ──────────────────────────────────
create or replace function public.handle_email_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles set account_status = 'active' where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row execute procedure public.handle_email_confirmed();

-- ── 4. TOUCH LAST LOGIN ───────────────────────────────────────────
create or replace function public.touch_last_login()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_login = now() where id = auth.uid();
$$;

-- ── 5. STUDENT DETAILS ───────────────────────────────────────────
create table if not exists public.student_details (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  college_name        text,
  degree              text,         -- 'bachelors', 'masters', 'diploma', etc.
  branch              text,         -- 'Computer Science', 'ECE', etc.
  current_year        text,         -- '1st', '2nd', '3rd', '4th', 'graduated'
  passout_year        int,
  cgpa                numeric(4,2),
  internship_done     boolean not null default false,
  internship_details  text,         -- null or NA if not done
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
drop policy if exists "Admins view all student details" on public.student_details;
create policy "Admins view all student details"
  on public.student_details for select
  using (public.is_admin());

-- ── 6. PROFESSIONAL DETAILS ──────────────────────────────────────
create table if not exists public.professional_details (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  years_experience    numeric(4,1),
  previous_job_title  text,
  previous_company    text,
  previous_salary     numeric(12,2),   -- annual CTC in INR
  notice_period       boolean not null default false,
  notice_period_days  int,             -- 0 / 30 / 60 / 90
  technical_skills    text[] default '{}',
  resume_url          text,
  updated_at          timestamptz not null default now()
);

alter table public.professional_details enable row level security;
drop policy if exists "Users manage their professional details" on public.professional_details;
create policy "Users manage their professional details"
  on public.professional_details for all
  using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Admins view all professional details" on public.professional_details;
create policy "Admins view all professional details"
  on public.professional_details for select
  using (public.is_admin());

-- ── 7. SUBSCRIPTIONS ─────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  plan                  text not null check (plan in ('monthly','quarterly','halfyearly','yearly')),
  amount_paise          int not null,   -- stored in paise (₹1 = 100 paise)
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
drop policy if exists "Users view own subscriptions" on public.subscriptions;
create policy "Users view own subscriptions"
  on public.subscriptions for select using (auth.uid() = user_id);
-- No client-side insert policy: every legitimate row is written server-side
-- (service role, bypasses RLS) by create-payu-order / verify-payu-payment.
-- A "Users insert own subscriptions" policy existed here previously and
-- let any authenticated user POST status='active', amount_paise=0 directly
-- and grant themselves a free paid plan — see migration
-- 20260725130000_remove_vulnerable_subscriptions_insert_policy.sql.
drop policy if exists "Users insert own subscriptions" on public.subscriptions;
drop policy if exists "Admins view all subscriptions" on public.subscriptions;
create policy "Admins view all subscriptions"
  on public.subscriptions for select
  using (public.is_admin());

-- Helper: get active subscription for a user
create or replace function public.get_active_subscription(p_user_id uuid)
returns table (plan text, ends_at timestamptz) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() <> p_user_id and not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
    select s.plan, s.ends_at from public.subscriptions s
    where s.user_id = p_user_id and s.status = 'active' and s.ends_at > now()
    order by s.ends_at desc limit 1;
end;
$$;

-- ── 8. JOBS ──────────────────────────────────────────────────────
create table if not exists public.jobs (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  company               text not null,
  description           text,
  required_skills       text[] default '{}',
  required_experience_min numeric(4,1) default 0,
  required_experience_max numeric(4,1),
  required_passout_year   int,
  job_type              text check (job_type in ('full-time','internship','contract','part-time')),
  role_category         text,    -- 'SDE', 'ML', 'Data', 'Product', etc.
  location              text,
  country               text,
  salary_min            numeric(12,2),
  salary_max            numeric(12,2),
  apply_url             text,
  is_active             boolean not null default true,
  posted_at             timestamptz not null default now(),
  created_by            uuid references public.profiles(id)
);

alter table public.jobs enable row level security;
drop policy if exists "All authenticated users view active jobs" on public.jobs;
create policy "All authenticated users view active jobs"
  on public.jobs for select using (auth.uid() is not null and is_active = true);
drop policy if exists "Admins manage all jobs" on public.jobs;
create policy "Admins manage all jobs"
  on public.jobs for all
  using (public.is_admin());

-- ── 9. JOB APPLICATIONS ──────────────────────────────────────────
create table if not exists public.job_applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  job_id          uuid references public.jobs(id) on delete set null,
  job_title       text,                -- denormalised for history
  company         text,
  admin_id        uuid references public.profiles(id),
  status          text not null default 'applied'
                    check (status in ('applied','shortlisted','interview','rejected','hired')),
  matched_skills  text[] default '{}',
  applied_at      timestamptz not null default now(),
  notes           text
);

alter table public.job_applications enable row level security;
drop policy if exists "Users view own applications" on public.job_applications;
create policy "Users view own applications"
  on public.job_applications for select using (auth.uid() = user_id);
drop policy if exists "Admins manage all applications" on public.job_applications;
create policy "Admins manage all applications"
  on public.job_applications for all
  using (public.is_admin());

-- ── 10. APPLICATION STATS FUNCTION ───────────────────────────────
create or replace function public.get_application_stats(p_user_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  result json;
begin
  if auth.uid() <> p_user_id and not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select json_build_object(
    'last_7_days',  (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '7 days'),
    'last_30_days', (select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '30 days'),
    'last_365_days',(select count(*) from public.job_applications where user_id = p_user_id and applied_at >= now() - interval '365 days'),
    'all_time',     (select count(*) from public.job_applications where user_id = p_user_id),
    'shortlisted',  (select count(*) from public.job_applications where user_id = p_user_id and status = 'shortlisted'),
    'hired',        (select count(*) from public.job_applications where user_id = p_user_id and status = 'hired')
  ) into result;
  return result;
end;
$$;

-- ── 11. MATCHED JOBS FUNCTION ─────────────────────────────────────
-- Returns job count where user skills overlap >= 1 required skill
create or replace function public.get_matched_jobs_count(p_user_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  user_skills text[];
  matched int;
begin
  if auth.uid() <> p_user_id and not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  -- get skills from whichever detail table exists
  select technical_skills into user_skills from public.student_details where id = p_user_id;
  if user_skills is null then
    select technical_skills into user_skills from public.professional_details where id = p_user_id;
  end if;
  if user_skills is null then return 0; end if;

  select count(*) into matched
  from public.jobs
  where is_active = true
    and required_skills && user_skills;   -- && = array overlap

  return matched;
end;
$$;

-- ── 12. STORAGE BUCKETS ───────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)    on conflict (id) do nothing;

drop policy if exists "Users upload own resume" on storage.objects;
create policy "Users upload own resume"
  on storage.objects for insert
  with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users read own resume" on storage.objects;
create policy "Users read own resume"
  on storage.objects for select
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Admins read all resumes" on storage.objects;
create policy "Admins read all resumes"
  on storage.objects for select
  using (bucket_id = 'resumes' and
    public.is_admin());

drop policy if exists "Users upload own photo" on storage.objects;
create policy "Users upload own photo"
  on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Anyone can view photos" on storage.objects;
create policy "Anyone can view photos"
  on storage.objects for select using (bucket_id = 'photos');

-- ── 13. INDEXES ───────────────────────────────────────────────────
create index if not exists idx_job_apps_user_id    on public.job_applications(user_id);
create index if not exists idx_job_apps_applied_at on public.job_applications(applied_at);
create index if not exists idx_subscriptions_user  on public.subscriptions(user_id, status);
create index if not exists idx_jobs_active         on public.jobs(is_active, posted_at desc);

-- ================================================================
-- SETUP CHECKLIST:
-- 1. Auth → Providers → Email + Google
-- 2. Auth → URL Config → add site URL + /auth/callback
-- 3. Set first admin: UPDATE public.profiles SET is_admin = true WHERE email = 'your@email.com';
-- 4. Add PAYU_MERCHANT_KEY + PAYU_MERCHANT_SALT (+ optional PAYU_ENV=production) to Edge Function secrets
-- 5. Deploy edge functions: supabase functions deploy create-payu-order
--                           supabase functions deploy verify-payu-payment
--                           supabase functions deploy request-refund
-- ================================================================
