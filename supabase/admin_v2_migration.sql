-- ================================================================
-- ApplyMate — Admin v2 Migration
-- Run this whole file once in Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE everywhere).
-- ================================================================

-- ── 1. PROFILE: job preference fields ────────────────────────────
alter table public.profiles add column if not exists portfolio_url       text;
alter table public.profiles add column if not exists preferred_locations text[] default '{}';
alter table public.profiles add column if not exists salary_expectation  numeric(12,2);
alter table public.profiles add column if not exists employment_type     text
  check (employment_type in ('full-time','internship','contract','part-time'));
alter table public.profiles add column if not exists work_preference     text
  check (work_preference in ('remote','hybrid','onsite'));

-- ── 2. JOB APPLICATIONS: extended status + job_url ───────────────
alter table public.job_applications drop constraint if exists job_applications_status_check;
alter table public.job_applications add constraint job_applications_status_check
  check (status in ('applied','assessment','interview','hr_round','rejected','offer','joined','shortlisted','hired'));
alter table public.job_applications add column if not exists job_url text;

-- back-fill: treat legacy 'shortlisted' as 'assessment', 'hired' as 'offer' for new admin UI continuity
-- (left as-is in DB; frontend displays both old + new labels)

-- ── 3. ADMIN ACTIVITY LOG ─────────────────────────────────────────
create table if not exists public.admin_activity_log (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid references public.profiles(id) on delete set null,
  action          text not null,            -- e.g. 'applied_job', 'updated_status', 'renewed_subscription'
  target_user_id  uuid references public.profiles(id) on delete set null,
  details         text,
  created_at      timestamptz not null default now()
);

alter table public.admin_activity_log enable row level security;
drop policy if exists "Admins view activity log" on public.admin_activity_log;
create policy "Admins view activity log"
  on public.admin_activity_log for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
drop policy if exists "Admins insert activity log" on public.admin_activity_log;
create policy "Admins insert activity log"
  on public.admin_activity_log for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create index if not exists idx_activity_log_created on public.admin_activity_log(created_at desc);
create index if not exists idx_activity_log_target   on public.admin_activity_log(target_user_id);

-- ── 4. NOTIFICATIONS (user-facing) ───────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  message     text,
  type        text not null default 'info', -- 'application' | 'interview' | 'subscription' | 'info'
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;
drop policy if exists "Users view own notifications" on public.notifications;
create policy "Users view own notifications"
  on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "Admins manage all notifications" on public.notifications;
create policy "Admins manage all notifications"
  on public.notifications for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

-- ── 5. DASHBOARD STATS FUNCTION ───────────────────────────────────
create or replace function public.get_admin_dashboard_stats()
returns json language plpgsql security definer set search_path = public as $$
declare
  result json;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select json_build_object(
    'total_users',           (select count(*) from public.profiles where is_admin = false),
    'active_subscribers',    (select count(*) from public.subscriptions where status = 'active' and ends_at > now()),
    'apps_today',             (select count(*) from public.job_applications where applied_at >= current_date),
    'apps_week',              (select count(*) from public.job_applications where applied_at >= now() - interval '7 days'),
    'apps_month',             (select count(*) from public.job_applications where applied_at >= now() - interval '30 days'),
    'total_interviews',       (select count(*) from public.job_applications where status in ('interview','hr_round')),
    'total_offers',           (select count(*) from public.job_applications where status in ('offer','joined','hired')),
    'expiring_subscriptions', (select count(*) from public.subscriptions where status = 'active'
                                  and ends_at between now() and now() + interval '7 days')
  ) into result;
  return result;
end;
$$;

-- ── 6. PER-USER STATS (apps / interviews / rejections / offers) ──
create or replace function public.get_user_app_stats(p_user_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  result json;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select json_build_object(
    'total_applications', (select count(*) from public.job_applications where user_id = p_user_id),
    'interviews',          (select count(*) from public.job_applications where user_id = p_user_id and status in ('interview','hr_round')),
    'rejections',          (select count(*) from public.job_applications where user_id = p_user_id and status = 'rejected'),
    'offers',              (select count(*) from public.job_applications where user_id = p_user_id and status in ('offer','joined','hired'))
  ) into result;
  return result;
end;
$$;

-- ── 7. LOG + NOTIFY ON ADMIN APPLY ────────────────────────────────
create or replace function public.log_job_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.admin_id is not null then
    insert into public.admin_activity_log (admin_id, action, target_user_id, details)
    values (new.admin_id, 'applied_job', new.user_id,
      coalesce(new.job_title, 'a role') || ' at ' || coalesce(new.company, 'a company'));

    insert into public.notifications (user_id, title, message, type)
    values (new.user_id, 'New application submitted',
      'Applied to ' || coalesce(new.job_title, 'a role') || ' at ' || coalesce(new.company, 'a company'),
      'application');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_job_application_insert on public.job_applications;
create trigger trg_log_job_application_insert
  after insert on public.job_applications
  for each row execute procedure public.log_job_application_insert();

-- ── 8. LOG ON STATUS UPDATE ───────────────────────────────────────
create or replace function public.log_job_application_status_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.admin_activity_log (admin_id, action, target_user_id, details)
    values (auth.uid(), 'updated_status', new.user_id,
      coalesce(new.job_title,'Application') || ' → ' || new.status);

    insert into public.notifications (user_id, title, message, type)
    values (new.user_id, 'Application status updated',
      coalesce(new.job_title,'Your application') || ' is now "' || new.status || '"', 'interview');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_job_application_status on public.job_applications;
create trigger trg_log_job_application_status
  after update on public.job_applications
  for each row execute procedure public.log_job_application_status_update();

-- ── 9. LOG ON SUBSCRIPTION CHANGE (renew/cancel/extend/upgrade) ──
create or replace function public.log_subscription_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status or new.ends_at is distinct from old.ends_at then
    insert into public.admin_activity_log (admin_id, action, target_user_id, details)
    values (auth.uid(), 'subscription_change', new.user_id,
      new.plan || ' → status: ' || new.status ||
      case when new.ends_at is not null then ', expires ' || to_char(new.ends_at, 'DD Mon YYYY') else '' end);

    insert into public.notifications (user_id, title, message, type)
    values (new.user_id, 'Subscription updated',
      'Your ' || new.plan || ' plan is now ' || new.status || '.', 'subscription');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_subscription_update on public.subscriptions;
create trigger trg_log_subscription_update
  after update on public.subscriptions
  for each row execute procedure public.log_subscription_update();

-- ── 10. ALLOW ADMIN UPDATE/INSERT ON SUBSCRIPTIONS ────────────────
drop policy if exists "Admins manage subscriptions" on public.subscriptions;
create policy "Admins manage subscriptions"
  on public.subscriptions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
drop policy if exists "Admins insert subscriptions" on public.subscriptions;
create policy "Admins insert subscriptions"
  on public.subscriptions for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ── 11. RELOAD SCHEMA CACHE ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
