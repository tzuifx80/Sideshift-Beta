-- Profile & Settings 2.0: viewer-aware profile fields and validated social links.
-- Applied migrations 0001-0020 remain immutable.

alter table public.profiles
  add column if not exists profile_field_visibility jsonb not null default '{"avatar":"friends","displayName":"public","bio":"friends","profileAccent":"friends","argumentDna":"friends","statistics":"friends","socialLinks":"friends","groupRelationship":"shared_groups"}'::jsonb,
  add column if not exists social_links jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_profile_visibility;
alter table public.profiles add constraint profiles_profile_visibility check (profile_visibility in ('private', 'friends', 'shared_groups', 'public'));
alter table public.profiles drop constraint if exists profiles_avatar_visibility;
alter table public.profiles add constraint profiles_avatar_visibility check (avatar_visibility in ('private', 'friends', 'shared_groups', 'public'));
alter table public.profiles drop constraint if exists profiles_profile_field_visibility_object;
alter table public.profiles add constraint profiles_profile_field_visibility_object check (jsonb_typeof(profile_field_visibility) = 'object');
alter table public.profiles drop constraint if exists profiles_social_links_array;
alter table public.profiles add constraint profiles_social_links_array check (jsonb_typeof(social_links) = 'array' and jsonb_array_length(social_links) <= 5);

update public.profiles
set profile_field_visibility = jsonb_set(coalesce(profile_field_visibility, '{}'::jsonb), '{avatar}', to_jsonb(avatar_visibility), true)
where profile_field_visibility is null or not (profile_field_visibility ? 'avatar');

create or replace function public.profile_viewer_relationship(p_target_id uuid, p_viewer_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_viewer_id is distinct from auth.uid() then return 'outsider'; end if;
  if p_target_id = p_viewer_id then return 'owner'; end if;
  if public.is_blocked_between(p_target_id, p_viewer_id) then return 'blocked'; end if;
  if public.are_private_friends(p_target_id, p_viewer_id) then return 'friend'; end if;
  if public.share_private_group(p_target_id, p_viewer_id) then return 'shared_group'; end if;
  return 'outsider';
end;
$$;

create or replace function public.profile_field_is_visible(p_overall text, p_field text, p_relationship text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_relationship = 'owner' then true
    when p_relationship in ('blocked', 'outsider') and p_overall = 'private' then false
    when p_field = 'private' then false
    when p_overall = 'private' then false
    when p_relationship = 'outsider' then p_overall = 'public' and p_field = 'public'
    when p_relationship = 'friend' then p_overall in ('friends', 'shared_groups', 'public') and p_field in ('friends', 'shared_groups', 'public')
    when p_relationship = 'shared_group' then p_overall in ('shared_groups', 'public') and p_field in ('shared_groups', 'public')
    else false
  end;
$$;

create or replace function public.profile_statistics_json(p_owner_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'debatesCompleted', (select count(*) from public.debate_results where owner_id = p_owner_id),
    'sideSwitchesCompleted', (select count(*) from public.debate_results r join public.debates d on d.id = r.debate_id where r.owner_id = p_owner_id and d.mode = 'sideswitch'),
    'topicsExplored', (select count(distinct d.take_id) from public.debate_results r join public.debates d on d.id = r.debate_id where r.owner_id = p_owner_id),
    'challengeResponses', (select count(*) from public.challenge_responses where responder_id = p_owner_id),
    'challengesCreated', (select count(*) from public.challenges where creator_id = p_owner_id),
    'languagesUsed', (select count(distinct d.language) from public.debates d join public.debate_results r on r.debate_id = d.id where r.owner_id = p_owner_id)
  );
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
  v_relationship text;
  v_profile_allowed boolean;
  v_avatar_visible boolean;
  v_stats_visible boolean;
  v_social_visible boolean;
  v_stats jsonb := '{}'::jsonb;
  v_social jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or p_viewer_id is distinct from auth.uid() then return null; end if;
  select * into v_profile from public.profiles where public_profile_key = p_profile_key;
  if not found then return null; end if;
  v_relationship := public.profile_viewer_relationship(v_profile.id, p_viewer_id);
  if v_relationship = 'blocked' then return null; end if;
  v_profile_allowed := v_relationship = 'owner'
    or (v_profile.profile_visibility = 'public')
    or (v_profile.profile_visibility = 'friends' and v_relationship = 'friend')
    or (v_profile.profile_visibility = 'shared_groups' and v_relationship in ('friend', 'shared_group'));
  if not v_profile_allowed then return null; end if;
  v_avatar_visible := public.profile_field_is_visible(v_profile.profile_visibility, least(v_profile.avatar_visibility, coalesce(v_profile.profile_field_visibility->>'avatar', 'private')), v_relationship);
  v_stats_visible := public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'statistics', 'private'), v_relationship);
  v_social_visible := public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'socialLinks', 'private'), v_relationship);
  if v_stats_visible then v_stats := public.profile_statistics_json(v_profile.id); end if;
  if v_social_visible then
    select coalesce(jsonb_agg(link order by coalesce((link->>'order')::integer, 0)), '[]'::jsonb) into v_social
    from jsonb_array_elements(coalesce(v_profile.social_links, '[]'::jsonb)) link
    where (v_relationship = 'owner' and (link->>'visibility') in ('private', 'friends', 'shared_groups', 'public'))
       or (v_relationship = 'friend' and (link->>'visibility') in ('friends', 'shared_groups', 'public'))
       or (v_relationship = 'shared_group' and (link->>'visibility') in ('shared_groups', 'public'))
       or (v_relationship = 'outsider' and (link->>'visibility') = 'public');
  end if;
  return pg_catalog.jsonb_build_object(
    'profileKey', v_profile.public_profile_key,
    'handle', case when public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'displayName', 'private'), v_relationship) then v_profile.handle else null end,
    'displayName', case when public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'displayName', 'private'), v_relationship) then coalesce(v_profile.display_name, 'Member') else null end,
    'bio', case when public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'bio', 'private'), v_relationship) then v_profile.bio else null end,
    'avatarPath', case when v_avatar_visible then v_profile.avatar_path else null end,
    'avatarPreset', v_profile.avatar_preset,
    'profileAccent', case when public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'profileAccent', 'private'), v_relationship) then v_profile.profile_accent else 'coral' end,
    'visibleStats', case when v_stats_visible then v_profile.visible_stats else '{}'::jsonb end,
    'socialLinks', v_social,
    'statistics', v_stats
  );
