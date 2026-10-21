-- Country used for pricing/currency. Chosen once at signup (or once on
-- the payment page for existing users), then locked: a signed-in user
-- can set it while it is NULL, never change it afterwards. Service role
-- (support / admin) can still correct it.

alter table public.profiles
  add column if not exists pricing_country text;

alter table public.profiles
  drop constraint if exists profiles_pricing_country_check;
alter table public.profiles
  add constraint profiles_pricing_country_check
  check (pricing_country is null or pricing_country in
    ('IN','US','GB','CA','AU','NZ','SG','DE','FR','IE','NL','ES','IT'));

alter table public.subscriptions
  add column if not exists currency text not null default 'INR';

create or replace function public.lock_pricing_country()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated'
     and tg_op = 'UPDATE'
     and old.pricing_country is not null then
    new.pricing_country := old.pricing_country;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_pricing_country on public.profiles;
create trigger trg_lock_pricing_country
  before update on public.profiles
  for each row
  execute function public.lock_pricing_country();

-- Signup: copy pricing_country from auth metadata (validated; an
-- unknown value is ignored rather than failing the whole signup).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  _full text; _first text; _last text;
  _is_recruiter boolean := coalesce(new.raw_user_meta_data->>'account_type', '') = 'recruiter';
  _pc text := upper(nullif(new.raw_user_meta_data->>'pricing_country', ''));
begin
  if _pc is not null and _pc not in ('IN','US','GB','CA','AU','NZ','SG','DE','FR','IE','NL','ES','IT') then
    _pc := null;
  end if;
  _full  := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  _first := coalesce(new.raw_user_meta_data->>'given_name',  split_part(_full, ' ', 1));
  _last  := coalesce(new.raw_user_meta_data->>'family_name',
              case when position(' ' in _full) > 0
                   then substring(_full from position(' ' in _full) + 1)
                   else null end);
  insert into public.profiles (id, full_name, first_name, last_name, email, avatar_url, account_status, pricing_country)
  values (new.id, _full, _first, _last, new.email, new.raw_user_meta_data->>'avatar_url',
          case when new.email_confirmed_at is not null then 'active' else 'pending_onboarding' end,
          _pc)
  on conflict (id) do nothing;

  if not _is_recruiter then
    insert into public.subscriptions (user_id, plan, amount_paise, status, starts_at)
    values (new.id, 'free', 0, 'active', now())
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

-- Existing users signed up before country selection existed and were
-- all billed in INR: lock them to India so they never see a picker.
update public.profiles set pricing_country = 'IN' where pricing_country is null;
