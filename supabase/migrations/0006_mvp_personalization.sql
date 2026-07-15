-- Private profile/settings fields and owner-scoped personal statistics.

alter table public.profiles
  add column if not exists bio text,
  add column if not exists avatar_preset text not null default 'orbit',
  add column if not exists challenge_show_name boolean not null default false,
  add column if not exists share_real_stance boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_bio_length,
  add constraint profiles_bio_length check (char_length(coalesce(bio, '')) <= 160),
  drop constraint if exists profiles_avatar_preset,
  add constraint profiles_avatar_preset check (avatar_preset in ('orbit', 'spark', 'wave', 'sun', 'leaf'));

alter table public.user_preferences
  add column if not exists preferred_mode text not null default 'sideswitch',
  add column if not exists preferred_ai_style text not null default 'sharp-skeptic',
  add column if not exists theme text not null default 'system',
  add column if not exists accent text not null default 'coral',
  add column if not exists reduced_motion boolean not null default false,
  add column if not exists text_size text not null default 'comfortable',
  add column if not exists share_real_stance boolean not null default false;

alter table public.user_preferences
  drop constraint if exists user_preferences_preferred_mode,
  add constraint user_preferences_preferred_mode check (preferred_mode in ('classic', 'sideswitch', 'blindside', 'commonground')),
  drop constraint if exists user_preferences_theme,
  add constraint user_preferences_theme check (theme in ('system', 'light', 'dark')),
  drop constraint if exists user_preferences_accent,
  add constraint user_preferences_accent check (accent in ('violet', 'cyan', 'amber', 'coral', 'mint', 'neutral')),
  drop constraint if exists user_preferences_text_size,
  add constraint user_preferences_text_size check (text_size in ('compact', 'comfortable'));

create or replace function public.get_my_beta_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(activity.completed_at) order by activity.completed_at), '[]'::jsonb)
    into v_activity
  from (
    select created_at as completed_at from public.debate_results where owner_id = v_user_id and created_at is not null
    union all
    select completed_at from public.challenge_responses where responder_id = v_user_id and completed_at is not null
  ) activity;
  return pg_catalog.jsonb_build_object(
    'challengeCreated', (select count(*) from public.challenges where creator_id = v_user_id),
    'challengeResponses', (select count(*) from public.challenge_responses where responder_id = v_user_id),
    'activityDates', v_activity
  );
end;
$$;

revoke all on function public.get_my_beta_stats() from public;
grant execute on function public.get_my_beta_stats() to authenticated;
