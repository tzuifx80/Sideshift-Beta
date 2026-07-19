-- Private profiles, friend connections, direct friend challenges and targeted
-- Group invitations. All social mutations are RPC-owned and default-deny.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists public_profile_key uuid default extensions.gen_random_uuid(),
  add column if not exists handle text,
  add column if not exists handle_changed_at timestamptz,
  add column if not exists friend_code text,
  add column if not exists friend_code_hash text,
  add column if not exists friend_code_created_at timestamptz,
  add column if not exists avatar_path text,
  add column if not exists profile_accent text not null default 'coral',
  add column if not exists profile_visibility text not null default 'friends',
  add column if not exists avatar_visibility text not null default 'private',
  add column if not exists visible_stats jsonb not null default '{"debates":true,"sideSwitches":true,"constructive":true,"argumentDna":false}'::jsonb;

update public.profiles
set public_profile_key = coalesce(public_profile_key, extensions.gen_random_uuid()),
    friend_code = coalesce(friend_code, 'SS-' || translate(upper(substr(encode(extensions.gen_random_bytes(10), 'hex'), 1, 10)), '01', '23')),
    friend_code_created_at = coalesce(friend_code_created_at, now())
where public_profile_key is null or friend_code is null or friend_code_created_at is null;

update public.profiles
set friend_code_hash = encode(extensions.digest(friend_code, 'sha256'), 'hex')
where friend_code_hash is null and friend_code is not null;

alter table public.profiles
  alter column public_profile_key set not null,
  alter column friend_code set not null,
  alter column friend_code_hash set not null,
  alter column friend_code_created_at set not null;

alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add constraint profiles_handle_format
  check (handle is null or handle ~ '^[a-z0-9_]{3,24}$');
alter table public.profiles drop constraint if exists profiles_profile_accent;
alter table public.profiles add constraint profiles_profile_accent
  check (profile_accent in ('violet', 'cyan', 'amber', 'coral', 'mint', 'neutral'));
alter table public.profiles drop constraint if exists profiles_profile_visibility;
alter table public.profiles add constraint profiles_profile_visibility
  check (profile_visibility in ('friends', 'shared_groups', 'private'));
alter table public.profiles drop constraint if exists profiles_avatar_visibility;
alter table public.profiles add constraint profiles_avatar_visibility
  check (avatar_visibility in ('friends', 'shared_groups', 'private'));
alter table public.profiles drop constraint if exists profiles_visible_stats_object;
alter table public.profiles add constraint profiles_visible_stats_object
  check (jsonb_typeof(visible_stats) = 'object');

create unique index if not exists profiles_public_profile_key_idx on public.profiles (public_profile_key);
create unique index if not exists profiles_handle_unique_idx on public.profiles (lower(handle)) where handle is not null;
create unique index if not exists profiles_friend_code_hash_idx on public.profiles (friend_code_hash);

alter table public.user_preferences
  add column if not exists onboarding_stage integer not null default 0,
  add column if not exists onboarding_goal text,
  add column if not exists onboarding_dismissed boolean not null default false;
alter table public.user_preferences drop constraint if exists user_preferences_onboarding_stage;
alter table public.user_preferences add constraint user_preferences_onboarding_stage check (onboarding_stage between 0 and 3);
alter table public.user_preferences drop constraint if exists user_preferences_onboarding_goal;
alter table public.user_preferences add constraint user_preferences_onboarding_goal check (onboarding_goal is null or onboarding_goal in ('reasoning', 'school', 'friends', 'perspectives', 'fun'));

alter table public.challenges
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade,
  add column if not exists direct_friend boolean not null default false;
alter table public.challenges drop constraint if exists challenges_direct_recipient_check;
alter table public.challenges add constraint challenges_direct_recipient_check
  check ((direct_friend = false and recipient_id is null) or (direct_friend = true and recipient_id is not null));
create index if not exists challenges_recipient_idx on public.challenges (recipient_id, created_at desc) where direct_friend = true;

