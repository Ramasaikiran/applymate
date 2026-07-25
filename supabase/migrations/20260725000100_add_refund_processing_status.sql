-- Adds a transient 'refund_processing' status so request-refund can
-- atomically "claim" a subscription before calling Razorpay's refund
-- API. Without this, two near-simultaneous refund requests (e.g. a
-- double-click, or a retried request after a slow network) could both
-- pass the `status = 'active'` eligibility check before either write
-- landed, and both would successfully call Razorpay — refunding the
-- same subscription twice.

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('pending','active','expired','cancelled','failed','refunded','refund_processing'));
