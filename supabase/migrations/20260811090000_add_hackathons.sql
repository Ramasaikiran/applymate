-- ══════════════════════════════════════════════════════════════════
-- HACKATHON DISCOVERY MIGRATION
-- Mirrors jobs / saved_jobs pattern for hackathon listings.
-- ══════════════════════════════════════════════════════════════════

-- ── Hackathons table ─────────────────────────────────────────────
create table if not exists public.hackathons (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  organizer         text not null,
  description       text,
  mode              text check (mode in ('online','offline','hybrid')),
  location          text,
  tags              text[] not null default '{}',
  prize_pool        text,
  team_size_min     int,
  team_size_max     int,
  register_url      text,
  start_date        date,
  end_date          date,
  last_date         date,
  status            text not null default 'draft'
                       check (status in ('draft','published','inactive')),
  is_active         boolean not null default true,
  posted_at         timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_hackathons_touch on public.hackathons;
create trigger trg_hackathons_touch before update on public.hackathons
  for each row execute function public.touch_updated_at();

-- ── Saved hackathons ─────────────────────────────────────────────
create table if not exists public.saved_hackathons (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, hackathon_id)
);
alter table public.saved_hackathons enable row level security;
drop policy if exists "users manage own saved hackathons" on public.saved_hackathons;
create policy "users manage own saved hackathons" on public.saved_hackathons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Published hackathons RPC — readable by any signed-in user ──────
create or replace function public.get_published_hackathons()
returns setof public.hackathons language sql security definer
set search_path = public as $$
  select * from public.hackathons
  where status = 'published'
  order by posted_at desc;
$$;

-- ── Hackathons RLS: only admin can write ───────────────────────────
alter table public.hackathons enable row level security;
drop policy if exists "admin manages hackathons" on public.hackathons;
create policy "admin manages hackathons" on public.hackathons
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

select 'Hackathons migration complete ✓' as status;
