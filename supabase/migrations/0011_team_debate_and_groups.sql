-- Shared-device Team Debate sessions and private invite-only Groups.
-- All group mutations that affect membership, roles, invites or points go through
-- security-definer RPCs; no public discovery or direct messaging is introduced.

create table if not exists public.team_debate_sessions (
  id text primary key,
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid null,
  status text not null check (status in ('active', 'paused', 'completed', 'ended')),
  topic jsonb not null check (jsonb_typeof(topic) = 'object'),
  teams jsonb not null check (jsonb_typeof(teams) = 'array'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  points_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 240),
  icon text not null default '✦' check (char_length(icon) between 1 and 8),
  accent text not null default 'coral' check (char_length(accent) between 1 and 32),
  language text not null default 'en' check (language in ('en', 'de')),
  rules text not null default '' check (char_length(rules) <= 600),
  member_limit integer null check (member_limit is null or member_limit between 2 and 500),
  leaderboard_enabled boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_debate_sessions
  drop constraint if exists team_debate_sessions_group_id_fkey;
alter table public.team_debate_sessions
  add constraint team_debate_sessions_group_id_fkey foreign key (group_id) references public.groups(id) on delete set null;

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null default 'member' check (membership_role in ('owner', 'moderator', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz null,
  max_uses integer null check (max_uses is null or max_uses between 1 and 1000),
  uses integer not null default 0 check (uses >= 0),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.group_topics (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  statement text not null check (char_length(statement) between 8 and 240),
  context text not null default '' check (char_length(context) <= 600),
  support_label text not null check (char_length(support_label) between 1 and 28),
  question_label text not null check (char_length(question_label) between 1 and 28),
  category text not null check (char_length(category) between 1 and 60),
  language text not null check (language in ('en', 'de')),
  sensitivity text not null default 'standard' check (sensitivity in ('standard', 'sensitive')),
  creator_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('approved', 'pending', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_points (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  debates_completed integer not null default 0 check (debates_completed >= 0),
  constructive boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id, group_id);
create index if not exists group_topics_group_status_idx on public.group_topics (group_id, status, created_at desc);
create index if not exists team_debate_facilitator_idx on public.team_debate_sessions (facilitator_id, updated_at desc);

create or replace function public.group_role(p_group_id uuid, p_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when g.owner_id = p_user_id then 'owner' else coalesce(m.membership_role, '') end
  from public.groups g
  left join public.group_members m on m.group_id = g.id and m.user_id = p_user_id
  where g.id = p_group_id and (g.owner_id = p_user_id or m.user_id is not null)
$$;

create or replace function public.group_summary_json(p_group_id uuid, p_user_id uuid default auth.uid())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'description', g.description, 'icon', g.icon, 'accent', g.accent,
    'language', g.language, 'role', public.group_role(g.id, p_user_id),
    'memberCount', (select count(*) from public.group_members m where m.group_id = g.id),
    'leaderboardEnabled', g.leaderboard_enabled, 'updatedAt', g.updated_at
  )
  from public.groups g
  where g.id = p_group_id and public.group_role(g.id, p_user_id) <> '' and g.archived = false
$$;

create or replace function public.create_group(
  p_name text, p_description text, p_rules text, p_icon text, p_accent text,
  p_language text, p_member_limit integer, p_leaderboard_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_group_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.groups(owner_id, name, description, rules, icon, accent, language, member_limit, leaderboard_enabled)
  values (auth.uid(), btrim(p_name), btrim(coalesce(p_description, '')), btrim(coalesce(p_rules, '')), left(p_icon, 8), left(p_accent, 32), p_language, p_member_limit, p_leaderboard_enabled)
  returning id into v_group_id;
  insert into public.group_members(group_id, user_id, membership_role) values (v_group_id, auth.uid(), 'owner');
  insert into public.group_points(group_id, user_id) values (v_group_id, auth.uid());
  return public.group_summary_json(v_group_id);
end;
$$;

create or replace function public.list_my_groups()
returns setof jsonb
language sql
security definer
set search_path = public
as $$
  select public.group_summary_json(g.id)
  from public.groups g
  where public.group_role(g.id) <> '' and g.archived = false
  order by g.updated_at desc;
$$;

create or replace function public.load_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_summary jsonb; v_role text;
begin
  v_summary := public.group_summary_json(p_group_id);
  if v_summary is null then raise exception 'Group not found or access denied' using errcode = '42501'; end if;
  v_role := public.group_role(p_group_id);
  return jsonb_build_object(
    'summary', v_summary,
    'rules', (select g.rules from public.groups g where g.id = p_group_id),
    'members', coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'displayName', coalesce(p.display_name, 'Member'), 'role', m.membership_role, 'points', coalesce(gp.points, 0), 'debatesCompleted', coalesce(gp.debates_completed, 0), 'constructive', coalesce(gp.constructive, false)) order by coalesce(gp.points, 0) desc, m.joined_at asc) from public.group_members m left join public.profiles p on p.id = m.user_id left join public.group_points gp on gp.group_id = m.group_id and gp.user_id = m.user_id where m.group_id = p_group_id), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'groupId', t.group_id, 'statement', t.statement, 'context', t.context, 'sideLabels', jsonb_build_array(t.support_label, t.question_label), 'category', t.category, 'language', t.language, 'sensitivity', t.sensitivity, 'creatorId', t.creator_id, 'status', t.status, 'createdAt', t.created_at) order by t.created_at desc) from public.group_topics t where t.group_id = p_group_id and (t.status <> 'pending' or v_role in ('owner', 'moderator'))), '[]'::jsonb),
    'invites', case when v_role in ('owner', 'moderator') then coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'groupId', i.group_id, 'code', '', 'expiresAt', i.expires_at, 'maxUses', i.max_uses, 'uses', i.uses, 'revoked', i.revoked) order by i.created_at desc) from public.group_invites i where i.group_id = p_group_id), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.create_group_invite(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_code text := 'SS-' || upper(encode(gen_random_bytes(18), 'hex')); v_id uuid; v_expires timestamptz := now() + interval '7 days';
begin
  if public.group_role(p_group_id) not in ('owner', 'moderator') then raise exception 'Only the owner or a moderator can invite members' using errcode = '42501'; end if;
  insert into public.group_invites(group_id, created_by, code_hash, expires_at, max_uses) values (p_group_id, auth.uid(), encode(digest(v_code, 'sha256'), 'hex'), v_expires, 20) returning id into v_id;
  return jsonb_build_object('id', v_id, 'groupId', p_group_id, 'code', v_code, 'expiresAt', v_expires, 'maxUses', 20, 'uses', 0, 'revoked', false);
end;
$$;

create or replace function public.join_group_by_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_invite public.group_invites%rowtype; v_group public.groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_invite from public.group_invites where code_hash = encode(digest(upper(btrim(p_code)), 'sha256'), 'hex') for update;
  if not found or v_invite.revoked or (v_invite.expires_at is not null and v_invite.expires_at < now()) or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses) then raise exception 'Invite is invalid or expired' using errcode = 'P0002'; end if;
  select * into v_group from public.groups where id = v_invite.group_id and not archived;
  if not found then raise exception 'Group is unavailable' using errcode = 'P0002'; end if;
  if exists (select 1 from public.group_members where group_id = v_group.id and user_id = auth.uid()) then return public.group_summary_json(v_group.id); end if;
  if v_group.member_limit is not null and (select count(*) from public.group_members where group_id = v_group.id) >= v_group.member_limit then raise exception 'Group member limit reached' using errcode = '22023'; end if;
  insert into public.group_members(group_id, user_id, membership_role) values (v_group.id, auth.uid(), 'member');
  insert into public.group_points(group_id, user_id) values (v_group.id, auth.uid()) on conflict do nothing;
  update public.group_invites set uses = uses + 1 where id = v_invite.id;
  return public.group_summary_json(v_group.id);
