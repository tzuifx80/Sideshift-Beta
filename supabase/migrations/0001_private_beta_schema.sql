create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  interface_language text not null default 'en' check (interface_language in ('en', 'de')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  topic_preferences jsonb not null default '[]'::jsonb,
  debate_languages jsonb not null default '["en"]'::jsonb,
  intensity text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_topic_preferences_is_array check (jsonb_typeof(topic_preferences) = 'array'),
  constraint user_preferences_debate_languages_is_array check (jsonb_typeof(debate_languages) = 'array')
);

create table if not exists public.debates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  take_id text not null,
  mode text not null check (mode in ('classic', 'sideswitch', 'blindside', 'commonground')),
  assigned_side text not null,
  opponent_type text not null,
  language text not null check (language in ('en', 'de')),
  status text not null check (status in ('active', 'completed', 'abandoned')),
  current_stage text not null,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists debates_owner_created_idx on public.debates (owner_id, created_at desc);
create unique index if not exists debates_one_active_per_owner_idx on public.debates (owner_id) where status = 'active';

create table if not exists public.debate_turns (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  author_type text not null check (author_type in ('user', 'opponent', 'system')),
  round_type text not null,
  content text not null check (char_length(content) between 1 and 700),
  sequence_number integer not null check (sequence_number >= 0),
  moderation_status text not null default 'visible',
  created_at timestamptz not null default now(),
  unique (debate_id, sequence_number)
);

create table if not exists public.stance_snapshots (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('before', 'after')),
  stance_value integer not null check (stance_value between -2 and 2),
  confidence integer not null check (confidence between 0 and 100),
  created_at timestamptz not null default now(),
  unique (debate_id, user_id, stage)
);

