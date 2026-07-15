-- Stabilize collaboration authorization, ownership cleanup, and server-enforced throttles.
-- Migration 0011 is already applied and remains immutable. This migration repairs
-- its functions and data boundaries without widening product scope.

-- Preserve shared groups without retaining an anonymous owner identifier.
alter table public.groups
  alter column owner_id drop not null;
alter table public.groups
  drop constraint if exists groups_owner_id_fkey;
alter table public.groups
  add constraint groups_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

-- Repair the historical default/data symbol without rewriting migration 0011.
alter table public.groups alter column icon set default '✦';
update public.groups set icon = '✦' where icon in ('âœ¦', 'Ã¢Å“Â¦');

create or replace function public.group_role(p_group_id uuid, p_user_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null or p_user_id is distinct from v_caller_id then
    return '';
  end if;
  return coalesce((
    select case
      when g.owner_id = v_caller_id then 'owner'
      else coalesce(m.membership_role, '')
    end
    from public.groups g
    left join public.group_members m
      on m.group_id = g.id
     and m.user_id = v_caller_id
    where g.id = p_group_id
      and g.archived = false
      and (g.owner_id = v_caller_id or m.user_id is not null)
  ), '');
end;
$$;

create or replace function public.group_summary_json(p_group_id uuid, p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return null;
  end if;
  v_role := public.group_role(p_group_id, auth.uid());
  return (
    select pg_catalog.jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'description', g.description,
      'icon', g.icon,
      'accent', g.accent,
      'language', g.language,
      'role', v_role,
      'memberCount', (select pg_catalog.count(*) from public.group_members m where m.group_id = g.id),
      'leaderboardEnabled', g.leaderboard_enabled,
      'updatedAt', g.updated_at
    )
    from public.groups g
    where g.id = p_group_id
      and g.archived = false
      and v_role <> ''
  );
end;
$$;

create or replace function public.create_group(
  p_name text,
  p_description text,
  p_rules text,
  p_icon text,
  p_accent text,
  p_language text,
  p_member_limit integer,
  p_leaderboard_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_group_id uuid;
  v_name text := pg_catalog.btrim(coalesce(p_name, ''));
  v_description text := pg_catalog.btrim(coalesce(p_description, ''));
  v_rules text := pg_catalog.btrim(coalesce(p_rules, ''));
  v_icon text := pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_icon), ''), '✦'), 8);
  v_accent text := pg_catalog.left(pg_catalog.btrim(coalesce(p_accent, '')), 32);
begin
  if v_caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if pg_catalog.char_length(v_name) not between 2 and 60
     or pg_catalog.char_length(v_description) > 240
     or pg_catalog.char_length(v_rules) > 600
     or pg_catalog.char_length(v_accent) not between 1 and 32
     or p_language not in ('en', 'de')
     or (p_member_limit is not null and p_member_limit not between 2 and 500)
     or p_leaderboard_enabled is null then
    raise exception 'Group details are invalid' using errcode = '22023';
  end if;

  perform public.enforce_user_rate_limit('group_create', 3, 3600);
  insert into public.groups(owner_id, name, description, rules, icon, accent, language, member_limit, leaderboard_enabled)
  values (v_caller_id, v_name, v_description, v_rules, v_icon, v_accent, p_language, p_member_limit, p_leaderboard_enabled)
  returning id into v_group_id;
  insert into public.group_members(group_id, user_id, membership_role)
  values (v_group_id, v_caller_id, 'owner');
  insert into public.group_points(group_id, user_id)
  values (v_group_id, v_caller_id);
  return public.group_summary_json(v_group_id, v_caller_id);
end;
$$;

create or replace function public.list_my_groups()
returns setof jsonb
language sql
security definer
set search_path = ''
as $$
  select public.group_summary_json(g.id, auth.uid())
  from public.groups g
  where auth.uid() is not null
    and public.group_role(g.id, auth.uid()) <> ''
    and g.archived = false
  order by g.updated_at desc;
$$;

