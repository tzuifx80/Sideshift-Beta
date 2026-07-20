-- Finalize expired private seasons on the next authenticated league request.
-- This keeps beta operations scheduler-free while freezing completed standings.

create or replace function public.finalize_expired_league_seasons()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_season public.league_seasons%rowtype;
  v_count integer := 0;
begin
  for v_season in
    select * from public.league_seasons
    where status = 'active' and end_at <= now()
    for update
  loop
    update public.league_seasons
    set status = 'completed', completed_at = now()
    where id = v_season.id;

    insert into public.league_awards(season_id, user_id, award, evidence)
    select v_season.id, p.user_id, 'Topic Explorer', jsonb_build_object('distinctCategories', count(distinct e.category))
    from public.league_participants p
    join public.league_score_events e on e.season_id = p.season_id and e.user_id = p.user_id
    where p.season_id = v_season.id
    group by p.user_id
    having count(distinct e.category) >= 3
    on conflict do nothing;

    insert into public.league_awards(season_id, user_id, award, evidence)
    select v_season.id, p.user_id, 'Most Consistent', jsonb_build_object('activeDays', count(distinct e.occurred_at::date))
    from public.league_participants p
    join public.league_score_events e on e.season_id = p.season_id and e.user_id = p.user_id
    where p.season_id = v_season.id
    group by p.user_id
    having count(distinct e.occurred_at::date) >= 3
    on conflict do nothing;

    insert into public.league_awards(season_id, user_id, award, evidence)
    select v_season.id, p.user_id, 'SideSwitch Specialist', jsonb_build_object('sideSwitches', count(*))
    from public.league_participants p
    join public.league_score_events e on e.season_id = p.season_id and e.user_id = p.user_id
    where p.season_id = v_season.id and e.reason = 'sideswitch'
    group by p.user_id
    having count(*) >= 1
    on conflict do nothing;

    insert into public.league_awards(season_id, user_id, award, evidence)
    select v_season.id, p.user_id, 'Team Contributor', jsonb_build_object('teamActivities', count(*))
    from public.league_participants p
    join public.league_score_events e on e.season_id = p.season_id and e.user_id = p.user_id
    where p.season_id = v_season.id and e.reason = 'team_debate'
    group by p.user_id
    having count(*) >= 1
    on conflict do nothing;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.finalize_expired_league_seasons() from public, anon, authenticated;

create or replace function public.ensure_league_season(p_config_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_config public.league_configs%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_key text;
  v_id uuid;
begin
  perform public.finalize_expired_league_seasons();
  select * into v_config from public.league_configs where id = p_config_id and enabled;
  if not found then raise exception 'League is unavailable' using errcode = 'P0002'; end if;
  v_start := date_trunc(case when v_config.cadence = 'monthly' then 'month' else 'week' end, now() at time zone 'UTC') at time zone 'UTC';
  v_end := case when v_config.cadence = 'monthly' then v_start + interval '1 month' else v_start + interval '7 days' end;
  v_key := to_char(v_start at time zone 'UTC', case when v_config.cadence = 'monthly' then 'YYYY-MM' else 'IYYY-IW' end);
  insert into public.league_seasons(config_id, season_key, start_at, end_at, status)
  values (p_config_id, v_key, v_start, v_end, 'active')
  on conflict (config_id, season_key) do update set status = case when public.league_seasons.status = 'scheduled' then 'active' else public.league_seasons.status end
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ensure_league_season(uuid) from public, anon, authenticated;
