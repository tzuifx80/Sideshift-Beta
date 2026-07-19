-- Storage objects are removed through the Storage API, never by deleting
-- storage.objects from SQL. The client performs that owner-authorized step
-- before these metadata/account mutations.

create or replace function public.remove_my_avatar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  delete from public.profile_media where owner_id = auth.uid();
  update public.profiles set avatar_path = null where id = auth.uid();
end;
$$;

create or replace function public.cleanup_profile_social_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships where requester_id = old.id or addressee_id = old.id;
  delete from public.user_blocks where blocker_id = old.id or blocked_id = old.id;
  delete from public.group_member_invitations where inviter_id = old.id or invitee_id = old.id;
  return old;
end;
$$;

revoke all on function public.remove_my_avatar() from public, anon, authenticated;
grant execute on function public.remove_my_avatar() to authenticated;
