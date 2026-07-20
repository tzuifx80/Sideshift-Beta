-- SideShift World Pulse and private Debate League.
-- Applied migrations 0001-0027 remain immutable. New work begins at 0028.

alter table public.user_preferences add column if not exists hide_sensitive_world_pulse boolean not null default false;

create table if not exists public.world_pulse_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'draft' check (status in ('draft', 'review', 'scheduled', 'published', 'expired', 'rejected', 'archived')),
  headline text not null check (char_length(headline) between 8 and 180),
  debate_statement text not null check (char_length(debate_statement) between 8 and 240),
  neutral_context text not null check (char_length(neutral_context) between 12 and 900),
  side_a_label text not null check (char_length(side_a_label) between 1 and 48),
  side_b_label text not null check (char_length(side_b_label) between 1 and 48),
  category text not null check (char_length(category) between 1 and 80),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2,3}$'),
  region text check (region is null or char_length(region) between 1 and 80),
  original_language text not null check (original_language in ('en', 'de', 'fr', 'es', 'it')),
  event_date timestamptz,
  publish_at timestamptz,
  expires_at timestamptz,
  last_reviewed_at timestamptz not null default now(),
  sensitivity text not null default 'standard' check (sensitivity in ('standard', 'sensitive', 'high_sensitivity')),
  source_count integer not null default 0 check (source_count between 0 and 20),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or publish_at is null or expires_at > publish_at)
);

create table if not exists public.world_pulse_translations (
  item_id uuid not null references public.world_pulse_items(id) on delete cascade,
  language text not null check (language in ('en', 'de', 'fr', 'es', 'it')),
  headline text not null check (char_length(headline) between 8 and 180),
  debate_statement text not null check (char_length(debate_statement) between 8 and 240),
  neutral_context text not null check (char_length(neutral_context) between 12 and 900),
  side_a_label text not null check (char_length(side_a_label) between 1 and 48),
  side_b_label text not null check (char_length(side_b_label) between 1 and 48),
  is_reviewed boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (item_id, language)
);

create table if not exists public.world_pulse_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.world_pulse_items(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  publisher text not null check (char_length(publisher) between 1 and 120),
  url text not null check (url ~ '^https://'),
  published_at timestamptz,
  accessed_at timestamptz not null default now(),
  source_type text not null check (char_length(source_type) between 1 and 40),
  language text not null check (language in ('en', 'de', 'fr', 'es', 'it')),
  unique (item_id, url)
);

create table if not exists public.world_pulse_editor_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'reviewer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.world_pulse_review_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.world_pulse_items(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('created', 'edited', 'review_requested', 'approved', 'rejected', 'scheduled', 'published', 'expired', 'archived')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists world_pulse_active_idx on public.world_pulse_items(status, publish_at, expires_at, updated_at desc);
create index if not exists world_pulse_source_item_idx on public.world_pulse_sources(item_id);
create unique index if not exists world_pulse_source_url_idx on public.world_pulse_sources(item_id, lower(url));

create or replace function public.can_edit_world_pulse(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.world_pulse_editor_roles r where r.user_id = p_user_id);
$$;

create or replace function public.world_pulse_public_json(p_item_id uuid, p_language text default 'en')
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'slug', i.slug, 'status', i.status,
    'headline', coalesce(t.headline, i.headline),
    'debateStatement', coalesce(t.debate_statement, i.debate_statement),
    'neutralContext', coalesce(t.neutral_context, i.neutral_context),
    'sideALabel', coalesce(t.side_a_label, i.side_a_label),
    'sideBLabel', coalesce(t.side_b_label, i.side_b_label),
    'category', i.category, 'countryCode', i.country_code, 'region', i.region,
    'languages', (select coalesce(jsonb_agg(x.language order by x.language), '[]'::jsonb) from public.world_pulse_translations x where x.item_id = i.id and x.is_reviewed),
    'originalLanguage', i.original_language, 'eventDate', i.event_date, 'publishAt', i.publish_at,
    'expiresAt', i.expires_at, 'lastReviewedAt', i.last_reviewed_at, 'sensitivity', i.sensitivity,
    'sourceCount', i.source_count,
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('title', s.title, 'publisher', s.publisher, 'url', s.url, 'publishedAt', s.published_at, 'accessedAt', s.accessed_at, 'sourceType', s.source_type, 'language', s.language) order by s.published_at desc nulls last, s.id), '[]'::jsonb) from public.world_pulse_sources s where s.item_id = i.id),
    'translationFallback', (t.item_id is null and p_language <> i.original_language),
    'createdAt', i.created_at, 'updatedAt', i.updated_at
  ) from public.world_pulse_items i
  left join public.world_pulse_translations t on t.item_id = i.id and t.language = p_language and t.is_reviewed
  where i.id = p_item_id;
