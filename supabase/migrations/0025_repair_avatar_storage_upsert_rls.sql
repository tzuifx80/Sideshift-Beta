-- Repair private avatar replacement authorization without changing the
-- canonical <public_profile_key>/current.webp path or privacy-aware reads.
-- Applied migrations 0001-0024 remain immutable.

drop policy if exists profile_avatars_owner_insert on storage.objects;
create policy profile_avatars_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and name = p.public_profile_key::text || '/current.webp'
  )
);

drop policy if exists profile_avatars_owner_update on storage.objects;
create policy profile_avatars_owner_update on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and name = p.public_profile_key::text || '/current.webp'
  )
)
with check (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and name = p.public_profile_key::text || '/current.webp'
  )
);

drop policy if exists profile_avatars_owner_delete on storage.objects;
create policy profile_avatars_owner_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and name = p.public_profile_key::text || '/current.webp'
  )
);

drop policy if exists profile_avatars_private_read on storage.objects;
create policy profile_avatars_private_read on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.profiles p
    where name = p.public_profile_key::text || '/current.webp'
      and public.can_view_profile_avatar(p.public_profile_key, auth.uid())
  )
);
