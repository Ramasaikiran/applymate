-- "How did you hear about us?" captured at signup, visible to admins.
alter table public.profiles
  add column if not exists referral_source text;

alter table public.profiles
  drop constraint if exists profiles_referral_source_len;
alter table public.profiles
  add constraint profiles_referral_source_len
  check (referral_source is null or char_length(referral_source) <= 200);

-- Copy the answer from signup metadata into the new profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  _full text; _first text; _last text;
  _is_recruiter boolean := coalesce(new.raw_user_meta_data->>'account_type', '') = 'recruiter';
  _pc text := upper(nullif(new.raw_user_meta_data->>'pricing_country', ''));
  _ref text := left(nullif(btrim(new.raw_user_meta_data->>'referral_source'), ''), 200);
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
  insert into public.profiles (id, full_name, first_name, last_name, email, avatar_url, account_status, pricing_country, referral_source)
  values (new.id, _full, _first, _last, new.email, new.raw_user_meta_data->>'avatar_url',
          case when new.email_confirmed_at is not null then 'active' else 'pending_onboarding' end,
          _pc, _ref)
  on conflict (id) do nothing;

  if not _is_recruiter then
    insert into public.subscriptions (user_id, plan, amount_paise, status, starts_at)
    values (new.id, 'free', 0, 'active', now())
    on conflict do nothing;
  end if;

  return new;
end;
$function$;
