import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error('SUPABASE_COLLABORATION_BLOCKED: missing ' + missing.join(', '))
  process.exit(2)
}

const makeClient = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const fail = message => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }
const hashCode = code => createHash('sha256').update(code).digest('hex')

async function signIn(label) {
  const client = makeClient()
  const { data, error } = await client.auth.signInAnonymously()
  if (error || !data.user) fail(label + ' anonymous auth failed: ' + (error?.message || 'no user returned'))
  return { client, user: data.user }
}

async function expectError(resultPromise, label) {
  const result = await resultPromise
  assert(Boolean(result.error), label)
  return result
}

const owner = await signIn('owner')
const moderator = await signIn('moderator')
const member = await signIn('member')
const outsider = await signIn('outsider')
const invitee = await signIn('invitee')
let groupId = null
try {
  const created = await owner.client.rpc('create_group', { p_name: 'RLS ' + randomUUID().slice(0, 8), p_description: 'Private fixture', p_rules: '', p_icon: '✦', p_accent: 'coral', p_language: 'en', p_member_limit: null, p_leaderboard_enabled: true })
  if (created.error || !created.data?.id) fail('group creation failed: ' + (created.error?.message || 'no id returned'))
  groupId = created.data.id

  const invite = await owner.client.rpc('create_group_invite', { p_group_id: groupId })
  if (invite.error || !invite.data?.code) fail('invite creation failed: ' + (invite.error?.message || 'no code returned'))
  const moderatorJoined = await moderator.client.rpc('join_group_by_invite', { p_code: invite.data.code })
  if (moderatorJoined.error || moderatorJoined.data?.id !== groupId) fail('moderator join failed: ' + (moderatorJoined.error?.message || 'wrong group'))
  const memberJoined = await member.client.rpc('join_group_by_invite', { p_code: invite.data.code })
  if (memberJoined.error || memberJoined.data?.id !== groupId) fail('member join failed: ' + (memberJoined.error?.message || 'wrong group'))

  const moderatorRole = await service.from('group_members').update({ membership_role: 'moderator' }).eq('group_id', groupId).eq('user_id', moderator.user.id)
  if (moderatorRole.error) fail('moderator fixture role update failed: ' + moderatorRole.error.message)

  const outsiderGroups = await outsider.client.rpc('list_my_groups')
  if (outsiderGroups.error) fail('outsider group list failed: ' + outsiderGroups.error.message)
  assert(outsiderGroups.data.length === 0, 'outsider received a private group in list_my_groups')
  const outsiderDetail = await outsider.client.rpc('load_group', { p_group_id: groupId })
  assert(Boolean(outsiderDetail.error), 'outsider opened private group detail')

  const topic = await owner.client.rpc('create_group_topic', { p_group_id: groupId, p_statement: 'A private classroom topic', p_context: '', p_support_label: 'Support', p_question_label: 'Question', p_category: 'School', p_language: 'en', p_sensitivity: 'standard' })
  if (topic.error) fail('owner topic creation failed: ' + topic.error.message)
  const memberDetail = await member.client.rpc('load_group', { p_group_id: groupId })
  if (memberDetail.error || !memberDetail.data?.topics?.length) fail('member could not read approved topic: ' + (memberDetail.error?.message || 'topic missing'))
  const outsiderTopic = await outsider.client.rpc('create_group_topic', { p_group_id: groupId, p_statement: 'Outsider topic should fail', p_context: '', p_support_label: 'Support', p_question_label: 'Question', p_category: 'School', p_language: 'en', p_sensitivity: 'standard' })
  assert(Boolean(outsiderTopic.error), 'outsider created a group topic')

  await expectError(member.client.from('group_members').update({ membership_role: 'owner' }).eq('group_id', groupId).eq('user_id', owner.user.id), 'member changed the owner role')
  await expectError(moderator.client.from('group_members').update({ membership_role: 'member' }).eq('group_id', groupId).eq('user_id', owner.user.id), 'moderator demoted the owner')
  await expectError(moderator.client.from('group_members').delete().eq('group_id', groupId).eq('user_id', owner.user.id), 'moderator removed the owner')
  await expectError(member.client.from('group_points').upsert({ group_id: groupId, user_id: member.user.id, points: 999, debates_completed: 99 }), 'member awarded or altered group points directly')

  const completedAt = new Date().toISOString()
  const completedSession = { id: 'rls-' + randomUUID(), facilitatorId: owner.user.id, groupId, language: 'en', topic: { statement: 'A private classroom topic', context: '', takeId: null, custom: true }, teams: [{ id: 'team-1', name: 'A', color: 'team-a', icon: 'A' }, { id: 'team-2', name: 'B', color: 'team-b', icon: 'B' }], format: 'rounds', rounds: 1, roundTypes: ['opening'], teamTurnSeconds: 60, totalSeconds: 60, preparationSeconds: 0, closingRound: false, scoring: 'none', status: 'completed', currentTurnIndex: 2, remainingSeconds: 0, turns: [], result: { scoring: 'none', facilitatorScores: {}, commonGround: '', completedAt }, updatedAt: completedAt }
  await expectError(owner.client.from('team_debate_sessions').insert({ id: completedSession.id, facilitator_id: owner.user.id, group_id: groupId, status: 'completed', topic: completedSession.topic, teams: completedSession.teams, snapshot: completedSession, completed_at: completedAt, updated_at: completedAt }), 'direct Team Debate table write bypassed the RPC boundary')
  const savedSession = await owner.client.rpc('save_team_debate_session', { p_id: completedSession.id, p_group_id: groupId, p_status: 'completed', p_topic: completedSession.topic, p_teams: completedSession.teams, p_snapshot: completedSession, p_completed_at: completedAt, p_updated_at: completedAt })
  if (savedSession.error) fail('Team Debate RPC fixture failed: ' + savedSession.error.message)

  const afterSave = await owner.client.rpc('load_group', { p_group_id: groupId })
  if (afterSave.error) fail('group reload after completed Team Debate failed: ' + afterSave.error.message)
  const pointsAfterCompletion = afterSave.data.members.find(item => item.userId === owner.user.id)
  assert(pointsAfterCompletion?.points === 20 && pointsAfterCompletion?.debatesCompleted === 1, 'completed Team Debate did not atomically award 20 points')

  const repeatedSave = await owner.client.rpc('save_team_debate_session', { p_id: completedSession.id, p_group_id: groupId, p_status: 'completed', p_topic: completedSession.topic, p_teams: completedSession.teams, p_snapshot: completedSession, p_completed_at: completedAt, p_updated_at: completedAt })
  if (repeatedSave.error) fail('repeated completed Team Debate save failed: ' + repeatedSave.error.message)

  const ownerSession = await owner.client.from('team_debate_sessions').select('id').eq('id', completedSession.id)
  if (ownerSession.error || ownerSession.data.length !== 1) fail('facilitator could not read own Team Debate session')
  for (const [label, client] of [['moderator', moderator.client], ['member', member.client], ['outsider', outsider.client]]) {
    const sessionRead = await client.from('team_debate_sessions').select('id').eq('id', completedSession.id)
    if (sessionRead.error) fail(label + ' Team Debate read failed: ' + sessionRead.error.message)
    assert(sessionRead.data.length === 0, label + ' read a facilitator-only Team Debate transcript')
  }

  const participation = await owner.client.rpc('record_group_participation', { p_group_id: groupId, p_points: 999 })
  if (participation.error) fail('group participation RPC failed: ' + participation.error.message)
  const repeatedParticipation = await owner.client.rpc('record_group_participation', { p_group_id: groupId, p_points: 1 })
  if (repeatedParticipation.error) fail('repeated group participation call failed: ' + repeatedParticipation.error.message)
  const afterPoints = await owner.client.rpc('load_group', { p_group_id: groupId })
  if (afterPoints.error) fail('group reload failed: ' + afterPoints.error.message)
  const ownerPoints = afterPoints.data.members.find(item => item.userId === owner.user.id)
  assert(ownerPoints?.points === 20 && ownerPoints?.debatesCompleted === 1, 'points were not fixed and idempotent at 20')

  const revokedInvite = await owner.client.rpc('create_group_invite', { p_group_id: groupId })
  if (revokedInvite.error) fail('revoked invite fixture creation failed: ' + revokedInvite.error.message)
  const revokedUpdate = await service.from('group_invites').update({ revoked: true }).eq('group_id', groupId).eq('code_hash', hashCode(revokedInvite.data.code))
  if (revokedUpdate.error) fail('revoked invite fixture update failed: ' + revokedUpdate.error.message)
  await expectError(invitee.client.rpc('join_group_by_invite', { p_code: revokedInvite.data.code }), 'revoked invite was reusable')

  const expiredInvite = await owner.client.rpc('create_group_invite', { p_group_id: groupId })
  if (expiredInvite.error) fail('expired invite fixture creation failed: ' + expiredInvite.error.message)
  const expiredUpdate = await service.from('group_invites').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('group_id', groupId).eq('code_hash', hashCode(expiredInvite.data.code))
  if (expiredUpdate.error) fail('expired invite fixture update failed: ' + expiredUpdate.error.message)
  await expectError(invitee.client.rpc('join_group_by_invite', { p_code: expiredInvite.data.code }), 'expired invite was reusable')

  const exhaustedInvite = await owner.client.rpc('create_group_invite', { p_group_id: groupId })
  if (exhaustedInvite.error) fail('exhausted invite fixture creation failed: ' + exhaustedInvite.error.message)
  const exhaustedUpdate = await service.from('group_invites').update({ max_uses: 1, uses: 1 }).eq('group_id', groupId).eq('code_hash', hashCode(exhaustedInvite.data.code))
  if (exhaustedUpdate.error) fail('exhausted invite fixture update failed: ' + exhaustedUpdate.error.message)
  await expectError(invitee.client.rpc('join_group_by_invite', { p_code: exhaustedInvite.data.code }), 'exhausted invite was reusable')

  const memberDeletion = await member.client.rpc('delete_my_beta_data')
  if (memberDeletion.error) fail('ordinary member deletion failed: ' + memberDeletion.error.message)
  assert(memberDeletion.data?.groupMemberships >= 1, 'ordinary member deletion did not report membership removal')
  const afterMemberDeletion = await owner.client.rpc('load_group', { p_group_id: groupId })
  if (afterMemberDeletion.error) fail('group owner could not reload after member deletion: ' + afterMemberDeletion.error.message)
  assert(afterMemberDeletion.data.members.every(item => item.userId !== member.user.id), 'ordinary member remained in group data')
  const memberPoints = await service.from('group_points').select('user_id').eq('group_id', groupId).eq('user_id', member.user.id)
  if (memberPoints.error) fail('member points cleanup query failed: ' + memberPoints.error.message)
  assert(memberPoints.data.length === 0, 'ordinary member points remained after deletion')

  const ownerDeletion = await owner.client.rpc('delete_my_beta_data')
  if (ownerDeletion.error) fail('owner deletion failed: ' + ownerDeletion.error.message)
  assert(ownerDeletion.data?.groupsArchived === 1, 'owner deletion did not archive a group with another member')
  assert(ownerDeletion.data?.teamSessions === 1, 'owner deletion did not delete the facilitator Team Debate session')
  const archivedGroup = await service.from('groups').select('id, owner_id, archived').eq('id', groupId).single()
  if (archivedGroup.error) fail('archived group query failed: ' + archivedGroup.error.message)
  assert(archivedGroup.data.owner_id === null && archivedGroup.data.archived === true, 'owned group was not deterministically archived')
  const remainingModerator = await service.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', moderator.user.id)
  if (remainingModerator.error) fail('remaining member query failed: ' + remainingModerator.error.message)
  assert(remainingModerator.data.length === 1, 'another user lost collaboration membership during owner deletion')
  const ownerMembership = await service.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', owner.user.id)
  if (ownerMembership.error) fail('owner membership cleanup query failed: ' + ownerMembership.error.message)
  assert(ownerMembership.data.length === 0, 'deleted owner membership remained')
  const ownerTeamRows = await service.from('team_debate_sessions').select('id').eq('id', completedSession.id)
  if (ownerTeamRows.error) fail('Team Debate cleanup query failed: ' + ownerTeamRows.error.message)
  assert(ownerTeamRows.data.length === 0, 'deleted owner Team Debate session remained')
  const ownerTopics = await service.from('group_topics').select('id').eq('group_id', groupId).eq('creator_id', owner.user.id)
  if (ownerTopics.error) fail('owner topic cleanup query failed: ' + ownerTopics.error.message)
  assert(ownerTopics.data.length === 0, 'deleted owner topic remained')
  console.log('SUPABASE_COLLABORATION_OK users=5 outsider_denied=group,topic,team member_role_denied=2 points_denied=1 team_write_denied=1 invite_lifecycle_denied=3 participation_idempotent=20 member_delete=1 owner_group_archived=1 owner_team_deleted=1')
} catch (error) {
  if (/relation .* does not exist|function .* does not exist|schema cache/i.test(error?.message || '')) {
    console.error('SUPABASE_COLLABORATION_BLOCKED: apply migration 0011_team_debate_and_groups.sql and 0012_collaboration_security_and_deletion.sql before running this suite')
    process.exitCode = 2
  } else {
    console.error('SUPABASE_COLLABORATION_FAILED: ' + (error?.message || error))
    process.exitCode = 1
  }
} finally {
  if (groupId) await service.from('groups').delete().eq('id', groupId)
  for (const user of [owner, moderator, member, outsider, invitee]) await service.auth.admin.deleteUser(user.user.id).catch(() => undefined)
}