end;
$$;

create or replace function public.create_group_topic(p_group_id uuid, p_statement text, p_context text, p_support_label text, p_question_label text, p_category text, p_language text, p_sensitivity text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_role text := public.group_role(p_group_id); v_status text := case when v_role in ('owner', 'moderator') then 'approved' else 'pending' end; v_id uuid;
begin
  if v_role = '' then raise exception 'Group membership required' using errcode = '42501'; end if;
  if p_sensitivity = 'sensitive' and v_role not in ('owner', 'moderator') then v_status := 'pending'; end if;
  insert into public.group_topics(group_id, statement, context, support_label, question_label, category, language, sensitivity, creator_id, status) values (p_group_id, btrim(p_statement), btrim(coalesce(p_context, '')), btrim(p_support_label), btrim(p_question_label), btrim(p_category), p_language, p_sensitivity, auth.uid(), v_status) returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;

create or replace function public.record_group_participation(p_group_id uuid, p_points integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_session_id text;
begin
  if public.group_role(p_group_id) = '' then raise exception 'Group membership required' using errcode = '42501'; end if;
  if not exists (select 1 from public.groups where id = p_group_id and leaderboard_enabled) then return; end if;
  select id into v_session_id from public.team_debate_sessions where facilitator_id = auth.uid() and group_id = p_group_id and status = 'completed' and not points_awarded order by completed_at desc nulls last limit 1 for update;
  if v_session_id is null then return; end if;
  update public.team_debate_sessions set points_awarded = true where id = v_session_id;
  insert into public.group_points(group_id, user_id, points, debates_completed, constructive) values (p_group_id, auth.uid(), least(100, greatest(0, coalesce(p_points, 20))), 1, true)
  on conflict (group_id, user_id) do update set points = public.group_points.points + excluded.points, debates_completed = public.group_points.debates_completed + 1, constructive = true, updated_at = now();
end;
$$;

alter table public.team_debate_sessions enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_topics enable row level security;
alter table public.group_points enable row level security;

create policy "team_sessions_select_facilitator_or_member" on public.team_debate_sessions for select using (auth.uid() = facilitator_id or public.group_role(group_id) <> '');
create policy "team_sessions_insert_facilitator" on public.team_debate_sessions for insert with check (auth.uid() = facilitator_id);
create policy "team_sessions_update_facilitator" on public.team_debate_sessions for update using (auth.uid() = facilitator_id) with check (auth.uid() = facilitator_id);
create policy "groups_select_members" on public.groups for select using (public.group_role(id) <> '');
create policy "group_members_select_members" on public.group_members for select using (user_id = auth.uid() or public.group_role(group_id) <> '');
create policy "group_invites_select_managers" on public.group_invites for select using (public.group_role(group_id) in ('owner', 'moderator'));
create policy "group_topics_select_members" on public.group_topics for select using (public.group_role(group_id) <> '' and (status <> 'pending' or public.group_role(group_id) in ('owner', 'moderator')));
create policy "group_points_select_members" on public.group_points for select using (public.group_role(group_id) <> '');

revoke all on table public.groups, public.group_members, public.group_invites, public.group_topics, public.group_points from anon, authenticated;
grant select on public.groups, public.group_members, public.group_invites, public.group_topics, public.group_points to authenticated;
grant select, insert, update on public.team_debate_sessions to authenticated;
revoke all on function public.group_role(uuid, uuid) from public;
revoke all on function public.group_summary_json(uuid, uuid) from public;
revoke all on function public.create_group(text, text, text, text, text, text, integer, boolean) from public;
revoke all on function public.list_my_groups() from public;
revoke all on function public.load_group(uuid) from public;
revoke all on function public.create_group_invite(uuid) from public;
revoke all on function public.join_group_by_invite(text) from public;
revoke all on function public.create_group_topic(uuid, text, text, text, text, text, text, text) from public;
revoke all on function public.record_group_participation(uuid, integer) from public;
grant execute on function public.create_group(text, text, text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.list_my_groups() to authenticated;
grant execute on function public.load_group(uuid) to authenticated;
grant execute on function public.create_group_invite(uuid) to authenticated;
grant execute on function public.join_group_by_invite(text) to authenticated;
grant execute on function public.create_group_topic(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.record_group_participation(uuid, integer) to authenticated;
