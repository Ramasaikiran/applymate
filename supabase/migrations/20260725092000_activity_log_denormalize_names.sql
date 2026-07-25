-- Fix: admin_activity_log.target_user_id / admin_id use ON DELETE SET NULL
-- against profiles(id). Deleting a user account was silently wiping the
-- name off every historical audit log row that referenced them, making
-- the admin activity log show blank/unlinked entries.
--
-- Fix: snapshot the name at write time into admin_name / target_name so
-- the audit trail survives account deletion. The FK + SET NULL stays in
-- place (so links can't point at deleted users), but the human-readable
-- name is preserved regardless.

alter table public.admin_activity_log
  add column if not exists admin_name  text,
  add column if not exists target_name text;

-- Backfill whatever is still recoverable right now.
update public.admin_activity_log l
set admin_name = p.full_name
from public.profiles p
where l.admin_id = p.id and l.admin_name is null;

update public.admin_activity_log l
set target_name = p.full_name
from public.profiles p
where l.target_user_id = p.id and l.target_name is null;

create or replace function public.log_job_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin_name  text;
  v_target_name text;
begin
  if new.admin_id is not null then
    select full_name into v_admin_name  from public.profiles where id = new.admin_id;
    select full_name into v_target_name from public.profiles where id = new.user_id;

    insert into public.admin_activity_log (admin_id, action, target_user_id, details, admin_name, target_name)
    values (new.admin_id, 'applied_job', new.user_id,
      coalesce(new.job_title, 'a role') || ' at ' || coalesce(new.company, 'a company'),
      v_admin_name, v_target_name);

    insert into public.notifications (user_id, title, message, type)
    values (new.user_id, 'New application submitted',
      'Applied to ' || coalesce(new.job_title, 'a role') || ' at ' || coalesce(new.company, 'a company'),
      'application');
  end if;
  return new;
end;
$$;

create or replace function public.log_job_application_status_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin_name  text;
  v_target_name text;
begin
  if new.status is distinct from old.status then
    select full_name into v_admin_name  from public.profiles where id = auth.uid();
    select full_name into v_target_name from public.profiles where id = new.user_id;

    insert into public.admin_activity_log (admin_id, action, target_user_id, details, admin_name, target_name)
    values (auth.uid(), 'updated_status', new.user_id,
      coalesce(new.job_title,'Application') || ' → ' || new.status,
      v_admin_name, v_target_name);

    insert into public.notifications (user_id, title, message, type)
    values (new.user_id, 'Application status updated',
      coalesce(new.job_title,'Your application') || ' is now "' || new.status || '"', 'interview');
  end if;
  return new;
end;
$$;

create or replace function public.log_subscription_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin_name  text;
  v_target_name text;
begin
  if new.status is distinct from old.status or new.ends_at is distinct from old.ends_at then
    select full_name into v_admin_name  from public.profiles where id = auth.uid();
    select full_name into v_target_name from public.profiles where id = new.user_id;

    insert into public.admin_activity_log (admin_id, action, target_user_id, details, admin_name, target_name)
    values (auth.uid(), 'subscription_change', new.user_id,
      new.plan || ' → status: ' || new.status ||
      case when new.ends_at is not null then ', expires ' || to_char(new.ends_at, 'DD Mon YYYY') else '' end,
      v_admin_name, v_target_name);

    insert into public.notifications (user_id, title, message, type)
    values (new.user_id, 'Subscription updated',
      'Your ' || new.plan || ' plan is now ' || new.status || '.', 'subscription');
  end if;
  return new;
end;
$$;