create table if not exists public.friendships (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'cancelled', 'removed', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);
create unique index if not exists friendships_one_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_user_status_idx on public.friendships (requester_id, status, updated_at desc);
create index if not exists friendships_addressee_status_idx on public.friendships (addressee_id, status, updated_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.group_member_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  updated_at timestamptz not null default now(),
  constraint group_member_invitations_not_self check (inviter_id <> invitee_id)
);
create unique index if not exists group_member_invitations_pending_idx
  on public.group_member_invitations (group_id, invitee_id) where status = 'pending';
create index if not exists group_member_invitations_invitee_idx on public.group_member_invitations (invitee_id, status, created_at desc);

create table if not exists public.profile_media (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 450000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b)
       or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

create or replace function public.are_private_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b) or (f.requester_id = p_b and f.addressee_id = p_a))
  ) and not public.is_blocked_between(p_a, p_b);
$$;

create or replace function public.share_private_group(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    join public.groups g on g.id = a.group_id and not g.archived
    where a.user_id = p_a and b.user_id = p_b
  ) and not public.is_blocked_between(p_a, p_b);
$$;

create or replace function public.can_view_profile(p_target_id uuid, p_viewer_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or p_viewer_id is distinct from auth.uid() then return false; end if;
  select * into v_profile from public.profiles where id = p_target_id;
  if not found or public.is_blocked_between(p_target_id, p_viewer_id) then return false; end if;
  if p_target_id = p_viewer_id then return true; end if;
  if v_profile.profile_visibility = 'friends' then return public.are_private_friends(p_target_id, p_viewer_id); end if;
  if v_profile.profile_visibility = 'shared_groups' then return public.share_private_group(p_target_id, p_viewer_id); end if;
  return false;
end;
$$;

create or replace function public.can_view_profile_avatar(p_profile_key uuid, p_viewer_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or p_viewer_id is distinct from auth.uid() then return false; end if;
  select * into v_profile from public.profiles where public_profile_key = p_profile_key;
  if not found or public.is_blocked_between(v_profile.id, p_viewer_id) then return false; end if;
  if v_profile.id = p_viewer_id then return true; end if;
  if v_profile.avatar_visibility = 'friends' then return public.are_private_friends(v_profile.id, p_viewer_id); end if;
  if v_profile.avatar_visibility = 'shared_groups' then return public.share_private_group(v_profile.id, p_viewer_id); end if;
  return false;
end;
$$;

create or replace function public.profile_preview_json(p_profile_key uuid, p_viewer_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_can_view boolean;
  v_avatar_visible boolean;
begin
  if auth.uid() is null or p_viewer_id is distinct from auth.uid() then return null; end if;
  select * into v_profile from public.profiles where public_profile_key = p_profile_key;
  if not found then return null; end if;
  v_can_view := public.can_view_profile(v_profile.id, p_viewer_id);
  if not v_can_view then return null; end if;
  v_avatar_visible := public.can_view_profile_avatar(v_profile.public_profile_key, p_viewer_id);
  return pg_catalog.jsonb_build_object(
    'profileKey', v_profile.public_profile_key,
    'handle', v_profile.handle,
    'displayName', coalesce(v_profile.display_name, 'Member'),
    'bio', v_profile.bio,
    'avatarPath', case when v_avatar_visible then v_profile.avatar_path else null end,
    'avatarPreset', v_profile.avatar_preset,
    'profileAccent', v_profile.profile_accent,
    'visibleStats', case when v_can_view then v_profile.visible_stats else '{}'::jsonb end
  );
end;
$$;

create or replace function public.get_my_private_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return (
    select pg_catalog.jsonb_build_object(
      'profileKey', p.public_profile_key, 'handle', p.handle, 'friendCode', p.friend_code,
      'displayName', p.display_name, 'bio', p.bio, 'avatarPreset', p.avatar_preset,
      'avatarPath', p.avatar_path, 'profileAccent', p.profile_accent,
      'profileVisibility', p.profile_visibility, 'avatarVisibility', p.avatar_visibility,
      'visibleStats', p.visible_stats, 'interfaceLanguage', p.interface_language,
      'challengeShowName', p.challenge_show_name, 'shareRealStance', p.share_real_stance
    ) from public.profiles p where p.id = auth.uid()
  );
end;
$$;

create or replace function public.update_my_profile(
  p_display_name text, p_bio text, p_avatar_preset text, p_interface_language text,
  p_challenge_show_name boolean, p_share_real_stance boolean, p_handle text,
  p_profile_accent text, p_profile_visibility text, p_avatar_visibility text, p_visible_stats jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_handle text := nullif(lower(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_handle, '')), '^@', '')), '');
  v_existing public.profiles%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles(id, avatar_preset, interface_language, challenge_show_name, share_real_stance)
    values (v_user_id, 'orbit', 'en', false, false);
  end if;
  select * into v_existing from public.profiles where id = v_user_id for update;
  if v_handle is not null and (v_handle !~ '^[a-z0-9_]{3,24}$' or v_handle = any(array['admin','administrator','moderator','support','sideshift','system','official','staff','help'])) then
    raise exception 'Handle is invalid' using errcode = '22023';
  end if;
  if v_handle is distinct from v_existing.handle and v_existing.handle is not null and v_existing.handle_changed_at > now() - interval '30 days' then
    raise exception 'Handle changes are limited to once every 30 days' using errcode = 'P0001';
  end if;
  if p_avatar_preset not in ('orbit', 'spark', 'wave', 'sun', 'leaf')
     or p_interface_language not in ('en', 'de', 'fr', 'es', 'it')
     or p_profile_accent not in ('violet', 'cyan', 'amber', 'coral', 'mint', 'neutral')
     or p_profile_visibility not in ('friends', 'shared_groups', 'private')
     or p_avatar_visibility not in ('friends', 'shared_groups', 'private')
     or jsonb_typeof(coalesce(p_visible_stats, '{}'::jsonb)) <> 'object'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_display_name, ''))) > 24
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_bio, ''))) > 160 then
    raise exception 'Profile details are invalid' using errcode = '22023';
  end if;
  if v_handle is not null and exists (select 1 from public.profiles where lower(handle) = v_handle and id <> v_user_id) then
    raise exception 'Handle is already in use' using errcode = '23505';
  end if;
  update public.profiles set
    display_name = nullif(pg_catalog.btrim(coalesce(p_display_name, '')), ''),
    bio = nullif(pg_catalog.btrim(coalesce(p_bio, '')), ''),
    avatar_preset = p_avatar_preset,
    interface_language = p_interface_language,
    challenge_show_name = coalesce(p_challenge_show_name, false),
    share_real_stance = coalesce(p_share_real_stance, false),
    handle = v_handle,
    handle_changed_at = case when v_handle is distinct from v_existing.handle then now() else v_existing.handle_changed_at end,
    profile_accent = p_profile_accent,
    profile_visibility = p_profile_visibility,
    avatar_visibility = p_avatar_visibility,
    visible_stats = coalesce(p_visible_stats, '{}'::jsonb)
  where id = v_user_id;
  return public.get_my_private_profile();
