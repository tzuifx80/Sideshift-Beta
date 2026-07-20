-- Correct provider-domain validation without rewriting applied migration 0021.
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
    if v_link->>'provider' = 'github' and v_link->>'url' !~ '^https://(www[.])?github[.]com/' then raise exception 'Social link domain is invalid' using errcode = '22023'; end if;
    if v_link->>'provider' = 'instagram' and v_link->>'url' !~ '^https://(www[.])?instagram[.]com/' then raise exception 'Social link domain is invalid' using errcode = '22023'; end if;
  end loop;
  update public.profiles set profile_visibility = p_profile_visibility, avatar_visibility = p_avatar_visibility, profile_field_visibility = jsonb_set(coalesce(p_field_visibility, '{}'::jsonb), '{avatar}', to_jsonb(p_avatar_visibility), true), social_links = coalesce(p_social_links, '[]'::jsonb) where id = v_user_id;
  return public.get_my_private_profile();
end;
$$;

revoke all on function public.update_my_profile_visibility(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_my_profile_visibility(text, text, jsonb, jsonb) to authenticated;
