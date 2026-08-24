-- Public status page: components + incident log.
-- Read: anyone (including anonymous visitors on the public /status page).
-- Write: admins only, via the existing is_admin() helper.

create table if not exists public.status_components (
  id          text primary key,               -- stable slug, e.g. 'website'
  name        text not null,
  status      text not null default 'operational'
              check (status in ('operational', 'degraded', 'down')),
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.status_incidents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  message      text not null,
  component_id text references public.status_components(id) on delete set null,
  status       text not null default 'investigating'
               check (status in ('investigating', 'monitoring', 'resolved')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

alter table public.status_components enable row level security;
alter table public.status_incidents  enable row level security;

create policy "status_components_public_read"
  on public.status_components for select
  using (true);

create policy "status_components_admin_write"
  on public.status_components for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "status_incidents_public_read"
  on public.status_incidents for select
  using (true);

create policy "status_incidents_admin_write"
  on public.status_incidents for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed the components that actually make up the product today.
insert into public.status_components (id, name, sort_order) values
  ('website',       'Website (applymate.in)',     1),
  ('database',       'Database',                   2),
  ('applications',   'Application Engine',         3),
  ('payments',       'Payments (Razorpay)',        4)
on conflict (id) do nothing;
