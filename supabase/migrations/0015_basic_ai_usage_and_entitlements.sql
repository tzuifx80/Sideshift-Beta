-- Phase 3: server-authoritative Basic AI usage and feedback delivery state.
-- Applied migrations 0001-0014 remain immutable.

alter table public.beta_feedback
  add column if not exists delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  add column if not exists delivery_attempted_at timestamptz null,
  add column if not exists delivery_error text null
    check (delivery_error is null or char_length(delivery_error) <= 300);

create table if not exists public.basic_ai_daily_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  debates_started integer not null default 0 check (debates_started >= 0),
  turns_generated integer not null default 0 check (turns_generated >= 0),
  evaluations_generated integer not null default 0 check (evaluations_generated >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

create table if not exists public.basic_ai_usage_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_id text not null check (char_length(request_id) between 1 and 80),
  request_scope text not null check (char_length(request_scope) between 1 and 180),
  debate_id uuid not null,
  action text not null check (action in ('turn', 'evaluation')),
  round_number integer not null check (round_number between 0 and 6),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed')),
  response jsonb null,
  attempts integer not null default 1 check (attempts between 1 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id),
  unique (user_id, request_scope)
);

alter table public.basic_ai_daily_usage enable row level security;
alter table public.basic_ai_usage_requests enable row level security;

create policy "basic_ai_daily_usage_select_own" on public.basic_ai_daily_usage
  for select using (auth.uid() = user_id);
create policy "basic_ai_usage_requests_select_own" on public.basic_ai_usage_requests
  for select using (auth.uid() = user_id);

revoke all on table public.basic_ai_daily_usage, public.basic_ai_usage_requests from anon, authenticated;
grant select on table public.basic_ai_daily_usage, public.basic_ai_usage_requests to authenticated;
revoke insert, update, delete on table public.beta_feedback from anon, authenticated;

create or replace function public.get_basic_ai_usage(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.basic_ai_daily_usage;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;
  select * into v_row from public.basic_ai_daily_usage
    where user_id = p_user_id and usage_date = (now() at time zone 'utc')::date;
  return pg_catalog.jsonb_build_object(
    'debatesStarted', coalesce(v_row.debates_started, 0),
    'turnsGenerated', coalesce(v_row.turns_generated, 0),
    'evaluationsGenerated', coalesce(v_row.evaluations_generated, 0),
    'usageDate', (now() at time zone 'utc')::date
  );
end;
$$;

create or replace function public.reserve_basic_ai_request(
  p_user_id uuid,
  p_debate_id uuid,
  p_request_id text,
  p_action text,
  p_round_number integer,
  p_daily_debates integer,
  p_max_rounds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage public.basic_ai_daily_usage;
  v_request public.basic_ai_usage_requests;
  v_scope text := p_debate_id::text || ':' || p_action || ':' || p_round_number::text;
  v_reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;
  if p_action not in ('turn', 'evaluation') or p_round_number not between 0 and 6
     or p_daily_debates < 1 or p_max_rounds < 1 then
    raise exception 'Invalid Basic AI usage request' using errcode = '22023';
  end if;

  insert into public.basic_ai_daily_usage(user_id, usage_date)
    values (p_user_id, (now() at time zone 'utc')::date)
    on conflict (user_id, usage_date) do nothing;
  select * into v_usage from public.basic_ai_daily_usage
    where user_id = p_user_id and usage_date = (now() at time zone 'utc')::date
    for update;

  select * into v_request from public.basic_ai_usage_requests
    where user_id = p_user_id and request_scope = v_scope
    for update;
  if v_request.id is not null then
    if v_request.status = 'completed' then
      return pg_catalog.jsonb_build_object('allowed', true, 'replayed', true, 'response', v_request.response,
        'debatesStarted', v_usage.debates_started, 'turnsGenerated', v_usage.turns_generated, 'evaluationsGenerated', v_usage.evaluations_generated);
    end if;
    if v_request.status = 'reserved' then
      return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'rate_limited');
    end if;
    if v_request.attempts >= 2 then
      return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'provider_unavailable');
    end if;
    update public.basic_ai_usage_requests set status = 'reserved', request_id = p_request_id, attempts = attempts + 1, updated_at = now() where id = v_request.id;
  else
    if p_action = 'turn' and p_round_number = 1 and v_usage.debates_started >= p_daily_debates then v_reason := 'quota_exhausted'; end if;
    if p_action = 'turn' and v_usage.turns_generated >= p_max_rounds then v_reason := 'quota_exhausted'; end if;
    if v_reason is not null then return pg_catalog.jsonb_build_object('allowed', false, 'reason', v_reason); end if;
    insert into public.basic_ai_usage_requests(user_id, usage_date, request_id, request_scope, debate_id, action, round_number)
      values (p_user_id, (now() at time zone 'utc')::date, p_request_id, v_scope, p_debate_id, p_action, p_round_number);
  end if;

  if p_action = 'turn' then
    update public.basic_ai_daily_usage set debates_started = debates_started + case when p_round_number = 1 then 1 else 0 end,
      turns_generated = turns_generated + 1, updated_at = now() where id = v_usage.id;
  else
    update public.basic_ai_daily_usage set evaluations_generated = evaluations_generated + 1, updated_at = now() where id = v_usage.id;
  end if;
  select * into v_usage from public.basic_ai_daily_usage where id = v_usage.id;
  return pg_catalog.jsonb_build_object('allowed', true, 'replayed', false, 'requestId', p_request_id,
    'debatesStarted', v_usage.debates_started, 'turnsGenerated', v_usage.turns_generated, 'evaluationsGenerated', v_usage.evaluations_generated);
