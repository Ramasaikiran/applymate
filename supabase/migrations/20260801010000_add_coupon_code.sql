-- Track which coupon (if any) was applied to a subscription payment.
alter table public.subscriptions
  add column if not exists coupon_code text;