end;
$$;

create or replace function public.regenerate_friend_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := 'SS-' || translate(upper(substr(encode(extensions.gen_random_bytes(10), 'hex'), 1, 10)), '01', '23');
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform public.enforce_user_rate_limit('friend_code_regenerate', 5, 86400);
  update public.profiles set friend_code = v_code, friend_code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex'), friend_code_created_at = now() where id = auth.uid();
  return pg_catalog.jsonb_build_object('friendCode', v_code);
end;
$$;

create or replace function public.lookup_profile_by_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_handle text := nullif(lower(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_handle, '')), '^@', '')), ''); v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_handle is null or v_handle !~ '^[a-z0-9_]{3,24}$' then return null; end if;
  perform public.enforce_user_rate_limit('friend_lookup', 20, 60);
  select pg_catalog.jsonb_build_object(
    'profileKey', p.public_profile_key,
    'handle', p.handle,
    'displayName', p.display_name,
    'bio', null,
    'avatarPath', null,
    'avatarPreset', p.avatar_preset,
    'profileAccent', p.profile_accent,
    'visibleStats', '{}'::jsonb
  ) into v_result
  from public.profiles p
  where lower(p.handle) = v_handle
    and p.id <> auth.uid()
    and not public.is_blocked_between(p.id, auth.uid());
  return v_result;
end;
$$;

