-- Product feedback is separate from content reports and stores no transcript text.
create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('broken', 'ai_quality', 'design_usability', 'missing_topic', 'suggestion', 'other')),
  message text null check (message is null or char_length(message) <= 600),
  surface text not null check (surface in ('settings', 'debate_result')),
  screen text not null check (char_length(screen) between 1 and 40),
  ai_model_id text null check (ai_model_id is null or char_length(ai_model_id) <= 160),
  app_version text not null check (char_length(app_version) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;
create policy "beta_feedback_select_own" on public.beta_feedback for select using (auth.uid() = owner_id);
create policy "beta_feedback_insert_own" on public.beta_feedback for insert with check (auth.uid() = owner_id);
revoke update, delete on table public.beta_feedback from anon, authenticated;
grant select, insert on table public.beta_feedback to authenticated;

create or replace function public.delete_my_beta_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_anonymized integer := 0;
  v_reports integer := 0;
  v_debates integer := 0;
  v_challenges integer := 0;
  v_profiles integer := 0;
  v_preferences integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.challenge_responses set responder_id = null where responder_id = v_user_id;
  get diagnostics v_anonymized = row_count;
  delete from public.reports where reporter_id = v_user_id;
  get diagnostics v_reports = row_count;
  delete from public.beta_feedback where owner_id = v_user_id;
  delete from public.debates where owner_id = v_user_id;
  get diagnostics v_debates = row_count;
  delete from public.challenges where creator_id = v_user_id;
  get diagnostics v_challenges = row_count;
  delete from public.user_preferences where user_id = v_user_id;
  get diagnostics v_preferences = row_count;
  delete from public.profiles where id = v_user_id;
  get diagnostics v_profiles = row_count;
  delete from public.user_rate_limits where user_id = v_user_id;
  return pg_catalog.jsonb_build_object(
    'anonymizedResponses', v_anonymized,
    'reports', v_reports,
    'debates', v_debates,
    'challenges', v_challenges,
    'profiles', v_profiles,
    'preferences', v_preferences,
    'authAccount', 'anonymous identity retained until sign-out/session expiry'
  );
end;
$$;

revoke all on function public.delete_my_beta_data() from public;
grant execute on function public.delete_my_beta_data() to authenticated;