$$;

create or replace function public.list_world_pulse_items(p_country_code text default null, p_region text default null, p_category text default null, p_language text default 'en', p_include_sensitive boolean default true, p_limit integer default 24, p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select public.world_pulse_public_json(i.id, case when p_language in ('en', 'de', 'fr', 'es', 'it') then p_language else 'en' end)
  from public.world_pulse_items i
  where auth.uid() is not null and i.status = 'published'
    and (i.publish_at is null or i.publish_at <= now())
    and (i.expires_at is null or i.expires_at > now())
    and (p_include_sensitive or i.sensitivity = 'standard')
    and (p_country_code is null or i.country_code = upper(p_country_code) or i.region = 'World')
    and (p_region is null or i.region = p_region or i.region = 'World')
    and (p_category is null or i.category = p_category)
  order by i.publish_at desc nulls last, i.updated_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_world_pulse_editor_items()
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'slug', i.slug, 'status', i.status, 'headline', i.headline, 'debateStatement', i.debate_statement, 'neutralContext', i.neutral_context, 'sideALabel', i.side_a_label, 'sideBLabel', i.side_b_label, 'category', i.category, 'countryCode', i.country_code, 'region', i.region, 'originalLanguage', i.original_language, 'eventDate', i.event_date, 'publishAt', i.publish_at, 'expiresAt', i.expires_at, 'lastReviewedAt', i.last_reviewed_at, 'sensitivity', i.sensitivity, 'sourceCount', i.source_count, 'createdAt', i.created_at, 'updatedAt', i.updated_at)
  from public.world_pulse_items i where public.can_edit_world_pulse() order by i.updated_at desc;
$$;

