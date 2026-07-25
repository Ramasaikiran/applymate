-- ================================================================
-- Fix: the "Users can update their own profile" RLS policy allows
-- any signed-in user to update ANY column on their own row via the
-- browser client — including `is_admin` and `account_status`. That
-- means a normal user could currently run:
--   supabase.from('profiles').update({ is_admin: true }).eq('id', myId)
-- and grant themselves admin access, or reverse their own suspension.
--
-- RLS policies in Postgres can't restrict individual columns, so we
-- lock these two columns with a trigger instead: any UPDATE coming
-- from a normal authenticated session gets these columns silently
-- reset to their previous value. Service-role calls (edge functions,
-- admin actions, the handle_new_user()/cron paths) are unaffected.
-- ================================================================

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only block updates made by a logged-in end user via the normal
  -- supabase-js client (auth.role() = 'authenticated'). Internal
  -- triggers (e.g. handle_email_confirmed on auth.users), SQL run
  -- directly in the dashboard, and edge functions using the service
  -- role key all have auth.role() other than 'authenticated' and are
  -- left untouched.
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  new.is_admin := old.is_admin;
  new.account_status := old.account_status;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns();
