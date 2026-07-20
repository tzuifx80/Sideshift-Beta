-- Add only the privacy-filtered identity payloads needed by existing profile links.
-- Applied migrations 0001-0023 remain unchanged.

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
          'profileKey', p.public_profile_key,
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

create or replace function public.resolve_challenge(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges%rowtype;
  r public.challenge_responses%rowtype;
  v_allowed boolean := false;
begin
  select * into c from public.challenges where token_hash = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if c.status = 'open' and c.expires_at < pg_catalog.now() then
    update public.challenges set status = 'expired' where id = c.id;
    c.status := 'expired';
  end if;
  select * into r from public.challenge_responses where challenge_id = c.id;
  v_allowed := auth.uid() = c.creator_id or (r.responder_id is not null and auth.uid() = r.responder_id);
  return pg_catalog.jsonb_build_object(
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
    'result', case when v_allowed then r.result_payload else null end,
    'creator', public.profile_preview_json((select p.public_profile_key from public.profiles p where p.id = c.creator_id), auth.uid())
  );
end;
$$;

create or replace function public.complete_challenge_response(p_token text, p_response_content text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges%rowtype;
  r public.challenge_responses%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if pg_catalog.char_length(pg_catalog.trim(p_response_content)) not between 12 and 350 then raise exception 'Challenge response length is invalid' using errcode = '22023'; end if;
  select * into c from public.challenges where token_hash = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if c.creator_id = auth.uid() then raise exception 'You cannot respond to your own challenge' using errcode = '42501'; end if;
  if c.status = 'open' and c.expires_at < pg_catalog.now() then update public.challenges set status = 'expired' where id = c.id; end if;
  if c.status <> 'open' then raise exception 'Challenge is not open' using errcode = '55000'; end if;
  if exists (select 1 from public.challenge_responses where challenge_id = c.id) then raise exception 'Challenge already answered' using errcode = '23505'; end if;
  v_result := pg_catalog.jsonb_build_object(
    'total', pg_catalog.least(100, pg_catalog.greatest(0, 40 + pg_catalog.round(pg_catalog.char_length(pg_catalog.trim(p_response_content)) / 4.0)::integer)),
    'createdAt', pg_catalog.now(),
    'mode', c.mode
  );
  insert into public.challenge_responses (challenge_id, responder_id, response_content, result_payload, completed_at)
  values (c.id, auth.uid(), pg_catalog.trim(p_response_content), v_result, pg_catalog.now())
  returning * into r;
  update public.challenges set completed_uses = completed_uses + 1, status = 'completed', completed_at = pg_catalog.now() where id = c.id;
  return pg_catalog.jsonb_build_object(
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
    'result', v_result,
    'creator', public.profile_preview_json((select p.public_profile_key from public.profiles p where p.id = c.creator_id), auth.uid())
  );
end;
$$;