create or replace function public.save_world_pulse_draft(p_item_id uuid, p_payload jsonb, p_sources jsonb default '[]'::jsonb, p_translations jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(p_item_id, gen_random_uuid()); v_status text := coalesce(p_payload->>'status', 'draft'); v_source_count integer;
begin
  if not public.can_edit_world_pulse() then raise exception 'Editor access required' using errcode = '42501'; end if;
  if v_status not in ('draft', 'review', 'scheduled') then raise exception 'Use the review workflow for publication state' using errcode = '22023'; end if;
  if jsonb_typeof(p_sources) <> 'array' or jsonb_typeof(p_translations) <> 'array' then raise exception 'Sources and translations must be arrays' using errcode = '22023'; end if;
  insert into public.world_pulse_items(id, slug, status, headline, debate_statement, neutral_context, side_a_label, side_b_label, category, country_code, region, original_language, event_date, publish_at, expires_at, last_reviewed_at, sensitivity, created_by, reviewed_by)
  values (v_id, btrim(p_payload->>'slug'), v_status, btrim(p_payload->>'headline'), btrim(p_payload->>'debateStatement'), btrim(p_payload->>'neutralContext'), btrim(p_payload->>'sideALabel'), btrim(p_payload->>'sideBLabel'), btrim(p_payload->>'category'), nullif(upper(btrim(p_payload->>'countryCode')), ''), nullif(btrim(p_payload->>'region'), ''), coalesce(p_payload->>'originalLanguage', 'en'), nullif(p_payload->>'eventDate', '')::timestamptz, nullif(p_payload->>'publishAt', '')::timestamptz, nullif(p_payload->>'expiresAt', '')::timestamptz, coalesce(nullif(p_payload->>'lastReviewedAt', '')::timestamptz, now()), coalesce(p_payload->>'sensitivity', 'standard'), auth.uid(), auth.uid())
  on conflict (id) do update set slug = excluded.slug, status = excluded.status, headline = excluded.headline, debate_statement = excluded.debate_statement, neutral_context = excluded.neutral_context, side_a_label = excluded.side_a_label, side_b_label = excluded.side_b_label, category = excluded.category, country_code = excluded.country_code, region = excluded.region, original_language = excluded.original_language, event_date = excluded.event_date, publish_at = excluded.publish_at, expires_at = excluded.expires_at, last_reviewed_at = excluded.last_reviewed_at, sensitivity = excluded.sensitivity, updated_at = now();
  delete from public.world_pulse_sources where item_id = v_id;
  insert into public.world_pulse_sources(item_id, title, publisher, url, published_at, accessed_at, source_type, language)
  select v_id, x.title, x.publisher, x.url, x.published_at, coalesce(x.accessed_at, now()), x.source_type, x.language from jsonb_to_recordset(p_sources) x(title text, publisher text, url text, published_at timestamptz, accessed_at timestamptz, source_type text, language text);
  select count(*) into v_source_count from public.world_pulse_sources where item_id = v_id;
  update public.world_pulse_items set source_count = v_source_count, updated_at = now() where id = v_id;
  delete from public.world_pulse_translations where item_id = v_id;
  insert into public.world_pulse_translations(item_id, language, headline, debate_statement, neutral_context, side_a_label, side_b_label, is_reviewed, reviewed_by)
  select v_id, x.language, x.headline, x.debate_statement, x.neutral_context, x.side_a_label, x.side_b_label, coalesce(x.is_reviewed, false), case when coalesce(x.is_reviewed, false) then auth.uid() else null end from jsonb_to_recordset(p_translations) x(language text, headline text, debate_statement text, neutral_context text, side_a_label text, side_b_label text, is_reviewed boolean);
  insert into public.world_pulse_review_events(item_id, actor_id, action) values (v_id, auth.uid(), case when p_item_id is null then 'created' else 'edited' end);
  return v_id;
exception when others then raise;
end;
$$;

create or replace function public.review_world_pulse_item(p_item_id uuid, p_action text, p_reason text default null, p_scheduled_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_item public.world_pulse_items%rowtype; v_status text;
begin
  if not public.can_edit_world_pulse() then raise exception 'Editor access required' using errcode = '42501'; end if;
  select * into v_item from public.world_pulse_items where id = p_item_id for update;
  if not found then raise exception 'World Pulse item not found' using errcode = 'P0002'; end if;
  if p_action in ('approve', 'publish') and not exists (select 1 from public.world_pulse_editor_roles where user_id = auth.uid() and role in ('reviewer', 'admin')) then raise exception 'Reviewer access required' using errcode = '42501'; end if;
  if p_action = 'publish' and (v_item.source_count < case when v_item.sensitivity = 'standard' then 1 else 2 end or not exists (select 1 from public.world_pulse_translations where item_id = v_item.id and language = v_item.original_language and is_reviewed)) then raise exception 'Publication requirements are incomplete' using errcode = '22023'; end if;
  v_status := case p_action when 'request_review' then 'review' when 'approve' then 'scheduled' when 'schedule' then 'scheduled' when 'publish' then 'published' when 'reject' then 'rejected' when 'expire' then 'expired' when 'archive' then 'archived' else null end;
  if v_status is null then raise exception 'Unsupported review action' using errcode = '22023'; end if;
  update public.world_pulse_items set status = v_status, publish_at = case when p_action = 'schedule' then coalesce(p_scheduled_at, publish_at, now()) else publish_at end, reviewed_by = case when p_action in ('approve', 'publish') then auth.uid() else reviewed_by end, last_reviewed_at = case when p_action in ('approve', 'publish', 'expire') then now() else last_reviewed_at end, updated_at = now() where id = p_item_id;
  insert into public.world_pulse_review_events(item_id, actor_id, action, reason) values (p_item_id, auth.uid(), case p_action when 'request_review' then 'review_requested' when 'approve' then 'approved' when 'schedule' then 'scheduled' when 'publish' then 'published' when 'reject' then 'rejected' when 'expire' then 'expired' else 'archived' end, nullif(btrim(p_reason), ''));
  return public.world_pulse_public_json(p_item_id, v_item.original_language);
end;
$$;

create table if not exists public.league_configs (
  id uuid primary key default gen_random_uuid(),
  league_type text not null check (league_type in ('friends', 'group')),
  group_id uuid unique references public.groups(id) on delete cascade,
  cadence text not null default 'weekly' check (cadence in ('weekly', 'monthly')),
  enabled boolean not null default true,
  opt_in boolean not null default true,
  allowed_modes text[] not null default array['classic', 'sideswitch', 'blindside', 'commonground'],
  created_at timestamptz not null default now(),
  check ((league_type = 'friends' and group_id is null) or (league_type = 'group' and group_id is not null))
);

create unique index if not exists league_configs_friends_idx on public.league_configs(league_type) where league_type = 'friends';

create table if not exists public.league_seasons (
  id uuid primary key default gen_random_uuid(), config_id uuid not null references public.league_configs(id) on delete cascade,
  season_key text not null, start_at timestamptz not null, end_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'archived', 'cancelled')),
  scoring_version text not null default '2026-07-v1', participant_count integer not null default 0 check (participant_count >= 0),
  created_at timestamptz not null default now(), completed_at timestamptz, unique(config_id, season_key), check (end_at > start_at)
);

