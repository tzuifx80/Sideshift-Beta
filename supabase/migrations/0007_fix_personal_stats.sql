-- Use the existing debate_results timestamp for streak activity.
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
    select created_at as completed_at from public.debate_results where owner_id = v_user_id
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
