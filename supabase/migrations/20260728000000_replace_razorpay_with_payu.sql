-- Replace Razorpay payment fields with PayU equivalents on subscriptions.
-- Uses IF EXISTS guards so this is safe to run whether or not
-- refund_migration.sql (razorpay_refund_id) was already applied.

alter table public.subscriptions rename column razorpay_order_id to payu_txnid;
alter table public.subscriptions rename column razorpay_payment_id to payu_mihpayid;
alter table public.subscriptions rename column razorpay_signature to payu_hash;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'razorpay_refund_id'
  ) then
    alter table public.subscriptions rename column razorpay_refund_id to payu_refund_id;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'payu_refund_id'
  ) then
    alter table public.subscriptions add column payu_refund_id text;
  end if;
end $$;

alter table public.subscriptions
  drop constraint if exists subscriptions_razorpay_order_id_key,
  drop constraint if exists subscriptions_razorpay_payment_id_key;

alter table public.subscriptions
  add constraint subscriptions_payu_txnid_key unique (payu_txnid),
  add constraint subscriptions_payu_mihpayid_key unique (payu_mihpayid);
