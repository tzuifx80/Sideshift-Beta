-- Repair the already-applied challenge RPCs without rewriting migration 0001.
-- Supabase installs pgcrypto in the extensions schema on hosted projects.

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
declare
  v_id uuid;
  v_token text;
  v_expires timestamptz := pg_catalog.now() + interval '7 days';
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode not in ('classic', 'sideswitch', 'blindside', 'commonground') then raise exception 'Invalid challenge mode' using errcode = '22023'; end if;
  if pg_catalog.char_length(pg_catalog.trim(p_creator_argument)) not between 12 and 350 then raise exception 'Challenge argument length is invalid' using errcode = '22023'; end if;
  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.challenges (creator_id, take_id, mode, creator_side, creator_argument, token_hash, status, expires_at)
  values (auth.uid(), p_take_id, p_mode, p_creator_side, pg_catalog.trim(p_creator_argument), pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex'), 'open', v_expires)
  returning id into v_id;
  return pg_catalog.jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'url', '/challenge/' || v_token,
    'expiresAt', v_expires,
    'takeId', p_take_id,
    'argument', pg_catalog.trim(p_creator_argument),
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
    'result', case when v_allowed then r.result_payload else null end
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
    'result', v_result
  );
end;
$$;

create or replace function public.list_my_challenges()
returns setof jsonb
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', c.id,
    'token', '',
    'url', '',
    'expiresAt', c.expires_at,
    'takeId', c.take_id,
    'argument', c.creator_argument,
    'mode', c.mode,
    'creatorSide', c.creator_side,
    'status', case when c.status = 'open' and c.expires_at < pg_catalog.now() then 'expired' else c.status end,
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
set search_path = ''
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
