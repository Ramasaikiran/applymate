-- Wraps auth.uid() / is_admin() in (select ...) inside every public RLS policy so
-- Postgres evaluates them once per query instead of once per row.
-- Same behaviour, faster on big tables (Supabase advisor: auth_rls_initplan).

-- STEP 1: dry run. Lists the policies that will change. Run this first.
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and (
    (coalesce(qual, '') ~ 'auth\.uid\(\)' and coalesce(qual, '') !~* 'select\s+auth\.uid\(\)')
    or (coalesce(with_check, '') ~ 'auth\.uid\(\)' and coalesce(with_check, '') !~* 'select\s+auth\.uid\(\)')
    or (coalesce(qual, '') ~ 'is_admin\(\)' and coalesce(qual, '') !~* 'select\s+(public\.)?is_admin')
    or (coalesce(with_check, '') ~ 'is_admin\(\)' and coalesce(with_check, '') !~* 'select\s+(public\.)?is_admin')
  )
order by tablename, policyname;

-- STEP 2: apply. Run after you have looked at the list from step 1.
do $$
declare
  r record; new_q text; new_c text; stmt text; n int := 0;
begin
  for r in select schemaname, tablename, policyname, qual, with_check
           from pg_policies where schemaname = 'public'
  loop
    new_q := r.qual; new_c := r.with_check;

    if new_q is not null then
      if new_q ~ 'auth\.uid\(\)' and new_q !~* 'select\s+auth\.uid\(\)' then
        new_q := replace(new_q, 'auth.uid()', '(select auth.uid())');
      end if;
      if new_q ~ 'is_admin\(\)' and new_q !~* 'select\s+(public\.)?is_admin' then
        new_q := regexp_replace(new_q, '(public\.)?is_admin\(\)', '(select public.is_admin())', 'g');
      end if;
    end if;

    if new_c is not null then
      if new_c ~ 'auth\.uid\(\)' and new_c !~* 'select\s+auth\.uid\(\)' then
        new_c := replace(new_c, 'auth.uid()', '(select auth.uid())');
      end if;
      if new_c ~ 'is_admin\(\)' and new_c !~* 'select\s+(public\.)?is_admin' then
        new_c := regexp_replace(new_c, '(public\.)?is_admin\(\)', '(select public.is_admin())', 'g');
      end if;
    end if;

    if new_q is distinct from r.qual or new_c is distinct from r.with_check then
      stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      if new_q is not null then stmt := stmt || ' using (' || new_q || ')'; end if;
      if new_c is not null then stmt := stmt || ' with check (' || new_c || ')'; end if;
      execute stmt;
      n := n + 1;
    end if;
  end loop;
  raise notice 'Rewrote % policies', n;
end $$;