end;
$$;

create or replace function public.get_profile_for_viewer(p_profile_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_id uuid;
  v_relationship text;
  v_preview jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select id into v_target_id from public.profiles where public_profile_key = p_profile_key;
  if v_target_id is null then return pg_catalog.jsonb_build_object('state', 'unavailable', 'relationship', 'outsider', 'profile', null, 'socialLinks', '[]'::jsonb, 'statistics', '{}'::jsonb, 'isOwner', false); end if;
  v_relationship := public.profile_viewer_relationship(v_target_id, auth.uid());
  if v_relationship = 'blocked' then return pg_catalog.jsonb_build_object('state', 'unavailable', 'relationship', 'outsider', 'profile', null, 'socialLinks', '[]'::jsonb, 'statistics', '{}'::jsonb, 'isOwner', false); end if;
  v_preview := public.profile_preview_json(p_profile_key, auth.uid());
  if v_preview is null then return pg_catalog.jsonb_build_object('state', 'private', 'relationship', v_relationship, 'profile', null, 'socialLinks', '[]'::jsonb, 'statistics', '{}'::jsonb, 'isOwner', false); end if;
  return pg_catalog.jsonb_build_object('state', 'available', 'relationship', v_relationship, 'profile', v_preview, 'socialLinks', coalesce(v_preview->'socialLinks', '[]'::jsonb), 'statistics', coalesce(v_preview->'statistics', '{}'::jsonb), 'isOwner', v_relationship = 'owner');
end;
$$;

create or replace function public.update_my_profile_visibility(p_profile_visibility text, p_avatar_visibility text, p_field_visibility jsonb, p_social_links jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_link jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_profile_visibility not in ('private', 'friends', 'shared_groups', 'public') or p_avatar_visibility not in ('private', 'friends', 'shared_groups', 'public') then raise exception 'Profile visibility is invalid' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_field_visibility, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_social_links, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_social_links, '[]'::jsonb)) > 5 then raise exception 'Profile settings are invalid' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_each_text(coalesce(p_field_visibility, '{}'::jsonb)) item where item.value not in ('private', 'friends', 'shared_groups', 'public')) then raise exception 'Profile field visibility is invalid' using errcode = '22023'; end if;
  for v_link in select value from jsonb_array_elements(coalesce(p_social_links, '[]'::jsonb)) loop
    if v_link->>'provider' not in ('instagram', 'tiktok', 'youtube', 'twitch', 'github', 'spotify', 'x', 'website') or v_link->>'visibility' not in ('private', 'friends', 'shared_groups', 'public') or char_length(coalesce(v_link->>'url', '')) > 2048 or coalesce(v_link->>'url', '') !~ '^https://' then raise exception 'Social link is invalid' using errcode = '22023'; end if;
    if v_link->>'provider' = 'github' and v_link->>'url' !~ '^https://(www\\.)?github\\.com/' then raise exception 'Social link domain is invalid' using errcode = '22023'; end if;
    if v_link->>'provider' = 'instagram' and v_link->>'url' !~ '^https://(www\\.)?instagram\\.com/' then raise exception 'Social link domain is invalid' using errcode = '22023'; end if;
  end loop;
  update public.profiles set profile_visibility = p_profile_visibility, avatar_visibility = p_avatar_visibility, profile_field_visibility = jsonb_set(coalesce(p_field_visibility, '{}'::jsonb), '{avatar}', to_jsonb(p_avatar_visibility), true), social_links = coalesce(p_social_links, '[]'::jsonb) where id = v_user_id;
  return public.get_my_private_profile();
