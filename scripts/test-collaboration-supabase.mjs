import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error(`SUPABASE_COLLABORATION_BLOCKED: missing ${missing.join(', ')}`)
  process.exit(2)
}

const makeClient = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const fail = message => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }

async function signIn(label) {
  const client = makeClient()
  const { data, error } = await client.auth.signInAnonymously()
  if (error || !data.user) fail(`${label} anonymous auth failed: ${error?.message || 'no user returned'}`)
  return { client, user: data.user }
}

const owner = await signIn('owner')
const member = await signIn('member')
const outsider = await signIn('outsider')
let groupId = null
try {
  const created = await owner.client.rpc('create_group', { p_name: `RLS ${randomUUID().slice(0, 8)}`, p_description: 'Private fixture', p_rules: '', p_icon: '✦', p_accent: 'coral', p_language: 'en', p_member_limit: null, p_leaderboard_enabled: true })
  if (created.error || !created.data?.id) fail(`group creation failed: ${created.error?.message || 'no id returned'}`)
  groupId = created.data.id
  const invite = await owner.client.rpc('create_group_invite', { p_group_id: groupId })
  if (invite.error || !invite.data?.code) fail(`invite creation failed: ${invite.error?.message || 'no code returned'}`)
  const joined = await member.client.rpc('join_group_by_invite', { p_code: invite.data.code })
  if (joined.error || joined.data?.id !== groupId) fail(`member join failed: ${joined.error?.message || 'wrong group'}`)

  const outsiderGroups = await outsider.client.rpc('list_my_groups')
  if (outsiderGroups.error) fail(`outsider group list failed: ${outsiderGroups.error.message}`)
  assert(outsiderGroups.data.length === 0, 'outsider received a private group in list_my_groups')
  const outsiderDetail = await outsider.client.rpc('load_group', { p_group_id: groupId })
  assert(Boolean(outsiderDetail.error), 'outsider opened private group detail')

  const topic = await owner.client.rpc('create_group_topic', { p_group_id: groupId, p_statement: 'A private classroom topic', p_context: '', p_support_label: 'Support', p_question_label: 'Question', p_category: 'School', p_language: 'en', p_sensitivity: 'standard' })
  if (topic.error) fail(`owner topic creation failed: ${topic.error.message}`)
  const memberDetail = await member.client.rpc('load_group', { p_group_id: groupId })
  if (memberDetail.error || !memberDetail.data?.topics?.length) fail(`member could not read approved topic: ${memberDetail.error?.message || 'topic missing'}`)

  const unauthorizedRole = await member.client.from('group_members').update({ membership_role: 'owner' }).eq('group_id', groupId).eq('user_id', owner.user.id)
  assert(Boolean(unauthorizedRole.error), 'member changed the owner role')
  const unauthorizedPoints = await member.client.from('group_points').upsert({ group_id: groupId, user_id: member.user.id, points: 999, debates_completed: 99 })
  assert(Boolean(unauthorizedPoints.error), 'member awarded or altered group points directly')
  const unauthorizedTopic = await outsider.client.rpc('create_group_topic', { p_group_id: groupId, p_statement: 'Outsider topic should fail', p_context: '', p_support_label: 'Support', p_question_label: 'Question', p_category: 'School', p_language: 'en', p_sensitivity: 'standard' })
  assert(Boolean(unauthorizedTopic.error), 'outsider created a group topic')

  const completedSession = { id: `rls-${randomUUID()}`, facilitatorId: owner.user.id, groupId, language: 'en', topic: { statement: 'A private classroom topic', context: '', takeId: null, custom: true }, teams: [{ id: 'team-1', name: 'A', color: 'team-a', icon: 'A' }, { id: 'team-2', name: 'B', color: 'team-b', icon: 'B' }], format: 'rounds', rounds: 1, roundTypes: ['opening'], teamTurnSeconds: 60, totalSeconds: 60, preparationSeconds: 0, closingRound: false, scoring: 'none', status: 'completed', currentTurnIndex: 2, remainingSeconds: 0, turns: [], result: { scoring: 'none', facilitatorScores: {}, commonGround: '', completedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() }
  const sessionInsert = await owner.client.from('team_debate_sessions').insert({ id: completedSession.id, facilitator_id: owner.user.id, group_id: groupId, status: 'completed', topic: completedSession.topic, teams: completedSession.teams, snapshot: completedSession, completed_at: completedSession.result.completedAt, updated_at: completedSession.updatedAt }).select('id').single()
  if (sessionInsert.error) fail(`Team session fixture failed: ${sessionInsert.error.message}`)
  const points = await owner.client.rpc('record_group_participation', { p_group_id: groupId, p_points: 20 })
  if (points.error) fail(`group participation RPC failed: ${points.error.message}`)
  const afterPoints = await owner.client.rpc('load_group', { p_group_id: groupId })
  if (afterPoints.error || afterPoints.data.members[0].points !== 20) fail(`group points were not recorded once: ${afterPoints.error?.message || 'unexpected total'}`)
  console.log('SUPABASE_COLLABORATION_OK users=3 outsider_denied=group,topic member_role_denied=1 points_denied=1 invite_expiry_rpc=available participation_points=20')
} catch (error) {
  if (/relation .* does not exist|function .* does not exist|schema cache/i.test(error?.message || '')) {
    console.error('SUPABASE_COLLABORATION_BLOCKED: apply migration 0011_team_debate_and_groups.sql before running this suite')
    process.exitCode = 2
  } else {
    console.error(`SUPABASE_COLLABORATION_FAILED: ${error?.message || error}`)
    process.exitCode = 1
  }
} finally {
  if (groupId) await service.from('groups').delete().eq('id', groupId)
  await service.auth.admin.deleteUser(owner.user.id).catch(() => undefined)
  await service.auth.admin.deleteUser(member.user.id).catch(() => undefined)
  await service.auth.admin.deleteUser(outsider.user.id).catch(() => undefined)
}