create or replace function public.load_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  v_summary := public.group_summary_json(p_group_id, auth.uid());
  if v_summary is null then
    raise exception 'Group not found or access denied' using errcode = '42501';
  end if;
  v_role := public.group_role(p_group_id, auth.uid());
  return pg_catalog.jsonb_build_object(
    'summary', v_summary,
    'rules', (select g.rules from public.groups g where g.id = p_group_id and not g.archived),
    'members', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'userId', m.user_id,
          'displayName', coalesce(p.display_name, 'Member'),
          'role', m.membership_role,
          'points', coalesce(gp.points, 0),
          'debatesCompleted', coalesce(gp.debates_completed, 0),
          'constructive', coalesce(gp.constructive, false)
        )
        order by coalesce(gp.points, 0) desc, m.joined_at asc
      )
      from public.group_members m
      left join public.profiles p on p.id = m.user_id
      left join public.group_points gp on gp.group_id = m.group_id and gp.user_id = m.user_id
      where m.group_id = p_group_id
    ), '[]'::jsonb),
    'topics', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', t.id,
          'groupId', t.group_id,
          'statement', t.statement,
          'context', t.context,
          'sideLabels', pg_catalog.jsonb_build_array(t.support_label, t.question_label),
          'category', t.category,
          'language', t.language,
          'sensitivity', t.sensitivity,
          'creatorId', t.creator_id,
          'status', t.status,
          'createdAt', t.created_at
        )
        order by t.created_at desc
      )
      from public.group_topics t
      where t.group_id = p_group_id
        and (t.status <> 'pending' or v_role in ('owner', 'moderator'))
    ), '[]'::jsonb),
    'invites', case
      when v_role in ('owner', 'moderator') then coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', i.id,
            'groupId', i.group_id,
            'code', '',
            'expiresAt', i.expires_at,
            'maxUses', i.max_uses,
            'uses', i.uses,
            'revoked', i.revoked
          )
          order by i.created_at desc
        )
        from public.group_invites i
        where i.group_id = p_group_id
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  );
end;
$$;

create or replace function public.create_group_invite(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_code text := 'SS-' || pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(18), 'hex'));
  v_id uuid;
  v_expires timestamptz := pg_catalog.now() + interval '7 days';
begin
  if v_caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if public.group_role(p_group_id, v_caller_id) not in ('owner', 'moderator') then
    raise exception 'Only the owner or a moderator can invite members' using errcode = '42501';
  end if;
  perform public.enforce_user_rate_limit('group_invite_create', 10, 3600);
  insert into public.group_invites(group_id, created_by, code_hash, expires_at, max_uses)
  values (p_group_id, v_caller_id, pg_catalog.encode(extensions.digest(v_code, 'sha256'), 'hex'), v_expires, 20)
  returning id into v_id;
  return pg_catalog.jsonb_build_object(
    'id', v_id,
    'groupId', p_group_id,
    'code', v_code,
    'expiresAt', v_expires,
    'maxUses', 20,
    'uses', 0,
    'revoked', false
  );
end;
$$;

create or replace function public.join_group_by_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_code text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_code, '')));
  v_invite public.group_invites%rowtype;
  v_group public.groups%rowtype;
  v_updated integer;
begin
  if v_caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if pg_catalog.char_length(v_code) not between 8 and 80 then
    raise exception 'Invite is invalid or expired' using errcode = 'P0002';
  end if;
  perform public.enforce_user_rate_limit('group_invite_join', 10, 3600);
  select * into v_invite
  from public.group_invites
  where code_hash = pg_catalog.encode(extensions.digest(v_code, 'sha256'), 'hex')
  for update;
  if not found
     or v_invite.revoked
     or (v_invite.expires_at is not null and v_invite.expires_at < pg_catalog.now())
     or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses) then
    raise exception 'Invite is invalid or expired' using errcode = 'P0002';
  end if;
  select * into v_group
  from public.groups
  where id = v_invite.group_id and not archived;
  if not found then
    raise exception 'Group is unavailable' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.group_members
    where group_id = v_group.id and user_id = v_caller_id
  ) then
    return public.group_summary_json(v_group.id, v_caller_id);
  end if;
  if v_group.member_limit is not null
     and (select pg_catalog.count(*) from public.group_members where group_id = v_group.id) >= v_group.member_limit then
    raise exception 'Group member limit reached' using errcode = '22023';
  end if;
  insert into public.group_members(group_id, user_id, membership_role)
  values (v_group.id, v_caller_id, 'member');
  insert into public.group_points(group_id, user_id)
  values (v_group.id, v_caller_id)
  on conflict do nothing;
  update public.group_invites
  set uses = uses + 1
  where id = v_invite.id
    and not revoked
    and (expires_at is null or expires_at >= pg_catalog.now())
    and (max_uses is null or uses < max_uses);
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Invite is invalid or expired' using errcode = 'P0002';
  end if;
  return public.group_summary_json(v_group.id, v_caller_id);
