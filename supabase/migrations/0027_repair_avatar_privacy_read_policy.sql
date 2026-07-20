-- Keep the owner transition exception from 0026, but evaluate non-owner
-- visibility through the existing security-definer helper directly. The
-- policy must not first select another user's profile through profile RLS.
-- Applied migrations 0001-0026 remain immutable.

drop policy if exists profile_avatars_private_read on storage.objects;
create policy profile_avatars_private_read on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    name = (
      select p.public_profile_key::text || '/current.webp'
      from public.profiles p
      where p.id = auth.uid()
    )
    or case
      when split_part(name, '/', 2) = 'current.webp'
       and split_part(name, '/', 3) = ''
       and split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then public.can_view_profile_avatar(split_part(name, '/', 1)::uuid, auth.uid())
      else false
    end
  )
);
