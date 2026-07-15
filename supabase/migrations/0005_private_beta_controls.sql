-- Private-beta controls: user-scoped throttling, safe analytics, report RPC,
-- and deletion of beta data without deleting another user's challenge reply.

create table if not exists public.user_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 60),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, bucket)
);

alter table public.user_rate_limits enable row level security;
revoke all on table public.user_rate_limits from anon, authenticated;

create or replace function public.enforce_user_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'Invalid rate limit configuration' using errcode = '22023'; end if;
  select window_started_at, request_count into v_window_started_at, v_request_count
  from public.user_rate_limits
  where user_id = v_user_id and bucket = p_bucket
  for update;
  if not found then
    insert into public.user_rate_limits (user_id, bucket, window_started_at, request_count)
    values (v_user_id, p_bucket, pg_catalog.now(), 1);
    return;
  end if;
  if v_window_started_at <= pg_catalog.now() - (p_window_seconds * interval '1 second') then
    update public.user_rate_limits
    set window_started_at = pg_catalog.now(), request_count = 1
    where user_id = v_user_id and bucket = p_bucket;
    return;
  end if;
  if v_request_count >= p_limit then
    raise exception 'Rate limit exceeded. Try again later.' using errcode = 'P0001';
  end if;
  update public.user_rate_limits
  set request_count = request_count + 1
  where user_id = v_user_id and bucket = p_bucket;
end;
$$;

revoke all on function public.enforce_user_rate_limit(text, integer, integer) from public;
grant execute on function public.enforce_user_rate_limit(text, integer, integer) to authenticated;

-- Wrap the already-secure challenge RPCs so their original ownership and
-- expiry logic remains authoritative while authenticated callers are throttled.
alter function public.create_challenge(text, text, text, text) rename to create_challenge_unlimited;
alter function public.resolve_challenge(text) rename to resolve_challenge_unlimited;
alter function public.complete_challenge_response(text, text) rename to complete_challenge_response_unlimited;

create or replace function public.create_challenge(
  p_take_id text,
  p_mode text,
  p_creator_side text,
  p_creator_argument text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_user_rate_limit('challenge_create', 10, 60);
  return public.create_challenge_unlimited(p_take_id, p_mode, p_creator_side, p_creator_argument);
end;
$$;

create or replace function public.resolve_challenge(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
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
  perform public.enforce_user_rate_limit('challenge_response', 10, 60);
  return public.complete_challenge_response_unlimited(p_token, p_response_content);
end;
$$;

revoke all on function public.create_challenge_unlimited(text, text, text, text) from public, authenticated;
revoke all on function public.resolve_challenge_unlimited(text) from public, authenticated;
revoke all on function public.complete_challenge_response_unlimited(text, text) from public, authenticated;
revoke all on function public.create_challenge(text, text, text, text) from public;
revoke all on function public.resolve_challenge(text) from public;
revoke all on function public.complete_challenge_response(text, text) from public;
grant execute on function public.create_challenge(text, text, text, text) to authenticated;
grant execute on function public.resolve_challenge(text) to authenticated;
grant execute on function public.complete_challenge_response(text, text) to authenticated;

create or replace function public.submit_report(
  p_debate_id uuid,
  p_challenge_id uuid,
  p_reported_content_type text,
  p_reason text,
  p_details text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_reason text := pg_catalog.btrim(p_reason);
  v_details text := nullif(pg_catalog.btrim(coalesce(p_details, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_debate_id is null and p_challenge_id is null then raise exception 'A report needs a target' using errcode = '22023'; end if;
  if pg_catalog.char_length(v_reason) not between 1 and 80 then raise exception 'Report reason is invalid' using errcode = '22023'; end if;
  if v_details is not null and pg_catalog.char_length(v_details) > 1000 then raise exception 'Report details are too long' using errcode = '22023'; end if;
  perform public.enforce_user_rate_limit('report_submit', 10, 60);
  insert into public.reports (reporter_id, debate_id, challenge_id, reported_content_type, reason, details)
  values (auth.uid(), p_debate_id, p_challenge_id, pg_catalog.btrim(p_reported_content_type), v_reason, v_details)
  returning id into v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'status', 'open', 'created_at', pg_catalog.now());
end;
$$;

revoke all on function public.submit_report(uuid, uuid, text, text, text) from public;
grant execute on function public.submit_report(uuid, uuid, text, text, text) to authenticated;
revoke insert on table public.reports from authenticated;

-- Keep a respondent's answer on a creator's challenge, but anonymise the
-- responder reference when that responder deletes their beta data.
alter table public.challenge_responses alter column responder_id drop not null;
alter table public.challenge_responses drop constraint if exists challenge_responses_responder_id_fkey;
alter table public.challenge_responses
  add constraint challenge_responses_responder_id_fkey
  foreign key (responder_id) references auth.users(id) on delete set null;

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

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (event_name in (
    'landing_viewed', 'onboarding_started', 'onboarding_completed', 'take_viewed',
    'debate_started', 'debate_round_submitted', 'debate_completed', 'result_viewed',
    'share_attempted', 'challenge_created', 'challenge_opened', 'challenge_completed',
    'second_debate_started', 'report_submitted', 'installation_action_used',
    'recoverable_error_encountered'
  )),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_created_idx on public.analytics_events (event_name, created_at desc);
alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from anon, authenticated;
