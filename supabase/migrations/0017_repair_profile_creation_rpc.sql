-- Repair profile creation for accounts that do not yet have a profile row.
-- Migration 0016 remains immutable after remote application.

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
  v_code text := 'SS-' || translate(pg_catalog.upper(pg_catalog.substr(pg_catalog.encode(extensions.gen_random_bytes(10), 'hex'), 1, 10)), '01', '23');
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles(id, public_profile_key, friend_code, friend_code_hash, friend_code_created_at, avatar_preset, interface_language, challenge_show_name, share_real_stance)
    values (v_user_id, extensions.gen_random_uuid(), v_code, pg_catalog.encode(extensions.digest(v_code, 'sha256'), 'hex'), pg_catalog.now(), 'orbit', 'en', false, false);
  end if;
  select * into v_existing from public.profiles where id = v_user_id for update;
  if v_handle is not null and (v_handle !~ '^[a-z0-9_]{3,24}$' or v_handle = any(array['admin','administrator','moderator','support','sideshift','system','official','staff','help'])) then
    raise exception 'Handle is invalid' using errcode = '22023';
  end if;
  if v_handle is distinct from v_existing.handle and v_existing.handle is not null and v_existing.handle_changed_at > pg_catalog.now() - interval '30 days' then
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
    handle_changed_at = case when v_handle is distinct from v_existing.handle then pg_catalog.now() else v_existing.handle_changed_at end,
    profile_accent = p_profile_accent,
    profile_visibility = p_profile_visibility,
    avatar_visibility = p_avatar_visibility,
    visible_stats = coalesce(p_visible_stats, '{}'::jsonb)
  where id = v_user_id;
  return public.get_my_private_profile();
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text, boolean, boolean, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_my_profile(text, text, text, text, boolean, boolean, text, text, text, text, jsonb) to authenticated;
