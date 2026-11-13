-- Performance: indexes for hot queries + one-call admin user overview.

-- NotificationBell polls: where user_id = me order by created_at desc limit 20
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- Dashboard: paginated applications, newest first
create index if not exists idx_job_apps_user_applied
  on public.job_applications (user_id, applied_at desc);

-- Dashboard: latest skipped jobs
create index if not exists idx_job_screening_user_created
  on public.job_screening_log (user_id, created_at desc);

-- Admin > Users used to fire 4 queries PER USER (400+ requests at 100 users).
-- This returns everything in one call. Non-admins get zero rows.
create or replace function public.admin_user_overview()
returns table (
  p_id uuid, sub_plan text, sub_status text, sub_ends_at timestamptz,
  apps_count bigint, skills text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         s.plan, s.status, s.ends_at,
         (select count(*) from public.job_applications a where a.user_id = p.id),
         coalesce(sd.technical_skills, pd.technical_skills, '{}'::text[])
  from public.profiles p
  left join lateral (
    select sb.plan, sb.status, sb.ends_at
    from public.subscriptions sb
    where sb.user_id = p.id
    order by sb.ends_at desc nulls last
    limit 1
  ) s on true
  left join public.student_details sd on sd.id = p.id
  left join public.professional_details pd on pd.id = p.id
  where public.is_admin() and p.is_admin = false;
$$;

revoke all on function public.admin_user_overview() from public;
grant execute on function public.admin_user_overview() to authenticated;