create or replace function public.lookup_profile_by_friend_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_code text := upper(pg_catalog.btrim(coalesce(p_code, ''))); v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_code !~ '^SS-[A-Z2-9]{10}$' then return null; end if;
  perform public.enforce_user_rate_limit('friend_lookup', 20, 60);
  select pg_catalog.jsonb_build_object(
    'profileKey', p.public_profile_key,
    'handle', p.handle,
    'displayName', p.display_name,
    'bio', null,
    'avatarPath', null,
    'avatarPreset', p.avatar_preset,
    'profileAccent', p.profile_accent,
    'visibleStats', '{}'::jsonb
  ) into v_result
  from public.profiles p
  where p.friend_code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
    and p.id <> auth.uid()
    and not public.is_blocked_between(p.id, auth.uid());
  return v_result;
end;
$$;

create or replace function public.friendship_json(p_friendship_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare v_friend public.friendships%rowtype; v_other uuid; v_key uuid; v_direction text;
begin
  select * into v_friend from public.friendships where id = p_friendship_id and (requester_id = auth.uid() or addressee_id = auth.uid());
  if not found then return null; end if;
  v_other := case when v_friend.requester_id = auth.uid() then v_friend.addressee_id else v_friend.requester_id end;
  select public_profile_key into v_key from public.profiles where id = v_other;
  v_direction := case when v_friend.requester_id = auth.uid() then 'outgoing' else 'incoming' end;
  return pg_catalog.jsonb_build_object('id', v_friend.id, 'status', v_friend.status, 'direction', v_direction, 'profile', public.profile_preview_json(v_key));
end;
$$;

create or replace function public.list_my_friendships()
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_friend record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  for v_friend in
    select f.id from public.friendships f
    where (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
      and f.status <> 'removed'
      and not public.is_blocked_between(f.requester_id, f.addressee_id)
    order by f.updated_at desc
  loop
    return next public.friendship_json(v_friend.id);
  end loop;
end;
$$;

create or replace function public.send_friend_request(p_target_profile_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_target_id uuid; v_friend public.friendships%rowtype; v_friendship_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform public.enforce_user_rate_limit('friend_request_send', 20, 3600);
  select id into v_target_id from public.profiles where public_profile_key = p_target_profile_key;
  if v_target_id is null or v_target_id = v_user_id or public.is_blocked_between(v_user_id, v_target_id) then raise exception 'User is unavailable' using errcode = 'P0002'; end if;
  select * into v_friend from public.friendships where (requester_id = v_user_id and addressee_id = v_target_id) or (requester_id = v_target_id and addressee_id = v_user_id) for update;
  if found then
    if v_friend.status = 'pending' and v_friend.requester_id = v_target_id then
      update public.friendships set status = 'accepted', accepted_at = now(), updated_at = now() where id = v_friend.id;
    elsif v_friend.status = 'accepted' then raise exception 'Already connected' using errcode = '23505';
    elsif v_friend.status in ('declined', 'cancelled', 'removed') then
      update public.friendships set requester_id = v_user_id, addressee_id = v_target_id, status = 'pending', accepted_at = null, updated_at = now() where id = v_friend.id;
    else raise exception 'Connection is unavailable' using errcode = 'P0002'; end if;
  else
    insert into public.friendships(requester_id, addressee_id, status) values (v_user_id, v_target_id, 'pending') returning * into v_friend;
  end if;
  select id into v_friendship_id from public.friendships where (requester_id = v_user_id and addressee_id = v_target_id) or (requester_id = v_target_id and addressee_id = v_user_id);
  return public.friendship_json(v_friendship_id);
end;
$$;

create or replace function public.update_friend_request(p_relationship_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_friend public.friendships%rowtype; v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_friend from public.friendships where id = p_relationship_id for update;
  if not found or auth.uid() not in (v_friend.requester_id, v_friend.addressee_id) then raise exception 'Connection is unavailable' using errcode = 'P0002'; end if;
  if public.is_blocked_between(v_friend.requester_id, v_friend.addressee_id) then raise exception 'Connection is unavailable' using errcode = 'P0002'; end if;
  v_status := case p_action
    when 'accept' then case when v_friend.status = 'pending' and v_friend.addressee_id = auth.uid() then 'accepted' else null end
    when 'decline' then case when v_friend.status = 'pending' and v_friend.addressee_id = auth.uid() then 'declined' else null end
    when 'cancel' then case when v_friend.status = 'pending' and v_friend.requester_id = auth.uid() then 'cancelled' else null end
    when 'remove' then case when v_friend.status = 'accepted' then 'removed' else null end
    else null end;
  if v_status is null then raise exception 'Connection action is unavailable' using errcode = 'P0002'; end if;
  update public.friendships set status = v_status, accepted_at = case when v_status = 'accepted' then now() else accepted_at end, updated_at = now() where id = p_relationship_id;
  return public.friendship_json(p_relationship_id);
end;
$$;

create or replace function public.list_my_blocks()
returns setof jsonb
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'profileKey', p.public_profile_key,
    'handle', p.handle,
    'displayName', p.display_name,
    'bio', null,
    'avatarPath', null,
    'avatarPreset', p.avatar_preset,
    'profileAccent', p.profile_accent,
    'visibleStats', '{}'::jsonb
  )
  from public.user_blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

create or replace function public.block_user(p_target_profile_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_target_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform public.enforce_user_rate_limit('block_user', 20, 3600);
  select id into v_target_id from public.profiles where public_profile_key = p_target_profile_key;
  if v_target_id is null or v_target_id = v_user_id then raise exception 'User is unavailable' using errcode = 'P0002'; end if;
  insert into public.user_blocks(blocker_id, blocked_id) values (v_user_id, v_target_id) on conflict do nothing;
  update public.friendships set status = 'blocked', updated_at = now() where (requester_id = v_user_id and addressee_id = v_target_id) or (requester_id = v_target_id and addressee_id = v_user_id);
  update public.challenges set status = 'revoked' where direct_friend and status = 'open' and ((creator_id = v_user_id and recipient_id = v_target_id) or (creator_id = v_target_id and recipient_id = v_user_id));
  update public.group_member_invitations set status = 'revoked', updated_at = now() where status = 'pending' and ((inviter_id = v_user_id and invitee_id = v_target_id) or (inviter_id = v_target_id and invitee_id = v_user_id));
end;
$$;

create or replace function public.unblock_user(p_target_profile_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_target_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select id into v_target_id from public.profiles where public_profile_key = p_target_profile_key;
  if v_target_id is null then raise exception 'User is unavailable' using errcode = 'P0002'; end if;
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = v_target_id;
  update public.friendships set status = 'removed', updated_at = now() where status = 'blocked' and ((requester_id = auth.uid() and addressee_id = v_target_id) or (requester_id = v_target_id and addressee_id = auth.uid()));
end;
$$;

create or replace function public.create_friend_challenge(
  p_recipient_profile_key uuid, p_take_id text, p_mode text, p_creator_side text, p_creator_argument text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_recipient_id uuid; v_id uuid; v_token text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode not in ('classic', 'sideswitch', 'blindside', 'commonground') or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_creator_argument, ''))) not between 12 and 350 then raise exception 'Challenge details are invalid' using errcode = '22023'; end if;
  select id into v_recipient_id from public.profiles where public_profile_key = p_recipient_profile_key;
  if v_recipient_id is null or not public.are_private_friends(auth.uid(), v_recipient_id) then raise exception 'User is unavailable' using errcode = 'P0002'; end if;
  perform public.enforce_user_rate_limit('friend_challenge_create', 10, 3600);
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.challenges(creator_id, recipient_id, direct_friend, take_id, mode, creator_side, creator_argument, token_hash, status, expires_at)
  values (auth.uid(), v_recipient_id, true, p_take_id, p_mode, p_creator_side, pg_catalog.btrim(p_creator_argument), encode(extensions.digest(v_token, 'sha256'), 'hex'), 'open', now() + interval '7 days') returning id into v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'takeId', p_take_id, 'mode', p_mode, 'argument', pg_catalog.btrim(p_creator_argument), 'creatorSide', p_creator_side, 'status', 'open', 'expiresAt', now() + interval '7 days');
end;
$$;

create or replace function public.list_my_friend_challenges()
returns setof jsonb
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', c.id, 'takeId', c.take_id, 'mode', c.mode, 'argument', c.creator_argument,
    'creatorSide', c.creator_side, 'status', case when c.status = 'open' and c.expires_at < now() then 'expired' else c.status end,
    'expiresAt', c.expires_at, 'response', r.response_content, 'result', r.result_payload,
    'direction', case when c.recipient_id = auth.uid() then 'incoming' else 'outgoing' end,
    'creator', public.profile_preview_json(pc.public_profile_key),
    'recipient', public.profile_preview_json(pr.public_profile_key)
  )
  from public.challenges c
  left join public.challenge_responses r on r.challenge_id = c.id
  left join public.profiles pc on pc.id = c.creator_id
  left join public.profiles pr on pr.id = c.recipient_id
  where c.direct_friend and (c.creator_id = auth.uid() or c.recipient_id = auth.uid())
  order by c.created_at desc;
$$;

create or replace function public.complete_friend_challenge(p_challenge_id uuid, p_response_content text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare c public.challenges%rowtype; r public.challenge_responses%rowtype; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_response_content, ''))) not between 12 and 350 then raise exception 'Challenge response length is invalid' using errcode = '22023'; end if;
  select * into c from public.challenges where id = p_challenge_id and direct_friend for update;
  if not found or c.recipient_id <> auth.uid() or public.is_blocked_between(c.creator_id, c.recipient_id) then raise exception 'Challenge is unavailable' using errcode = 'P0002'; end if;
  if c.status = 'open' and c.expires_at < now() then update public.challenges set status = 'expired' where id = c.id; end if;
  if c.status <> 'open' then raise exception 'Challenge is not open' using errcode = '55000'; end if;
  if exists (select 1 from public.challenge_responses where challenge_id = c.id) then raise exception 'Challenge already answered' using errcode = '23505'; end if;
  v_result := pg_catalog.jsonb_build_object('total', least(100, greatest(0, 40 + round(pg_catalog.char_length(pg_catalog.btrim(p_response_content)) / 4.0)::integer)), 'createdAt', now(), 'mode', c.mode);
  insert into public.challenge_responses(challenge_id, responder_id, response_content, result_payload, completed_at) values (c.id, auth.uid(), pg_catalog.btrim(p_response_content), v_result, now()) returning * into r;
  update public.challenges set completed_uses = completed_uses + 1, status = 'completed', completed_at = now() where id = c.id;
  return pg_catalog.jsonb_build_object('id', c.id, 'takeId', c.take_id, 'mode', c.mode, 'argument', c.creator_argument, 'creatorSide', c.creator_side, 'status', 'completed', 'response', r.response_content, 'result', v_result);
