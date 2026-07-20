-- The dashboard may lazily create the current season, so it must not be
-- declared stable/read-only. Migration 0028 remains applied and immutable.

create or replace function public.load_league_dashboard(p_league_type text, p_group_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  select id into v_config_id
  from public.league_configs
  where league_type = p_league_type
    and ((p_league_type = 'friends' and group_id is null) or group_id = p_group_id);

  if v_config_id is null then
    return jsonb_build_object('available', false, 'season', null, 'participants', '[]'::jsonb, 'myEvents', '[]'::jsonb, 'awards', '[]'::jsonb, 'pastSeasons', '[]'::jsonb);
  end if;

  v_season_id := public.ensure_league_season(v_config_id);
  select exists (
    select 1 from public.league_participants
    where season_id = v_season_id and user_id = auth.uid() and left_at is null
  ) into v_joined;

  select jsonb_build_object(
    'id', s.id, 'startAt', s.start_at, 'endAt', s.end_at, 'status', s.status,
    'scoringVersion', s.scoring_version, 'participantCount', s.participant_count
  ) into v_season
  from public.league_seasons s where s.id = v_season_id;

  if not v_joined then
    return jsonb_build_object('available', true, 'joined', false, 'season', v_season, 'participants', '[]'::jsonb, 'myEvents', '[]'::jsonb, 'awards', '[]'::jsonb, 'pastSeasons', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', ranked.user_id, 'displayName', ranked.display_name,
    'points', ranked.points, 'awardCount', ranked.award_count
  ) order by ranked.points desc, ranked.joined_at), '[]'::jsonb)
  into v_participants
  from (
    select p.user_id, coalesce(pr.display_name, 'Member') as display_name, p.joined_at,
      coalesce(sum(e.points), 0)::integer as points,
      (select count(*) from public.league_awards a where a.season_id = p.season_id and a.user_id = p.user_id)::integer as award_count
    from public.league_participants p
    left join public.profiles pr on pr.id = p.user_id
    left join public.league_score_events e on e.season_id = p.season_id and e.user_id = p.user_id
    where p.season_id = v_season_id and p.left_at is null
    group by p.user_id, p.season_id, p.joined_at, pr.display_name
  ) ranked;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'reason', e.reason, 'points', e.points,
    'occurredAt', e.occurred_at, 'category', e.category
  ) order by e.occurred_at desc), '[]'::jsonb)
  into v_events
  from public.league_score_events e
  where e.season_id = v_season_id and e.user_id = auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', a.user_id, 'award', a.award
  ) order by a.created_at desc), '[]'::jsonb)
  into v_awards
  from public.league_awards a
  where a.season_id = v_season_id and a.user_id = auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'startAt', s.start_at, 'endAt', s.end_at,
    'status', s.status, 'scoringVersion', s.scoring_version
  ) order by s.start_at desc), '[]'::jsonb)
  into v_past_seasons
  from public.league_seasons s
  where s.config_id = v_config_id and s.id <> v_season_id
    and exists (
      select 1 from public.league_participants p
      where p.season_id = s.id and p.user_id = auth.uid()
    );

  return jsonb_build_object(
    'available', true, 'joined', true, 'season', v_season,
    'participants', v_participants, 'myEvents', v_events,
    'awards', v_awards, 'pastSeasons', v_past_seasons
  );
end;
$$;
