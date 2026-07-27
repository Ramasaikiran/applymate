-- "Anyone can view photos" granted broad SELECT on storage.objects for
-- the photos bucket. Since the bucket itself is public=true, individual
-- objects already serve by direct URL without any RLS SELECT policy —
-- the policy's only real effect was enabling storage.list(), letting
-- anyone enumerate every uploaded filename/folder (folders are named
-- by auth.uid(), so this effectively let anyone enumerate every user
-- ID that has uploaded a profile photo). Removing it closes the
-- enumeration path; public photo URLs continue to work unaffected.
drop policy if exists "Anyone can view photos" on storage.objects;
