-- ================================================================
-- Follow-up to 20260725000000_lock_profile_privileged_columns.sql.
--
-- That migration locked is_admin/account_status against UPDATE, but
-- 20260724_add_profiles_insert_policy.sql (added afterward, for a
-- real OAuth race-condition fix) gave authenticated users an INSERT
-- policy on their own row with no column restriction either. INSERT
-- has no `old` row to fall back to, so the existing trigger doesn't
-- cover it — a user could call:
--   supabase.from('profiles').insert({ id: myId, is_admin: true, ... })
-- and, if their row hadn't already been created by the signup
-- trigger yet, grant themselves admin on their very first row.
--
-- This adds the matching BEFORE INSERT guard: any insert coming from
-- an authenticated end-user session gets these two columns forced to
-- safe defaults, regardless of what was submitted. Service-role
-- inserts (the handle_new_user() trigger, edge functions) are
-- unaffected, same as the UPDATE guard.
-- ================================================================

create or replace function public.protect_profile_privileged_columns_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  new.is_admin := false;
  -- The OAuth fallback in AuthCallback.tsx legitimately inserts with
  -- account_status: 'active' for an already-verified OAuth user — that
  -- value is allowed through. Anything else (in particular 'suspended',
  -- which would be pointless on insert but is blocked for safety
  -- anyway) falls back to the normal starting state.
  if new.account_status is distinct from 'active' then
    new.account_status := 'pending_onboarding';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns_insert on public.profiles;
create trigger trg_protect_profile_privileged_columns_insert
  before insert on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns_insert();