end;
$$;

create or replace function public.update_my_profile_v2(
  p_display_name text, p_bio text, p_avatar_preset text, p_interface_language text,
  p_challenge_show_name boolean, p_share_real_stance boolean, p_handle text,
  p_profile_accent text, p_profile_visibility text, p_avatar_visibility text,
  p_visible_stats jsonb, p_field_visibility jsonb, p_social_links jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The legacy core RPC remains compatible with older clients. Public visibility
  -- is applied by the second RPC inside this same transaction.
  perform public.update_my_profile(
    p_display_name, p_bio, p_avatar_preset, p_interface_language,
    p_challenge_show_name, p_share_real_stance, p_handle, p_profile_accent,
    case when p_profile_visibility = 'public' then 'friends' else p_profile_visibility end,
    case when p_avatar_visibility = 'public' then 'friends' else p_avatar_visibility end,
    p_visible_stats
  );
  return public.update_my_profile_visibility(p_profile_visibility, p_avatar_visibility, p_field_visibility, p_social_links);
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
  return (select pg_catalog.jsonb_build_object(
    'profileKey', p.public_profile_key, 'handle', p.handle, 'friendCode', p.friend_code,
    'displayName', p.display_name, 'bio', p.bio, 'avatarPreset', p.avatar_preset,
    'avatarPath', p.avatar_path, 'profileAccent', p.profile_accent,
    'profileVisibility', p.profile_visibility, 'avatarVisibility', p.avatar_visibility,
    'fieldVisibility', p.profile_field_visibility, 'visibleStats', p.visible_stats,
    'socialLinks', p.social_links, 'interfaceLanguage', p.interface_language,
    'challengeShowName', p.challenge_show_name, 'shareRealStance', p.share_real_stance
  ) from public.profiles p where p.id = auth.uid());
end;
$$;

create or replace function public.can_view_profile(p_target_id uuid, p_viewer_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.profile_preview_json((select public_profile_key from public.profiles where id = p_target_id), p_viewer_id) is not null;
$$;

create or replace function public.can_view_profile_avatar(p_profile_key uuid, p_viewer_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.profile_preview_json(p_profile_key, p_viewer_id)->>'avatarPath') is not null;
$$;

revoke all on function public.get_profile_for_viewer(uuid) from public, anon, authenticated;
revoke all on function public.update_my_profile_visibility(text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.update_my_profile_v2(text, text, text, text, boolean, boolean, text, text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.get_profile_for_viewer(uuid) to authenticated;
grant execute on function public.update_my_profile_visibility(text, text, jsonb, jsonb) to authenticated;
grant execute on function public.update_my_profile_v2(text, text, text, text, boolean, boolean, text, text, text, text, jsonb, jsonb, jsonb) to authenticated;
