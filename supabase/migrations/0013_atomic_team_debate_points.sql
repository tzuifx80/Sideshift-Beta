-- Award the fixed Team Debate participation points in the same transaction as
-- persisting completion. This prevents a refresh from interrupting a separate
-- client-side award RPC after the completed session has already rendered.

create or replace function public.save_team_debate_session(
  p_id text,
  p_group_id uuid,
  p_status text,
  p_topic jsonb,
  p_teams jsonb,
  p_snapshot jsonb,
  p_completed_at timestamptz,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_existing_facilitator uuid;
  v_points_awarded boolean;
  v_points_updated integer;
begin
  if v_caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_id, ''))) not between 1 and 128
     or p_status not in ('active', 'paused', 'completed', 'ended')
     or p_topic is null
     or pg_catalog.jsonb_typeof(p_topic) <> 'object'
     or p_teams is null
     or pg_catalog.jsonb_typeof(p_teams) <> 'array'
     or p_snapshot is null
     or pg_catalog.jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Team Debate session is invalid' using errcode = '22023';
  end if;
  if p_group_id is not null and public.group_role(p_group_id, v_caller_id) = '' then
    raise exception 'Group membership required' using errcode = '42501';
  end if;

  select facilitator_id into v_existing_facilitator
  from public.team_debate_sessions
  where id = pg_catalog.btrim(p_id)
  for update;
  if found then
    if v_existing_facilitator <> v_caller_id then
      raise exception 'Team Debate session belongs to another facilitator' using errcode = '42501';
    end if;
    update public.team_debate_sessions
    set group_id = p_group_id,
        status = p_status,
        topic = p_topic,
        teams = p_teams,
        snapshot = p_snapshot,
        updated_at = coalesce(p_updated_at, pg_catalog.now()),
        completed_at = p_completed_at
    where id = pg_catalog.btrim(p_id);
  else
    insert into public.team_debate_sessions(
      id, facilitator_id, group_id, status, topic, teams, snapshot,
      updated_at, completed_at
    )
    values (
      pg_catalog.btrim(p_id), v_caller_id, p_group_id, p_status, p_topic,
      p_teams, p_snapshot, coalesce(p_updated_at, pg_catalog.now()), p_completed_at
    );
  end if;

  if p_status = 'completed'
     and p_group_id is not null
     and exists (
       select 1 from public.groups
       where id = p_group_id and leaderboard_enabled and not archived
     ) then
    select points_awarded into v_points_awarded
    from public.team_debate_sessions
    where id = pg_catalog.btrim(p_id)
    for update;
    if not coalesce(v_points_awarded, false) then
      update public.team_debate_sessions
      set points_awarded = true
      where id = pg_catalog.btrim(p_id)
        and facilitator_id = v_caller_id
        and not points_awarded;
      get diagnostics v_points_updated = row_count;
      if v_points_updated = 1 then
        insert into public.group_points(group_id, user_id, points, debates_completed, constructive)
        values (p_group_id, v_caller_id, 20, 1, true)
        on conflict (group_id, user_id) do update
          set points = public.group_points.points + 20,
              debates_completed = public.group_points.debates_completed + 1,
              constructive = true,
              updated_at = pg_catalog.now();
      end if;
    end if;
  end if;
end;
$$;