create table if not exists public.league_participants (
  season_id uuid not null references public.league_seasons(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(), left_at timestamptz, primary key(season_id, user_id)
);

create table if not exists public.league_score_events (
  id uuid primary key default gen_random_uuid(), season_id uuid not null references public.league_seasons(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  completion_id text not null, reason text not null check (reason in ('completed_debate', 'sideswitch', 'topic_variety', 'friend_challenge', 'team_debate', 'constructive_completion', 'weekly_consistency')),
  points integer not null check (points between 1 and 20), category text not null check (char_length(category) between 1 and 80), occurred_at timestamptz not null default now(), scoring_version text not null,
  unique(season_id, user_id, completion_id, reason)
);

create table if not exists public.league_awards (
  season_id uuid not null references public.league_seasons(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, award text not null check (award in ('Most Improved', 'Best Rebuttal', 'Best Listener', 'SideSwitch Specialist', 'Topic Explorer', 'Most Consistent', 'Team Contributor')), evidence jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), primary key(season_id, user_id, award)
);

create table if not exists public.league_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, season_id uuid references public.league_seasons(id) on delete cascade, kind text not null, message_key text not null, dismissed_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists league_season_active_idx on public.league_seasons(config_id, status, start_at, end_at);
create index if not exists league_event_user_idx on public.league_score_events(season_id, user_id, occurred_at desc);

create or replace function public.ensure_league_season(p_config_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_config public.league_configs%rowtype; v_start timestamptz; v_end timestamptz; v_key text; v_id uuid;
begin
  select * into v_config from public.league_configs where id = p_config_id and enabled;
  if not found then raise exception 'League is unavailable' using errcode = 'P0002'; end if;
  v_start := date_trunc(case when v_config.cadence = 'monthly' then 'month' else 'week' end, now());
  v_end := case when v_config.cadence = 'monthly' then v_start + interval '1 month' else v_start + interval '7 days' end;
  v_key := to_char(v_start at time zone 'UTC', case when v_config.cadence = 'monthly' then 'YYYY-MM' else 'IYYY-IW' end);
  insert into public.league_seasons(config_id, season_key, start_at, end_at, status) values (p_config_id, v_key, v_start, v_end, 'active') on conflict (config_id, season_key) do update set status = case when public.league_seasons.status = 'scheduled' then 'active' else public.league_seasons.status end returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.join_friends_league()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_config_id uuid; v_season_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.league_configs(league_type, cadence) values ('friends', 'weekly') on conflict (league_type) where league_type = 'friends' do nothing;
  select id into v_config_id from public.league_configs where league_type = 'friends'; v_season_id := public.ensure_league_season(v_config_id);
  insert into public.league_participants(season_id, user_id) values (v_season_id, auth.uid()) on conflict (season_id, user_id) do update set left_at = null;
  update public.league_seasons set participant_count = (select count(*) from public.league_participants where season_id = v_season_id and left_at is null) where id = v_season_id;
  return public.load_league_dashboard('friends', null);
end;
$$;

create or replace function public.join_group_league(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_config_id uuid; v_season_id uuid;
begin
  if public.group_role(p_group_id) = '' then raise exception 'Group membership required' using errcode = '42501'; end if;
  insert into public.league_configs(league_type, group_id) values ('group', p_group_id) on conflict (group_id) do nothing;
  select id into v_config_id from public.league_configs where group_id = p_group_id; v_season_id := public.ensure_league_season(v_config_id);
  insert into public.league_participants(season_id, user_id) values (v_season_id, auth.uid()) on conflict (season_id, user_id) do update set left_at = null;
  update public.league_seasons set participant_count = (select count(*) from public.league_participants where season_id = v_season_id and left_at is null) where id = v_season_id;
  return public.load_league_dashboard('group', p_group_id);
end;
$$;

create or replace function public.leave_current_league(p_league_type text, p_group_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_config_id uuid; v_season_id uuid;
begin
  select id into v_config_id from public.league_configs where league_type = p_league_type and ((p_league_type = 'friends' and group_id is null) or group_id = p_group_id);
  if v_config_id is null then return; end if; v_season_id := public.ensure_league_season(v_config_id);
  update public.league_participants set left_at = now() where season_id = v_season_id and user_id = auth.uid();
end;
$$;

create or replace function public.load_league_dashboard(p_league_type text, p_group_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_config_id uuid;
  v_season_id uuid;
  v_joined boolean;
  v_season jsonb;
  v_participants jsonb;
  v_events jsonb;
  v_awards jsonb;
  v_past_seasons jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select id into v_config_id from public.league_configs where league_type = p_league_type and ((p_league_type = 'friends' and group_id is null) or group_id = p_group_id);
  if v_config_id is null then return jsonb_build_object('available', false, 'season', null, 'participants', '[]'::jsonb, 'myEvents', '[]'::jsonb, 'awards', '[]'::jsonb, 'pastSeasons', '[]'::jsonb); end if;
  v_season_id := public.ensure_league_season(v_config_id);
  select exists (select 1 from public.league_participants where season_id = v_season_id and user_id = auth.uid() and left_at is null) into v_joined;

  select jsonb_build_object(
    'id', s.id,
    'startAt', s.start_at,
    'endAt', s.end_at,
    'status', s.status,
    'scoringVersion', s.scoring_version,
    'participantCount', s.participant_count
  ) into v_season
  from public.league_seasons s
  where s.id = v_season_id;

  if not v_joined then
    return jsonb_build_object(
      'available', true,
      'joined', false,
      'season', v_season,
      'participants', '[]'::jsonb,
      'myEvents', '[]'::jsonb,
      'awards', '[]'::jsonb,
      'pastSeasons', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', ranked.user_id,
    'displayName', ranked.display_name,
    'points', ranked.points,
    'awardCount', ranked.award_count
  ) order by ranked.points desc, ranked.joined_at), '[]'::jsonb)
  into v_participants
  from (
    select
      p.user_id,
      coalesce(pr.display_name, 'Member') as display_name,
      p.joined_at,
      coalesce(sum(e.points), 0)::integer as points,
      (select count(*) from public.league_awards a where a.season_id = p.season_id and a.user_id = p.user_id)::integer as award_count
    from public.league_participants p
    left join public.profiles pr on pr.id = p.user_id
    left join public.league_score_events e on e.season_id = p.season_id and e.user_id = p.user_id
    where p.season_id = v_season_id and p.left_at is null
    group by p.user_id, p.season_id, p.joined_at, pr.display_name
  ) ranked;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'reason', e.reason,
    'points', e.points,
    'occurredAt', e.occurred_at,
    'category', e.category
  ) order by e.occurred_at desc), '[]'::jsonb)
  into v_events
  from public.league_score_events e
  where e.season_id = v_season_id and e.user_id = auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', a.user_id,
    'award', a.award
  ) order by a.created_at desc), '[]'::jsonb)
  into v_awards
  from public.league_awards a
  where a.season_id = v_season_id and a.user_id = auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'startAt', s.start_at,
    'endAt', s.end_at,
    'status', s.status,
    'scoringVersion', s.scoring_version
  ) order by s.start_at desc), '[]'::jsonb)
  into v_past_seasons
  from public.league_seasons s
  where s.config_id = v_config_id
    and s.id <> v_season_id
    and exists (
      select 1
      from public.league_participants p
      where p.season_id = s.id and p.user_id = auth.uid()
    );

  return jsonb_build_object(
    'available', true,
    'joined', true,
    'season', v_season,
    'participants', v_participants,
    'myEvents', v_events,
    'awards', v_awards,
    'pastSeasons', v_past_seasons
  );
