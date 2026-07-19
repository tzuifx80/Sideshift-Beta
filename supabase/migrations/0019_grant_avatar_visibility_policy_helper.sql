-- Storage RLS evaluates this boolean helper as the authenticated caller.
-- The helper is security-definer and still requires auth.uid() to match the
-- viewer, so the grant exposes no profile or storage data.
grant execute on function public.can_view_profile_avatar(uuid, uuid) to authenticated;