create table if not exists public.debate_results (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid unique not null references public.debates(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null,
  argument_dna jsonb not null,
  coaching jsonb,
  model_provider text,
  model_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  source_debate_id uuid references public.debates(id) on delete set null,
  take_id text not null,
  mode text not null check (mode in ('classic', 'sideswitch', 'blindside', 'commonground')),
  creator_side text not null,
  creator_argument text not null check (char_length(creator_argument) between 12 and 350),
  token_hash text unique not null,
  status text not null check (status in ('open', 'completed', 'expired', 'revoked')),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 5),
  completed_uses integer not null default 0 check (completed_uses between 0 and 5),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.challenge_responses (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid unique not null references public.challenges(id) on delete cascade,
  responder_id uuid not null references auth.users(id) on delete cascade,
  response_content text not null check (char_length(response_content) between 12 and 350),
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  debate_id uuid references public.debates(id) on delete set null,
  challenge_id uuid references public.challenges(id) on delete set null,
  reported_content_type text not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_has_target check (debate_id is not null or challenge_id is not null)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create trigger debates_set_updated_at
before update on public.debates
for each row execute function public.set_updated_at();

create unique index if not exists reports_duplicate_submission_idx on public.reports (
  reporter_id,
  coalesce(debate_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(reason)
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.debates enable row level security;
alter table public.debate_turns enable row level security;
alter table public.stance_snapshots enable row level security;
alter table public.debate_results enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_responses enable row level security;
alter table public.reports enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "preferences_select_own" on public.user_preferences for select using (auth.uid() = user_id);
create policy "preferences_insert_own" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "preferences_update_own" on public.user_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debates_select_own" on public.debates for select using (auth.uid() = owner_id);
create policy "debates_insert_own" on public.debates for insert with check (auth.uid() = owner_id);
create policy "debates_update_own" on public.debates for update using (auth.uid() = owner_id and status = 'active') with check (auth.uid() = owner_id);

create policy "turns_select_owner" on public.debate_turns for select using (
  exists (select 1 from public.debates d where d.id = debate_id and d.owner_id = auth.uid())
);

create policy "turns_insert_owner" on public.debate_turns for insert with check (
  exists (select 1 from public.debates d where d.id = debate_id and d.owner_id = auth.uid())
);

create policy "turns_update_owner" on public.debate_turns for update using (
  exists (select 1 from public.debates d where d.id = debate_id and d.owner_id = auth.uid())
) with check (
  exists (select 1 from public.debates d where d.id = debate_id and d.owner_id = auth.uid() and d.status = 'active')
);

create policy "stances_select_owner" on public.stance_snapshots for select using (auth.uid() = user_id);
create policy "stances_insert_owner" on public.stance_snapshots for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.debates d where d.id = debate_id and d.owner_id = auth.uid())
);
create policy "stances_update_owner" on public.stance_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "results_select_owner" on public.debate_results for select using (auth.uid() = owner_id);
create policy "results_insert_owner" on public.debate_results for insert with check (
  auth.uid() = owner_id
  and exists (select 1 from public.debates d where d.id = debate_id and d.owner_id = auth.uid())
);
create policy "results_update_owner" on public.debate_results for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "challenges_insert_owner" on public.challenges for insert with check (auth.uid() = creator_id);

create policy "reports_insert_owner" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_select_owner" on public.reports for select using (auth.uid() = reporter_id);

create or replace function public.create_challenge(
  p_take_id text,
  p_mode text,
  p_creator_side text,
  p_creator_argument text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
  v_expires timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode not in ('classic', 'sideswitch', 'blindside', 'commonground') then raise exception 'Invalid challenge mode' using errcode = '22023'; end if;
  if char_length(trim(p_creator_argument)) not between 12 and 350 then raise exception 'Challenge argument length is invalid' using errcode = '22023'; end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.challenges (creator_id, take_id, mode, creator_side, creator_argument, token_hash, status, expires_at)
  values (auth.uid(), p_take_id, p_mode, p_creator_side, trim(p_creator_argument), encode(digest(v_token, 'sha256'), 'hex'), 'open', v_expires)
  returning id into v_id;
  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'url', '/challenge/' || v_token,
    'expiresAt', v_expires,
    'takeId', p_take_id,
    'argument', trim(p_creator_argument),
    'mode', p_mode,
    'creatorSide', p_creator_side,
    'status', 'open',
    'response', null,
    'result', null
  );
end;
$$;

create or replace function public.resolve_challenge(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.challenges%rowtype;
  r public.challenge_responses%rowtype;
  v_allowed boolean := false;
begin
  select * into c from public.challenges where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if c.status = 'open' and c.expires_at < now() then
    update public.challenges set status = 'expired' where id = c.id;
    c.status := 'expired';
  end if;
  select * into r from public.challenge_responses where challenge_id = c.id;
  v_allowed := auth.uid() = c.creator_id or (r.responder_id is not null and auth.uid() = r.responder_id);
  return jsonb_build_object(
    'id', c.id,
    'token', p_token,
    'url', '/challenge/' || p_token,
    'expiresAt', c.expires_at,
    'takeId', c.take_id,
    'argument', c.creator_argument,
    'mode', c.mode,
    'creatorSide', c.creator_side,
    'status', c.status,
    'response', case when v_allowed then r.response_content else null end,
    'result', case when v_allowed then r.result_payload else null end
  );
end;
$$;

create or replace function public.complete_challenge_response(p_token text, p_response_content text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.challenges%rowtype;
  r public.challenge_responses%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if char_length(trim(p_response_content)) not between 12 and 350 then raise exception 'Challenge response length is invalid' using errcode = '22023'; end if;
  select * into c from public.challenges where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if c.creator_id = auth.uid() then raise exception 'You cannot respond to your own challenge' using errcode = '42501'; end if;
  if c.status = 'open' and c.expires_at < now() then update public.challenges set status = 'expired' where id = c.id; end if;
  if c.status <> 'open' then raise exception 'Challenge is not open' using errcode = '55000'; end if;
  if exists (select 1 from public.challenge_responses where challenge_id = c.id) then raise exception 'Challenge already answered' using errcode = '23505'; end if;
  v_result := jsonb_build_object(
    'total', least(100, greatest(0, 40 + round(char_length(trim(p_response_content)) / 4.0)::integer)),
    'createdAt', now(),
    'mode', c.mode
  );
  insert into public.challenge_responses (challenge_id, responder_id, response_content, result_payload, completed_at)
  values (c.id, auth.uid(), trim(p_response_content), v_result, now())
  returning * into r;
  update public.challenges set completed_uses = completed_uses + 1, status = 'completed', completed_at = now() where id = c.id;
  return jsonb_build_object(
    'id', c.id,
    'token', p_token,
    'url', '/challenge/' || p_token,
    'expiresAt', c.expires_at,
    'takeId', c.take_id,
    'argument', c.creator_argument,
    'mode', c.mode,
    'creatorSide', c.creator_side,
    'status', 'completed',
    'response', r.response_content,
    'result', v_result
  );
end;
$$;

create or replace function public.list_my_challenges()
returns setof jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'token', '',
    'url', '',
    'expiresAt', c.expires_at,
    'takeId', c.take_id,
    'argument', c.creator_argument,
    'mode', c.mode,
    'creatorSide', c.creator_side,
    'status', case when c.status = 'open' and c.expires_at < now() then 'expired' else c.status end,
    'response', r.response_content,
    'result', r.result_payload
  )
  from public.challenges c
  left join public.challenge_responses r on r.challenge_id = c.id
  where c.creator_id = auth.uid()
  order by c.created_at desc;
$$;

create or replace function public.revoke_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.challenges set status = 'revoked' where id = p_challenge_id and creator_id = auth.uid() and status = 'open';
  if not found then raise exception 'Challenge not found or cannot be revoked' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.create_challenge(text, text, text, text) from public;
revoke all on function public.resolve_challenge(text) from public;
revoke all on function public.complete_challenge_response(text, text) from public;
revoke all on function public.list_my_challenges() from public;
revoke all on function public.revoke_challenge(uuid) from public;
grant execute on function public.create_challenge(text, text, text, text) to authenticated;
grant execute on function public.resolve_challenge(text) to authenticated;
grant execute on function public.complete_challenge_response(text, text) to authenticated;
grant execute on function public.list_my_challenges() to authenticated;
grant execute on function public.revoke_challenge(uuid) to authenticated;
