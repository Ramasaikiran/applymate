-- Public-facing counter for the "land a job, get refunded" promo.
-- Single-row table: claimed_count is updated manually by an admin
-- (via Supabase table editor / service role) once a refund under
-- this program is actually paid out — this is not wired to the
-- automated subscription-refund pipeline, since eligibility depends
-- on manual verification (job proof, podcast opt-in).
create table if not exists public.job_refund_program (
  id int primary key default 1,
  claimed_count int not null default 0,
  total_slots int not null default 10,
  updated_at timestamptz not null default now(),
  constraint job_refund_program_single_row check (id = 1)
);

insert into public.job_refund_program (id, claimed_count, total_slots)
values (1, 0, 10)
on conflict (id) do nothing;

alter table public.job_refund_program enable row level security;

drop policy if exists "job_refund_program_public_read" on public.job_refund_program;
create policy "job_refund_program_public_read"
  on public.job_refund_program for select
  using (true);

-- No insert/update/delete policy for anon/authenticated — only the
-- service role (admin, via dashboard) can change claimed_count.
