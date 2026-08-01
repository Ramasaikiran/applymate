-- Refund support on subscriptions
alter table public.subscriptions
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_reason text check (refund_reason in ('withdrawal','job_found')),
  add column if not exists refund_days_used int,
  add column if not exists refund_gross_paise int,
  add column if not exists refund_fee_paise int,
  add column if not exists refund_net_paise int,
  add column if not exists razorpay_refund_id text,
  add column if not exists refund_status text
    check (refund_status in ('pending','processed','failed'));

-- 'refunded' becomes a valid subscription status
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('pending','active','expired','cancelled','failed','refunded'));