end;
$$;

create or replace function public.create_group_topic(
  p_group_id uuid,
  p_statement text,
  p_context text,
  p_support_label text,
  p_question_label text,
  p_category text,
  p_language text,
  p_sensitivity text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_role text := public.group_role(p_group_id, auth.uid());
  v_statement text := pg_catalog.btrim(coalesce(p_statement, ''));
  v_context text := pg_catalog.btrim(coalesce(p_context, ''));
  v_support_label text := pg_catalog.btrim(coalesce(p_support_label, ''));
  v_question_label text := pg_catalog.btrim(coalesce(p_question_label, ''));
  v_category text := pg_catalog.btrim(coalesce(p_category, ''));
  v_status text := 'pending';
  v_id uuid;
begin
  if v_caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_role = '' then
    raise exception 'Group membership required' using errcode = '42501';
  end if;
  if pg_catalog.char_length(v_statement) not between 8 and 240
     or pg_catalog.char_length(v_context) > 600
     or pg_catalog.char_length(v_support_label) not between 1 and 28
     or pg_catalog.char_length(v_question_label) not between 1 and 28
     or pg_catalog.char_length(v_category) not between 1 and 60
     or p_language not in ('en', 'de')
     or p_sensitivity not in ('standard', 'sensitive') then
    raise exception 'Group topic is invalid' using errcode = '22023';
  end if;
  if v_role in ('owner', 'moderator') then
    v_status := 'approved';
  end if;
  perform public.enforce_user_rate_limit('group_topic_create', 20, 3600);
  insert into public.group_topics(
    group_id, statement, context, support_label, question_label,
    category, language, sensitivity, creator_id, status
  )
  values (
    p_group_id, v_statement, v_context, v_support_label, v_question_label,
    v_category, p_language, p_sensitivity, v_caller_id, v_status
  )
  returning id into v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;

create or replace function public.record_group_participation(p_group_id uuid, p_points integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_session_id text;
  v_updated integer;
begin
  if v_caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if public.group_role(p_group_id, v_caller_id) = '' then
    raise exception 'Group membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.groups
    where id = p_group_id and leaderboard_enabled and not archived
  ) then
    return;
  end if;
  select id into v_session_id
  from public.team_debate_sessions
  where facilitator_id = v_caller_id
    and group_id = p_group_id
    and status = 'completed'
    and not points_awarded
  order by completed_at desc nulls last
  limit 1
  for update;
  if v_session_id is null then
    return;
  end if;
  update public.team_debate_sessions
  set points_awarded = true
  where id = v_session_id
    and facilitator_id = v_caller_id
    and not points_awarded;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return;
  end if;
  -- The caller cannot choose the recipient or amount. This fixed award is
  -- derived from one facilitator-owned completed session and is idempotent.
  insert into public.group_points(group_id, user_id, points, debates_completed, constructive)
  values (p_group_id, v_caller_id, 20, 1, true)
  on conflict (group_id, user_id) do update
    set points = public.group_points.points + 20,
        debates_completed = public.group_points.debates_completed + 1,
        constructive = true,
        updated_at = pg_catalog.now();
end;
$$;

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
end;
$$;

create or replace function public.submit_beta_feedback(
  p_category text,
  p_message text,
  p_surface text,
  p_screen text,
  p_ai_model_id text,
  p_app_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_message text := nullif(pg_catalog.btrim(coalesce(p_message, '')), '');
  v_screen text := pg_catalog.btrim(coalesce(p_screen, ''));
  v_app_version text := pg_catalog.btrim(coalesce(p_app_version, ''));
begin
  if v_caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_category not in ('broken', 'ai_quality', 'design_usability', 'missing_topic', 'suggestion', 'other')
     or p_surface not in ('settings', 'debate_result')
     or pg_catalog.char_length(v_screen) not between 1 and 40
     or pg_catalog.char_length(v_app_version) not between 1 and 40
     or (p_ai_model_id is not null and pg_catalog.char_length(pg_catalog.btrim(p_ai_model_id)) > 160)
     or (v_message is not null and pg_catalog.char_length(v_message) > 600) then
    raise exception 'Feedback is invalid' using errcode = '22023';
  end if;
  perform public.enforce_user_rate_limit('beta_feedback_submit', 5, 3600);
  insert into public.beta_feedback(
    owner_id, category, message, surface, screen, ai_model_id, app_version
  )
  values (
    v_caller_id, p_category, v_message, p_surface, v_screen,
    nullif(pg_catalog.btrim(coalesce(p_ai_model_id, '')), ''), v_app_version
  );
end;
$$;

-- The deletion RPC is owner-scoped and keeps shared records structurally valid.
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
  v_rate_limits integer := 0;
  v_memberships integer := 0;
  v_points integer := 0;
  v_invites integer := 0;
  v_topics integer := 0;
  v_team_sessions integer := 0;
  v_ai_feedback integer := 0;
  v_beta_feedback integer := 0;
  v_groups_archived integer := 0;
  v_groups_deleted integer := 0;
  v_group_id uuid;
  v_has_other_members boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.challenge_responses
  set responder_id = null,
      result_payload = case
        when result_payload is null then null
        else pg_catalog.replace(result_payload::text, v_user_id::text, '[deleted-user]')::jsonb
      end
  where responder_id = v_user_id;
  get diagnostics v_anonymized = row_count;

  -- Redact this identifier from JSON owned by other users before this
  -- account's private rows are removed.
  update public.debates as d
  set snapshot = pg_catalog.replace(d.snapshot::text, v_user_id::text, '[deleted-user]')::jsonb
  where pg_catalog.strpos(d.snapshot::text, v_user_id::text) > 0
    and d.owner_id <> v_user_id;
  update public.debate_results
  set scores = pg_catalog.replace(scores::text, v_user_id::text, '[deleted-user]')::jsonb,
      argument_dna = pg_catalog.replace(argument_dna::text, v_user_id::text, '[deleted-user]')::jsonb,
      coaching = case
        when coaching is null then null
        else pg_catalog.replace(coaching::text, v_user_id::text, '[deleted-user]')::jsonb
      end
  where owner_id <> v_user_id
    and (
      pg_catalog.strpos(scores::text, v_user_id::text) > 0
      or pg_catalog.strpos(argument_dna::text, v_user_id::text) > 0
      or (coaching is not null and pg_catalog.strpos(coaching::text, v_user_id::text) > 0)
    );
  update public.team_debate_sessions as t
  set topic = pg_catalog.replace(t.topic::text, v_user_id::text, '[deleted-user]')::jsonb,
      teams = pg_catalog.replace(t.teams::text, v_user_id::text, '[deleted-user]')::jsonb,
      snapshot = pg_catalog.replace(t.snapshot::text, v_user_id::text, '[deleted-user]')::jsonb
  where t.facilitator_id <> v_user_id
    and (
      pg_catalog.strpos(t.topic::text, v_user_id::text) > 0
      or pg_catalog.strpos(t.teams::text, v_user_id::text) > 0
      or pg_catalog.strpos(t.snapshot::text, v_user_id::text) > 0
    );

  delete from public.reports r
  where r.reporter_id = v_user_id
     or exists (
       select 1 from public.debates d
       where d.id = r.debate_id and d.owner_id = v_user_id
     )
     or exists (
       select 1 from public.challenges c
       where c.id = r.challenge_id and c.creator_id = v_user_id
     );
  get diagnostics v_reports = row_count;

  delete from public.ai_quality_feedback where owner_id = v_user_id;
  get diagnostics v_ai_feedback = row_count;
  delete from public.beta_feedback where owner_id = v_user_id;
  get diagnostics v_beta_feedback = row_count;

  delete from public.team_debate_sessions where facilitator_id = v_user_id;
  get diagnostics v_team_sessions = row_count;

  for v_group_id in
    select g.id
    from public.groups g
    where g.owner_id = v_user_id
    for update
  loop
    select exists (
      select 1
      from public.group_members m
      where m.group_id = v_group_id and m.user_id <> v_user_id
    ) into v_has_other_members;
    if v_has_other_members then
      update public.groups
      set owner_id = null, archived = true, updated_at = pg_catalog.now()
      where id = v_group_id and owner_id = v_user_id;
      v_groups_archived := v_groups_archived + 1;
    else
      delete from public.groups where id = v_group_id and owner_id = v_user_id;
      v_groups_deleted := v_groups_deleted + 1;
    end if;
  end loop;

  delete from public.group_invites where created_by = v_user_id;
  get diagnostics v_invites = row_count;
  delete from public.group_topics where creator_id = v_user_id;
  get diagnostics v_topics = row_count;
  delete from public.group_points where user_id = v_user_id;
  get diagnostics v_points = row_count;
  delete from public.group_members where user_id = v_user_id;
  get diagnostics v_memberships = row_count;

  delete from public.debates where owner_id = v_user_id;
  get diagnostics v_debates = row_count;
  delete from public.challenges where creator_id = v_user_id;
  get diagnostics v_challenges = row_count;
  delete from public.user_preferences where user_id = v_user_id;
  get diagnostics v_preferences = row_count;
  delete from public.profiles where id = v_user_id;
  get diagnostics v_profiles = row_count;
  delete from public.user_rate_limits where user_id = v_user_id;
  get diagnostics v_rate_limits = row_count;

  return pg_catalog.jsonb_build_object(
    'anonymizedResponses', v_anonymized,
    'reports', v_reports,
    'debates', v_debates,
    'challenges', v_challenges,
    'profiles', v_profiles,
    'preferences', v_preferences,
    'rateLimits', v_rate_limits,
    'groupMemberships', v_memberships,
    'groupPoints', v_points,
    'groupInvites', v_invites,
    'groupTopics', v_topics,
    'teamSessions', v_team_sessions,
    'aiFeedback', v_ai_feedback,
    'betaFeedback', v_beta_feedback,
    'groupsArchived', v_groups_archived,
    'groupsDeleted', v_groups_deleted,
    'authAccount', 'anonymous identity retained until sign-out/session expiry'
  );
end;
$$;

-- Remove all browser table write paths and expose only the narrow RPC/read surfaces.
alter table public.team_debate_sessions enable row level security;
drop policy if exists "team_sessions_select_facilitator_or_member" on public.team_debate_sessions;
drop policy if exists "team_sessions_insert_facilitator" on public.team_debate_sessions;
drop policy if exists "team_sessions_update_facilitator" on public.team_debate_sessions;
create policy "team_sessions_select_facilitator_only"
  on public.team_debate_sessions for select
  using (auth.uid() = facilitator_id);

revoke all on table public.groups, public.group_members, public.group_invites, public.group_topics, public.group_points from anon, authenticated;
revoke insert, update, delete on table public.team_debate_sessions from anon, authenticated;
grant select on table public.team_debate_sessions to authenticated;
revoke insert, update, delete on table public.beta_feedback from anon, authenticated;
grant select on table public.beta_feedback to authenticated;
revoke execute on function public.enforce_user_rate_limit(text, integer, integer) from anon, authenticated;

revoke all on function public.group_role(uuid, uuid) from public, anon, authenticated;
revoke all on function public.group_summary_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_group(text, text, text, text, text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.list_my_groups() from public, anon, authenticated;
revoke all on function public.load_group(uuid) from public, anon, authenticated;
revoke all on function public.create_group_invite(uuid) from public, anon, authenticated;
revoke all on function public.join_group_by_invite(text) from public, anon, authenticated;
revoke all on function public.create_group_topic(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_group_participation(uuid, integer) from public, anon, authenticated;
revoke all on function public.save_team_debate_session(text, uuid, text, jsonb, jsonb, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.submit_beta_feedback(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_my_beta_data() from public, anon, authenticated;

grant execute on function public.create_group(text, text, text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.list_my_groups() to authenticated;
grant execute on function public.load_group(uuid) to authenticated;
grant execute on function public.create_group_invite(uuid) to authenticated;
grant execute on function public.join_group_by_invite(text) to authenticated;
grant execute on function public.create_group_topic(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.record_group_participation(uuid, integer) to authenticated;
grant execute on function public.save_team_debate_session(text, uuid, text, jsonb, jsonb, jsonb, timestamptz, timestamptz) to authenticated;
grant execute on function public.submit_beta_feedback(text, text, text, text, text, text) to authenticated;
grant execute on function public.delete_my_beta_data() to authenticated;
