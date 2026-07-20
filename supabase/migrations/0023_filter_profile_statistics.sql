-- Expose only the safe statistics selected by the profile owner.
create or replace function public.profile_statistics_json(p_owner_id uuid, p_visible_stats jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'debatesCompleted', case when p_visible_stats->>'debates' = 'true' then (select count(*) from public.debate_results where owner_id = p_owner_id) else null end,
    'sideSwitchesCompleted', case when p_visible_stats->>'sideSwitches' = 'true' then (select count(*) from public.debate_results r join public.debates d on d.id = r.debate_id where r.owner_id = p_owner_id and d.mode = 'sideswitch') else null end,
    'topicsExplored', case when p_visible_stats->>'debates' = 'true' then (select count(distinct d.take_id) from public.debate_results r join public.debates d on d.id = r.debate_id where r.owner_id = p_owner_id) else null end,
    'challengeResponses', case when p_visible_stats->>'constructive' = 'true' then (select count(*) from public.challenge_responses where responder_id = p_owner_id) else null end,
    'challengesCreated', case when p_visible_stats->>'constructive' = 'true' then (select count(*) from public.challenges where creator_id = p_owner_id) else null end,
    'languagesUsed', case when p_visible_stats->>'debates' = 'true' then (select count(distinct d.language) from public.debates d join public.debate_results r on r.debate_id = d.id where r.owner_id = p_owner_id) else null end
  ));
$$;

create or replace function public.profile_preview_json(p_profile_key uuid, p_viewer_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_profile public.profiles%rowtype; v_relationship text; v_profile_allowed boolean; v_avatar_visible boolean; v_stats_visible boolean; v_social_visible boolean; v_stats jsonb := '{}'::jsonb; v_social jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or p_viewer_id is distinct from auth.uid() then return null; end if;
  select * into v_profile from public.profiles where public_profile_key = p_profile_key;
  if not found then return null; end if;
  v_relationship := public.profile_viewer_relationship(v_profile.id, p_viewer_id);
  if v_relationship = 'blocked' then return null; end if;
  v_profile_allowed := v_relationship = 'owner' or v_profile.profile_visibility = 'public' or (v_profile.profile_visibility = 'friends' and v_relationship = 'friend') or (v_profile.profile_visibility = 'shared_groups' and v_relationship in ('friend', 'shared_group'));
  if not v_profile_allowed then return null; end if;
  v_avatar_visible := public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'avatar', v_profile.avatar_visibility), v_relationship);
  v_stats_visible := public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'statistics', 'private'), v_relationship);
  v_social_visible := public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'socialLinks', 'private'), v_relationship);
  if v_stats_visible then v_stats := public.profile_statistics_json(v_profile.id, v_profile.visible_stats); end if;
  if v_social_visible then select coalesce(jsonb_agg(link order by coalesce((link->>'order')::integer, 0)), '[]'::jsonb) into v_social from jsonb_array_elements(coalesce(v_profile.social_links, '[]'::jsonb)) link where (v_relationship = 'owner' and (link->>'visibility') in ('private', 'friends', 'shared_groups', 'public')) or (v_relationship = 'friend' and (link->>'visibility') in ('friends', 'shared_groups', 'public')) or (v_relationship = 'shared_group' and (link->>'visibility') in ('shared_groups', 'public')) or (v_relationship = 'outsider' and (link->>'visibility') = 'public'); end if;
  return pg_catalog.jsonb_build_object('profileKey', v_profile.public_profile_key, 'handle', case when public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'displayName', 'private'), v_relationship) then v_profile.handle else null end, 'displayName', case when public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'displayName', 'private'), v_relationship) then coalesce(v_profile.display_name, 'Member') else null end, 'bio', case when public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'bio', 'private'), v_relationship) then v_profile.bio else null end, 'avatarPath', case when v_avatar_visible then v_profile.avatar_path else null end, 'avatarPreset', v_profile.avatar_preset, 'profileAccent', case when public.profile_field_is_visible(v_profile.profile_visibility, coalesce(v_profile.profile_field_visibility->>'profileAccent', 'private'), v_relationship) then v_profile.profile_accent else 'coral' end, 'visibleStats', case when v_stats_visible then v_profile.visible_stats else '{}'::jsonb end, 'socialLinks', v_social, 'statistics', v_stats);
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
  if jsonb_typeof(coalesce(p_visible_stats, '{}'::jsonb)) <> 'object' or exists (select 1 from jsonb_each(coalesce(p_visible_stats, '{}'::jsonb)) item where jsonb_typeof(item.value) <> 'boolean') then raise exception 'Statistics visibility is invalid' using errcode = '22023'; end if;
  perform public.update_my_profile(p_display_name, p_bio, p_avatar_preset, p_interface_language, p_challenge_show_name, p_share_real_stance, p_handle, p_profile_accent, case when p_profile_visibility = 'public' then 'friends' else p_profile_visibility end, case when p_avatar_visibility = 'public' then 'friends' else p_avatar_visibility end, p_visible_stats);
  return public.update_my_profile_visibility(p_profile_visibility, p_avatar_visibility, p_field_visibility, p_social_links);
end;
$$;

revoke all on function public.profile_statistics_json(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_my_profile_v2(text, text, text, text, boolean, boolean, text, text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_my_profile_v2(text, text, text, text, boolean, boolean, text, text, text, text, jsonb, jsonb, jsonb) to authenticated;
