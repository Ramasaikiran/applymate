-- Replace PayU payment fields with Razorpay equivalents on subscriptions.
-- Uses IF EXISTS guards so this is safe to run whether or not the PayU
-- columns exist under their original PayU names in a given environment.

alter table public.subscriptions rename column payu_txnid to razorpay_order_id;
alter table public.subscriptions rename column payu_mihpayid to razorpay_payment_id;
alter table public.subscriptions rename column payu_hash to razorpay_signature;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'payu_refund_id'
  ) then
    alter table public.subscriptions rename column payu_refund_id to razorpay_refund_id;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'razorpay_refund_id'
  ) then
    alter table public.subscriptions add column razorpay_refund_id text;
  end if;
end $$;

alter table public.subscriptions
  drop constraint if exists subscriptions_payu_txnid_key,
  drop constraint if exists subscriptions_payu_mihpayid_key;

alter table public.subscriptions
  add constraint subscriptions_razorpay_order_id_key unique (razorpay_order_id),
  add constraint subscriptions_razorpay_payment_id_key unique (razorpay_payment_id);