end;
$$;

create or replace function public.record_league_activity(p_completion_id text, p_activity_type text default 'completed_debate', p_group_id uuid default null, p_is_mock boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_config_id uuid;
  v_season_id uuid;
  v_category text;
  v_occurred_at timestamptz;
  v_mode text;
  v_reason text;
  v_points integer;
  v_day_points integer;
  v_scoring_version text;
begin
  if auth.uid() is null or p_is_mock or p_completion_id is null or char_length(p_completion_id) < 8 then return 0; end if;
  if p_activity_type not in ('completed_debate', 'friend_challenge', 'team_debate') then return 0; end if;

  if p_activity_type = 'completed_debate' then
    select
      coalesce(r.argument_dna #>> '{take,category}', 'Uncategorized'),
      d.completed_at,
      d.mode
    into v_category, v_occurred_at, v_mode
    from public.debates d
    left join public.debate_results r on r.debate_id = d.id
    where d.id::text = p_completion_id
      and d.owner_id = auth.uid()
      and d.status = 'completed';
    if v_occurred_at is null and v_category is null then return 0; end if;
    v_reason := 'completed_debate';
    v_points := 10;
  elsif p_activity_type = 'friend_challenge' then
    select 'Friend challenge', c.completed_at, 'friend_challenge'
    into v_category, v_occurred_at, v_reason
    from public.challenges c
    where c.id::text = p_completion_id
      and c.status = 'completed'
      and (
        c.creator_id = auth.uid()
        or exists (
          select 1 from public.challenge_responses cr
          where cr.challenge_id = c.id and cr.responder_id = auth.uid()
        )
      );
    if v_occurred_at is null then return 0; end if;
    v_points := 5;
  else
    select coalesce(t.topic ->> 'category', 'Team Debate'), t.completed_at, 'team_debate'
    into v_category, v_occurred_at, v_reason
    from public.team_debate_sessions t
    where t.id = p_completion_id
      and t.status in ('completed', 'ended')
      and t.facilitator_id = auth.uid()
      and (p_group_id is null or t.group_id = p_group_id);
    if v_occurred_at is null then return 0; end if;
    v_points := 5;
  end if;

  v_category := left(coalesce(v_category, 'Uncategorized'), 80);
  for v_config_id in select c.id from public.league_configs c where c.enabled and ((c.league_type = 'friends' and p_group_id is null) or (c.league_type = 'group' and c.group_id = p_group_id)) loop
    v_season_id := public.ensure_league_season(v_config_id);
    if exists (select 1 from public.league_participants where season_id = v_season_id and user_id = auth.uid() and left_at is null) then
      select coalesce(sum(e.points), 0), max(s.scoring_version)
      into v_day_points, v_scoring_version
      from public.league_score_events e
      join public.league_seasons s on s.id = e.season_id
      where e.season_id = v_season_id
        and e.user_id = auth.uid()
        and e.occurred_at::date = coalesce(v_occurred_at, now())::date;

      if v_day_points + v_points <= 30 then
        insert into public.league_score_events(season_id, user_id, completion_id, reason, points, category, occurred_at, scoring_version)
        values (v_season_id, auth.uid(), p_completion_id, v_reason, v_points, v_category, coalesce(v_occurred_at, now()), coalesce(v_scoring_version, 'v1'))
        on conflict do nothing;
        get diagnostics v_points = row_count;
        v_count := v_count + v_points;
      end if;

      if p_activity_type = 'completed_debate' and v_mode = 'sideswitch' then
        select coalesce(sum(e.points), 0) into v_day_points
        from public.league_score_events e
        where e.season_id = v_season_id and e.user_id = auth.uid() and e.occurred_at::date = coalesce(v_occurred_at, now())::date;
        if v_day_points + 4 <= 30 then
          insert into public.league_score_events(season_id, user_id, completion_id, reason, points, category, occurred_at, scoring_version)
          values (v_season_id, auth.uid(), p_completion_id, 'sideswitch', 4, v_category, coalesce(v_occurred_at, now()), coalesce(v_scoring_version, 'v1'))
          on conflict do nothing;
          get diagnostics v_points = row_count;
          v_count := v_count + v_points;
        end if;
      end if;

      if p_activity_type = 'completed_debate' and not exists (
        select 1 from public.league_score_events e
        where e.season_id = v_season_id and e.user_id = auth.uid() and e.reason = 'topic_variety' and e.category = v_category
      ) then
        select coalesce(sum(e.points), 0) into v_day_points
        from public.league_score_events e
        where e.season_id = v_season_id and e.user_id = auth.uid() and e.occurred_at::date = coalesce(v_occurred_at, now())::date;
        if v_day_points + 3 <= 30 then
          insert into public.league_score_events(season_id, user_id, completion_id, reason, points, category, occurred_at, scoring_version)
          values (v_season_id, auth.uid(), p_completion_id, 'topic_variety', 3, v_category, coalesce(v_occurred_at, now()), coalesce(v_scoring_version, 'v1'))
          on conflict do nothing;
          get diagnostics v_points = row_count;
          v_count := v_count + v_points;
        end if;
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;

alter table public.world_pulse_items enable row level security;
alter table public.world_pulse_translations enable row level security;
alter table public.world_pulse_sources enable row level security;
alter table public.world_pulse_editor_roles enable row level security;
alter table public.world_pulse_review_events enable row level security;
alter table public.league_configs enable row level security;
alter table public.league_seasons enable row level security;
alter table public.league_participants enable row level security;
alter table public.league_score_events enable row level security;
alter table public.league_awards enable row level security;
alter table public.league_notifications enable row level security;

revoke all on table public.world_pulse_items, public.world_pulse_translations, public.world_pulse_sources, public.world_pulse_editor_roles, public.world_pulse_review_events, public.league_configs, public.league_seasons, public.league_participants, public.league_score_events, public.league_awards, public.league_notifications from anon, authenticated;
revoke all on function public.can_edit_world_pulse(uuid), public.world_pulse_public_json(uuid, text), public.list_world_pulse_items(text, text, text, text, boolean, integer, integer), public.get_world_pulse_editor_items(), public.save_world_pulse_draft(uuid, jsonb, jsonb, jsonb), public.review_world_pulse_item(uuid, text, text, timestamptz), public.ensure_league_season(uuid), public.join_friends_league(), public.join_group_league(uuid), public.leave_current_league(text, uuid), public.load_league_dashboard(text, uuid), public.record_league_activity(text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.list_world_pulse_items(text, text, text, text, boolean, integer, integer), public.join_friends_league(), public.join_group_league(uuid), public.leave_current_league(text, uuid), public.load_league_dashboard(text, uuid), public.record_league_activity(text, text, uuid, boolean) to authenticated;
grant execute on function public.get_world_pulse_editor_items(), public.save_world_pulse_draft(uuid, jsonb, jsonb, jsonb), public.review_world_pulse_item(uuid, text, text, timestamptz) to authenticated;

insert into public.world_pulse_items(id, slug, status, headline, debate_statement, neutral_context, side_a_label, side_b_label, category, country_code, region, original_language, event_date, publish_at, expires_at, last_reviewed_at, sensitivity, source_count)
values
  ('00000000-0000-4000-8000-000000000281', 'school-start-times', 'published', 'Schools should start later', 'Schools should start later in the morning.', 'Later starts may support sleep, while families and transport schedules need to adapt. This is a stable demonstration item, not a live news claim.', 'Start later', 'Keep current times', 'School and Education', 'DE', 'Europe', 'en', '2026-08-01T00:00:00Z', '2026-07-01T00:00:00Z', '2026-12-31T00:00:00Z', '2026-07-20T00:00:00Z', 'standard', 2),
  ('00000000-0000-4000-8000-000000000282', 'ai-use-in-schools', 'scheduled', 'Schools should teach responsible AI use', 'Schools should teach responsible AI use as part of digital literacy.', 'Digital literacy can reduce misuse, while schools also need to protect independent thinking. This beta seed is a demonstration topic.', 'Teach it openly', 'Keep it outside school', 'AI and Technology', null, 'World', 'en', '2026-09-01T00:00:00Z', '2026-08-01T00:00:00Z', '2027-01-01T00:00:00Z', '2026-07-20T00:00:00Z', 'standard', 2),
  ('00000000-0000-4000-8000-000000000283', 'disaster-coverage-and-care', 'expired', 'How should public attention respond after a disaster?', 'Public communication after a disaster should prioritize practical help over continuous coverage.', 'People need useful, respectful information after harm. This sensitive demonstration item uses neutral, non-graphic wording.', 'Prioritize practical help', 'Keep broad coverage', 'Society and safety', null, 'World', 'en', '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z', '2026-06-01T00:00:00Z', '2026-07-20T00:00:00Z', 'sensitive', 2)
on conflict (id) do nothing;

insert into public.world_pulse_sources(item_id, title, publisher, url, accessed_at, source_type, language)
values
  ('00000000-0000-4000-8000-000000000281', 'About sleep and health', 'Centers for Disease Control and Prevention', 'https://www.cdc.gov/sleep/about_sleep/how_much_sleep.html', '2026-07-20T00:00:00Z', 'official', 'en'),
  ('00000000-0000-4000-8000-000000000281', 'Education policy and research', 'OECD', 'https://www.oecd.org/education/', '2026-07-20T00:00:00Z', 'institutional', 'en'),
  ('00000000-0000-4000-8000-000000000282', 'Guidance on AI and education', 'UNESCO', 'https://www.unesco.org/en/digital-education/artificial-intelligence', '2026-07-20T00:00:00Z', 'institutional', 'en'),
  ('00000000-0000-4000-8000-000000000282', 'Digital education', 'European Commission', 'https://education.ec.europa.eu/focus-topics/digital-education/action-plan', '2026-07-20T00:00:00Z', 'official', 'en'),
  ('00000000-0000-4000-8000-000000000283', 'Disaster risk reduction', 'United Nations', 'https://www.un.org/en/climatechange/climate-solutions/disaster-risk-reduction', '2026-07-20T00:00:00Z', 'official', 'en'),
  ('00000000-0000-4000-8000-000000000283', 'Ethical journalism and disaster reporting', 'International Federation of Journalists', 'https://www.ifj.org/who/rules-and-policy/global-charter-of-ethics-for-journalists', '2026-07-20T00:00:00Z', 'institutional', 'en')
on conflict (item_id, url) do nothing;

insert into public.world_pulse_translations(item_id, language, headline, debate_statement, neutral_context, side_a_label, side_b_label, is_reviewed)
values
  ('00000000-0000-4000-8000-000000000281', 'en', 'Schools should start later', 'Schools should start later in the morning.', 'Later starts may support sleep, while families and transport schedules need to adapt. This is a stable demonstration item, not a live news claim.', 'Start later', 'Keep current times', true),
  ('00000000-0000-4000-8000-000000000281', 'de', 'Schulen sollten später beginnen', 'Schulen sollten morgens später beginnen.', 'Spätere Anfangszeiten können Schlaf unterstützen, während Familien und Fahrpläne angepasst werden müssen. Dies ist ein stabiles Demonstrationsthema.', 'Später beginnen', 'Aktuelle Zeiten beibehalten', true),
  ('00000000-0000-4000-8000-000000000281', 'fr', 'Les écoles devraient commencer plus tard', 'Les écoles devraient commencer plus tard le matin.', 'Des horaires plus tardifs peuvent favoriser le sommeil, tandis que les familles et les transports doivent s’adapter. Il s’agit d’un sujet de démonstration stable.', 'Commencer plus tard', 'Garder les horaires actuels', true),
  ('00000000-0000-4000-8000-000000000281', 'es', 'Las escuelas deberían empezar más tarde', 'Las escuelas deberían empezar más tarde por la mañana.', 'Empezar más tarde puede favorecer el sueño, mientras las familias y el transporte deben adaptarse. Es un tema de demostración estable.', 'Empezar más tarde', 'Mantener los horarios actuales', true),
  ('00000000-0000-4000-8000-000000000281', 'it', 'Le scuole dovrebbero iniziare più tardi', 'Le scuole dovrebbero iniziare più tardi al mattino.', 'Orari più tardi possono favorire il sonno, mentre famiglie e trasporti devono adattarsi. È un tema dimostrativo stabile.', 'Iniziare più tardi', 'Mantenere gli orari attuali', true),
  ('00000000-0000-4000-8000-000000000282', 'en', 'Schools should teach responsible AI use', 'Schools should teach responsible AI use as part of digital literacy.', 'Digital literacy can reduce misuse, while schools also need to protect independent thinking. This beta seed is a demonstration topic.', 'Teach it openly', 'Keep it outside school', true),
  ('00000000-0000-4000-8000-000000000283', 'en', 'How should public attention respond after a disaster?', 'Public communication after a disaster should prioritize practical help over continuous coverage.', 'People need useful, respectful information after harm. This sensitive demonstration item uses neutral, non-graphic wording.', 'Prioritize practical help', 'Keep broad coverage', true)
on conflict (item_id, language) do nothing;

update public.world_pulse_items i set source_count = (select count(*) from public.world_pulse_sources s where s.item_id = i.id) where i.id in ('00000000-0000-4000-8000-000000000281', '00000000-0000-4000-8000-000000000282', '00000000-0000-4000-8000-000000000283');