end;
$$;

create or replace function public.create_group_friend_invitation(p_group_id uuid, p_invitee_profile_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_invitee_id uuid; v_id uuid;
begin
  if auth.uid() is null or public.group_role(p_group_id) not in ('owner', 'moderator') then raise exception 'Group invitation is unavailable' using errcode = '42501'; end if;
  perform public.enforce_user_rate_limit('group_friend_invite', 20, 3600);
  select id into v_invitee_id from public.profiles where public_profile_key = p_invitee_profile_key;
  if v_invitee_id is null or not public.are_private_friends(auth.uid(), v_invitee_id) or exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_invitee_id) then raise exception 'Group invitation is unavailable' using errcode = 'P0002'; end if;
  insert into public.group_member_invitations(group_id, inviter_id, invitee_id) values (p_group_id, auth.uid(), v_invitee_id) on conflict (group_id, invitee_id) where status = 'pending' do update set updated_at = now() returning id into v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'groupId', p_group_id, 'status', 'pending');
end;
$$;

create or replace function public.list_my_group_invitations()
returns setof jsonb
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', i.id, 'groupId', i.group_id, 'groupName', g.name, 'status', case when i.expires_at < now() then 'expired' else i.status end,
    'expiresAt', i.expires_at, 'inviter', public.profile_preview_json(p.public_profile_key)
  )
  from public.group_member_invitations i
  join public.groups g on g.id = i.group_id and not g.archived
  join public.profiles p on p.id = i.inviter_id
  where i.invitee_id = auth.uid() and i.status = 'pending'
  order by i.created_at desc;
