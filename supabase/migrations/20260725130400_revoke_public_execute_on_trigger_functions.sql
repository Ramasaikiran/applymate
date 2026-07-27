-- These are internal trigger functions, never meant to be called
-- directly — only PostgreSQL's trigger mechanism should invoke them.
-- They were exposed via /rest/v1/rpc/<name> to anon and authenticated
-- because EXECUTE was granted to PUBLIC (which every role inherits
-- from) when they were created. Calling them directly would error
-- (they reference NEW/OLD, which only exist in trigger context)
-- rather than do real damage, but there's no reason to leave the
-- door open. Trigger firing is unaffected — Postgres invokes trigger
-- functions via the table owner's privileges, not the calling role's
-- EXECUTE grant — and service_role/postgres retain their own
-- separate explicit grants, untouched by revoking PUBLIC.

revoke execute on function public.check_free_tier_application_cap() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_email_confirmed() from public;
revoke execute on function public.touch_last_login() from public;
revoke execute on function public.protect_profile_privileged_columns() from public;
revoke execute on function public.protect_profile_privileged_columns_insert() from public;
revoke execute on function public.log_job_application_insert() from public;
revoke execute on function public.log_job_application_status_update() from public;
revoke execute on function public.log_subscription_update() from public;
