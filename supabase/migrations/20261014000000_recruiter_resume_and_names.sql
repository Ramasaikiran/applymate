-- 1) Fill missing first names so the candidate list shows a name, not "Candidate".
update public.profiles
   set first_name = split_part(trim(full_name), ' ', 1)
 where coalesce(trim(first_name), '') = ''
   and coalesce(trim(full_name), '') <> '';

-- 2) Let approved recruiters open a resume, only for a paid candidate
--    whose profile they viewed in the last 30 days.
create or replace function public.recruiter_can_read_resume(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved_recruiter()
     and exists (
       select 1 from public.recruiter_profile_views v
       where v.recruiter_id = auth.uid()
         and v.candidate_id::text = (storage.foldername(p_name))[1]
         and v.viewed_at > now() - interval '30 days'
         and public.is_paid_user(v.candidate_id)
     );
$$;
revoke execute on function public.recruiter_can_read_resume(text) from public, anon;
grant  execute on function public.recruiter_can_read_resume(text) to authenticated;

drop policy if exists "Recruiters read viewed candidate resumes" on storage.objects;
create policy "Recruiters read viewed candidate resumes" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.recruiter_can_read_resume(name));

select 'Recruiter resume access + names fixed ✓' as status;