exception when unique_violation then
  return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'rate_limited');
end;
$$;

create or replace function public.complete_basic_ai_request(p_user_id uuid, p_request_id text, p_response jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Server authorization required' using errcode = '42501'; end if;
  update public.basic_ai_usage_requests set status = 'completed', response = p_response, updated_at = now()
    where user_id = p_user_id and request_id = p_request_id and status = 'reserved';
end;
$$;

create or replace function public.fail_basic_ai_request(p_user_id uuid, p_request_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.basic_ai_usage_requests;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Server authorization required' using errcode = '42501'; end if;
  select * into v_request from public.basic_ai_usage_requests where user_id = p_user_id and request_id = p_request_id for update;
  if v_request.id is not null and v_request.status = 'reserved' then
    if v_request.action = 'turn' then
      update public.basic_ai_daily_usage set debates_started = debates_started - case when v_request.round_number = 1 then 1 else 0 end,
        turns_generated = turns_generated - 1, updated_at = now() where user_id = p_user_id and usage_date = v_request.usage_date;
    else
      update public.basic_ai_daily_usage set evaluations_generated = evaluations_generated - 1, updated_at = now() where user_id = p_user_id and usage_date = v_request.usage_date;
    end if;
    update public.basic_ai_usage_requests set status = 'failed', updated_at = now() where id = v_request.id;
  end if;
end;
$$;

-- Return the feedback id so the server can re-read the persisted row before notifying.
drop function if exists public.submit_beta_feedback(text, text, text, text, text, text);
create function public.submit_beta_feedback(
  p_category text, p_message text, p_surface text, p_screen text, p_ai_model_id text, p_app_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_message text := nullif(pg_catalog.btrim(coalesce(p_message, '')), '');
  v_screen text := pg_catalog.btrim(coalesce(p_screen, ''));
  v_app_version text := pg_catalog.btrim(coalesce(p_app_version, ''));
  v_id uuid;
begin
  if v_caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_category not in ('broken', 'ai_quality', 'design_usability', 'missing_topic', 'suggestion', 'other')
     or p_surface not in ('settings', 'debate_result')
     or pg_catalog.char_length(v_screen) not between 1 and 40
     or pg_catalog.char_length(v_app_version) not between 1 and 40
     or (p_ai_model_id is not null and pg_catalog.char_length(pg_catalog.btrim(p_ai_model_id)) > 160)
     or (v_message is not null and pg_catalog.char_length(v_message) > 600) then
    raise exception 'Feedback is invalid' using errcode = '22023';
  end if;
  perform public.enforce_user_rate_limit('beta_feedback_submit', 5, 3600);
  insert into public.beta_feedback(owner_id, category, message, surface, screen, ai_model_id, app_version)
    values (v_caller_id, p_category, v_message, p_surface, v_screen, nullif(pg_catalog.btrim(coalesce(p_ai_model_id, '')), ''), v_app_version)
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.get_basic_ai_usage(uuid) from public, anon, authenticated;
revoke all on function public.reserve_basic_ai_request(uuid, uuid, text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_basic_ai_request(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_basic_ai_request(uuid, text) from public, anon, authenticated;
grant execute on function public.get_basic_ai_usage(uuid) to service_role;
grant execute on function public.reserve_basic_ai_request(uuid, uuid, text, text, integer, integer, integer) to service_role;
grant execute on function public.complete_basic_ai_request(uuid, text, jsonb) to service_role;
grant execute on function public.fail_basic_ai_request(uuid, text) to service_role;
grant execute on function public.submit_beta_feedback(text, text, text, text, text, text) to authenticated;

create or replace function public.delete_my_basic_ai_usage()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  delete from public.basic_ai_usage_requests where user_id = auth.uid();
  delete from public.basic_ai_daily_usage where user_id = auth.uid();
end;
$$;
revoke all on function public.delete_my_basic_ai_usage() from public, anon;
grant execute on function public.delete_my_basic_ai_usage() to authenticated;
