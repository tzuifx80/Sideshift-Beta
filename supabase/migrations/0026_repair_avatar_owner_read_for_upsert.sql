-- Storage upsert needs to read the object while the owner metadata RPC has not
-- yet linked a newly uploaded object to profiles.avatar_path. The owner may
-- read only their exact canonical object path; all other viewers remain behind
-- the privacy-aware helper.
-- Applied migrations 0001-0025 remain immutable.

drop policy if exists profile_avatars_private_read on storage.objects;
create policy profile_avatars_private_read on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.profiles p
    where name = p.public_profile_key::text || '/current.webp'
      and (
        p.id = auth.uid()
        or public.can_view_profile_avatar(p.public_profile_key, auth.uid())
      )
  )
);