$$;

create or replace function public.respond_group_friend_invitation(p_invitation_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare i public.group_member_invitations%rowtype; g public.groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into i from public.group_member_invitations where id = p_invitation_id and invitee_id = auth.uid() for update;
  if not found or i.status <> 'pending' or i.expires_at < now() then raise exception 'Invitation is unavailable' using errcode = 'P0002'; end if;
  if p_action = 'decline' then update public.group_member_invitations set status = 'declined', updated_at = now() where id = i.id; return pg_catalog.jsonb_build_object('id', i.id, 'status', 'declined'); end if;
  if p_action <> 'accept' then raise exception 'Invitation action is invalid' using errcode = '22023'; end if;
  if public.is_blocked_between(i.inviter_id, i.invitee_id) then raise exception 'Invitation is unavailable' using errcode = 'P0002'; end if;
  select * into g from public.groups where id = i.group_id and not archived for update;
  if not found then raise exception 'Group is unavailable' using errcode = 'P0002'; end if;
  if g.member_limit is not null and (select count(*) from public.group_members where group_id = g.id) >= g.member_limit then raise exception 'Group member limit reached' using errcode = '22023'; end if;
  insert into public.group_members(group_id, user_id, membership_role) values (i.group_id, auth.uid(), 'member') on conflict do nothing;
  insert into public.group_points(group_id, user_id) values (i.group_id, auth.uid()) on conflict do nothing;
  update public.group_member_invitations set status = 'accepted', updated_at = now() where id = i.id;
  return public.group_summary_json(i.group_id, auth.uid());
end;
$$;

create or replace function public.set_my_avatar_path(p_object_path text, p_mime_type text, p_byte_size integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_key uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select public_profile_key into v_key from public.profiles where id = auth.uid();
  if p_object_path <> v_key::text || '/current.webp' or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') or p_byte_size not between 1 and 450000 then raise exception 'Avatar details are invalid' using errcode = '22023'; end if;
  insert into public.profile_media(owner_id, object_path, mime_type, byte_size) values (auth.uid(), p_object_path, p_mime_type, p_byte_size)
  on conflict (owner_id) do update set object_path = excluded.object_path, mime_type = excluded.mime_type, byte_size = excluded.byte_size, updated_at = now();
  update public.profiles set avatar_path = p_object_path where id = auth.uid();
  return pg_catalog.jsonb_build_object('avatarPath', p_object_path);
end;
$$;

create or replace function public.remove_my_avatar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  delete from storage.objects where bucket_id = 'profile-avatars' and name = (select public_profile_key::text || '/current.webp' from public.profiles where id = auth.uid());
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
  delete from storage.objects where bucket_id = 'profile-avatars' and name = old.public_profile_key::text || '/current.webp';
  return old;
end;
$$;
drop trigger if exists profiles_cleanup_social_data on public.profiles;
create trigger profiles_cleanup_social_data after delete on public.profiles for each row execute function public.cleanup_profile_social_data();

-- Direct friend challenges never expose their internal token and must not be
-- reachable through the existing bearer-link RPCs.
create or replace function public.resolve_challenge(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.challenges
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and direct_friend
  ) then
    raise exception 'Challenge is unavailable' using errcode = 'P0002';
  end if;
  perform public.enforce_user_rate_limit('challenge_resolve', 60, 60);
  return public.resolve_challenge_unlimited(p_token);
end;
$$;

create or replace function public.complete_challenge_response(p_token text, p_response_content text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.challenges
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and direct_friend
  ) then
    raise exception 'Challenge is unavailable' using errcode = 'P0002';
  end if;
  perform public.enforce_user_rate_limit('challenge_response', 10, 60);
  return public.complete_challenge_response_unlimited(p_token, p_response_content);
end;
$$;

alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.group_member_invitations enable row level security;
alter table public.profile_media enable row level security;
revoke all on table public.friendships, public.user_blocks, public.group_member_invitations, public.profile_media from anon, authenticated;
revoke insert, update, delete on table public.profiles from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 450000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 450000, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_owner_insert on storage.objects;
create policy profile_avatars_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and exists (select 1 from public.profiles p where p.public_profile_key = (storage.foldername(name))[1]::uuid and p.id = auth.uid())
  and name = (storage.foldername(name))[1] || '/current.webp'
);
drop policy if exists profile_avatars_owner_update on storage.objects;
create policy profile_avatars_owner_update on storage.objects for update to authenticated
using (bucket_id = 'profile-avatars' and exists (select 1 from public.profiles p where p.public_profile_key = (storage.foldername(name))[1]::uuid and p.id = auth.uid()))
with check (bucket_id = 'profile-avatars' and exists (select 1 from public.profiles p where p.public_profile_key = (storage.foldername(name))[1]::uuid and p.id = auth.uid()) and name = (storage.foldername(name))[1] || '/current.webp');
drop policy if exists profile_avatars_owner_delete on storage.objects;
create policy profile_avatars_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'profile-avatars' and exists (select 1 from public.profiles p where p.public_profile_key = (storage.foldername(name))[1]::uuid and p.id = auth.uid()));
drop policy if exists profile_avatars_private_read on storage.objects;
create policy profile_avatars_private_read on storage.objects for select to authenticated
using (bucket_id = 'profile-avatars' and public.can_view_profile_avatar((storage.foldername(name))[1]::uuid, auth.uid()));

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;
revoke all on function public.are_private_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.share_private_group(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_view_profile(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_view_profile_avatar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.profile_preview_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friendship_json(uuid) from public, anon, authenticated;
revoke all on function public.cleanup_profile_social_data() from public, anon, authenticated;
revoke all on function public.update_my_profile(text, text, text, text, boolean, boolean, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_my_private_profile() from public, anon, authenticated;
revoke all on function public.regenerate_friend_code() from public, anon, authenticated;
revoke all on function public.lookup_profile_by_handle(text) from public, anon, authenticated;
revoke all on function public.lookup_profile_by_friend_code(text) from public, anon, authenticated;
revoke all on function public.list_my_friendships() from public, anon, authenticated;
revoke all on function public.send_friend_request(uuid) from public, anon, authenticated;
revoke all on function public.update_friend_request(uuid, text) from public, anon, authenticated;
revoke all on function public.list_my_blocks() from public, anon, authenticated;
revoke all on function public.block_user(uuid) from public, anon, authenticated;
revoke all on function public.unblock_user(uuid) from public, anon, authenticated;
revoke all on function public.create_friend_challenge(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.list_my_friend_challenges() from public, anon, authenticated;
revoke all on function public.complete_friend_challenge(uuid, text) from public, anon, authenticated;
revoke all on function public.create_group_friend_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_my_group_invitations() from public, anon, authenticated;
revoke all on function public.respond_group_friend_invitation(uuid, text) from public, anon, authenticated;
revoke all on function public.set_my_avatar_path(text, text, integer) from public, anon, authenticated;
revoke all on function public.remove_my_avatar() from public, anon, authenticated;
grant execute on function public.update_my_profile(text, text, text, text, boolean, boolean, text, text, text, text, jsonb) to authenticated;
grant execute on function public.get_my_private_profile() to authenticated;
grant execute on function public.regenerate_friend_code() to authenticated;
grant execute on function public.lookup_profile_by_handle(text) to authenticated;
grant execute on function public.lookup_profile_by_friend_code(text) to authenticated;
grant execute on function public.list_my_friendships() to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.update_friend_request(uuid, text) to authenticated;
grant execute on function public.list_my_blocks() to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.create_friend_challenge(uuid, text, text, text, text) to authenticated;
grant execute on function public.list_my_friend_challenges() to authenticated;
grant execute on function public.complete_friend_challenge(uuid, text) to authenticated;
grant execute on function public.create_group_friend_invitation(uuid, uuid) to authenticated;
grant execute on function public.list_my_group_invitations() to authenticated;
grant execute on function public.respond_group_friend_invitation(uuid, text) to authenticated;
grant execute on function public.set_my_avatar_path(text, text, integer) to authenticated;
grant execute on function public.remove_my_avatar() to authenticated;
