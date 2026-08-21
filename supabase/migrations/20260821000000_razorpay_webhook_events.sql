create table if not exists public.razorpay_webhook_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.razorpay_webhook_events enable row level security;
-- No public policies: only the service role (used by the webhook
-- function) can read or write this table.
