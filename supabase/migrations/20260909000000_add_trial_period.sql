-- 7-day trial support for basic / pro / maxpro plans.
-- duration_days lets a subscription run for something other than the
-- normal 30 days (trials) without needing new values in the `plan`
-- column — a trial subscription still has plan='basic' etc, it just
-- has duration_days=7 and is_trial=true instead of the usual 30.
alter table public.subscriptions
  add column if not exists duration_days int not null default 30,
  add column if not exists is_trial boolean not null default false;

-- One trial per user, ever, across any plan. Used by
-- create-razorpay-order to reject a second trial attempt server-side
-- (never trust a client-sent "trial" flag alone).
create index if not exists subscriptions_user_trial_idx
  on public.subscriptions (user_id) where is_trial;
