import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error(`SUPABASE_INTEGRATION_BLOCKED: missing ${missing.join(', ')}`)
  process.exit(2)
}

const makeClient = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const fail = message => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }
const noRows = (data, label) => assert(!data || (Array.isArray(data) && data.length === 0), `${label} leaked rows`)
let rlsDenials = 0
const deniedRows = (data, label) => { noRows(data, label); rlsDenials += 1 }
const deniedError = (error, label) => { assert(Boolean(error), `${label} was accepted`); rlsDenials += 1 }

async function signIn(label) {
  const client = makeClient()
  const { data, error } = await client.auth.signInAnonymously()
  if (error || !data.user) fail(`${label} anonymous auth failed: ${error?.message || 'no user returned'}`)
  return { client, user: data.user }
}

const a = await signIn('user A')
const b = await signIn('user B')
assert(a.user.id !== b.user.id, 'anonymous contexts received the same identity')

const takeId = 'integration-test-take'
const debateId = randomUUID()
const profile = await a.client.rpc('update_my_profile', { p_display_name: 'Integration A', p_bio: null, p_avatar_preset: 'orbit', p_interface_language: 'en', p_challenge_show_name: false, p_share_real_stance: false, p_handle: null, p_profile_accent: 'coral', p_profile_visibility: 'private', p_avatar_visibility: 'private', p_visible_stats: { debates: true, sideSwitches: true, constructive: true, argumentDna: false } })
if (profile.error) fail(`profile persistence failed: ${profile.error.message}`)
const ownProfile = await a.client.from('profiles').select('id').eq('id', a.user.id).single()
if (ownProfile.error) fail(`profile read failed: ${ownProfile.error.message}`)
const preferences = await a.client.from('user_preferences').upsert({ user_id: a.user.id, topic_preferences: ['Technology'], debate_languages: ['en'], onboarding_completed: true }).select('user_id').single()
if (preferences.error) fail(`preference persistence failed: ${preferences.error.message}`)
const bProfile = await b.client.rpc('update_my_profile', { p_display_name: 'Integration B', p_bio: null, p_avatar_preset: 'orbit', p_interface_language: 'en', p_challenge_show_name: false, p_share_real_stance: false, p_handle: null, p_profile_accent: 'coral', p_profile_visibility: 'private', p_avatar_visibility: 'private', p_visible_stats: { debates: true, sideSwitches: true, constructive: true, argumentDna: false } })
if (bProfile.error) fail(`user B profile persistence failed: ${bProfile.error.message}`)
const bPreferences = await b.client.from('user_preferences').select('user_id').eq('user_id', a.user.id)
if (bPreferences.error) fail(`preference privacy query failed: ${bPreferences.error.message}`)
deniedRows(bPreferences.data, 'user B preferences')

const debate = await a.client.from('debates').insert({ id: debateId, owner_id: a.user.id, take_id: takeId, mode: 'sideswitch', assigned_side: 'Oppose the statement', opponent_type: 'mock', language: 'en', status: 'active', current_stage: 'opening', snapshot: { id: debateId, takeId, mode: 'sideswitch', step: 1, stance: 1, postStance: 1, confidence: 4, understanding: 'yes', responses: {}, opponentMessages: {}, assignedSide: 'Oppose the statement', language: 'en', status: 'active', updatedAt: new Date().toISOString() } }).select('id').single()
if (debate.error) fail(`debate persistence failed: ${debate.error.message}`)
const turn = await a.client.from('debate_turns').insert({ debate_id: debateId, author_type: 'user', round_type: 'opening', content: 'A sufficiently long integration argument.', sequence_number: 2 }).select('id').single()
if (turn.error) fail(`turn persistence failed: ${turn.error.message}`)
const stance = await a.client.from('stance_snapshots').insert({ debate_id: debateId, user_id: a.user.id, stage: 'before', stance_value: 1, confidence: 80 }).select('id').single()
if (stance.error) fail(`stance persistence failed: ${stance.error.message}`)
const bDebate = await b.client.from('debates').select('id').eq('id', debateId)
if (bDebate.error) fail(`debate privacy query failed: ${bDebate.error.message}`)
deniedRows(bDebate.data, 'user B debate')
const bTurns = await b.client.from('debate_turns').select('id').eq('debate_id', debateId)
if (bTurns.error) fail(`turn privacy query failed: ${bTurns.error.message}`)
deniedRows(bTurns.data, 'user B turns')
const bInsertTurn = await b.client.from('debate_turns').insert({ debate_id: debateId, author_type: 'user', round_type: 'opening', content: 'A forbidden cross-user turn.', sequence_number: 3 })
deniedError(bInsertTurn.error, 'user B inserted a turn into user A debate')
const bUpdateDebate = await b.client.from('debates').update({ current_stage: 'rebuttal' }).eq('id', debateId).select('id')
if (bUpdateDebate.error) fail(`debate update privacy query failed: ${bUpdateDebate.error.message}`)
deniedRows(bUpdateDebate.data, 'user B modified user A debate')
const bStance = await b.client.from('stance_snapshots').select('id').eq('debate_id', debateId)
if (bStance.error) fail(`stance privacy query failed: ${bStance.error.message}`)
deniedRows(bStance.data, 'user B stance')

const resultId = randomUUID()
const result = await a.client.from('debate_results').insert({ id: resultId, debate_id: debateId, owner_id: a.user.id, scores: [], argument_dna: { id: resultId, debateId, score: 50, movement: 0, understanding: 'yes', mode: 'sideswitch', take: { id: takeId, category: 'Integration', categoryDe: 'Integration', categoryClass: 'category-coral', statement: 'Integration take.', statementDe: 'Integration take.', context: 'Context.', contextDe: 'Context.', difficulty: 'Easy', time: '4 min', type: 'Test', color: 'coral', supportLabel: 'Support', opposeLabel: 'Oppose' }, assignedSide: 'Oppose', transcript: [], scores: [], coaching: 'Keep going.', completedAt: new Date().toISOString() }, coaching: 'Keep going.' }).select('id').single()
if (result.error) fail(`result persistence failed: ${result.error.message}`)
const bResult = await b.client.from('debate_results').select('id').eq('id', resultId)
if (bResult.error) fail(`result privacy query failed: ${bResult.error.message}`)
deniedRows(bResult.data, 'user B result')

const created = await a.client.rpc('create_challenge', { p_take_id: takeId, p_mode: 'classic', p_creator_side: 'Support', p_creator_argument: 'A secure challenge argument with a clear trade-off.' })
if (created.error || !created.data?.token) fail(`challenge creation failed: ${created.error?.message || 'no token returned'}`)
const token = created.data.token
const publicPreview = await b.client.rpc('resolve_challenge', { p_token: token })
if (publicPreview.error || publicPreview.data.response !== null) fail(`challenge preview exposed private response: ${publicPreview.error?.message || 'unexpected response'}`)
const selfResponse = await a.client.rpc('complete_challenge_response', { p_token: token, p_response_content: 'A creator self-response must be rejected.' })
assert(Boolean(selfResponse.error), 'creator responded to own challenge')
const completed = await b.client.rpc('complete_challenge_response', { p_token: token, p_response_content: 'A separate user response with a clear counterpoint.' })
if (completed.error) fail(`challenge completion failed: ${completed.error.message}`)
const duplicate = await b.client.rpc('complete_challenge_response', { p_token: token, p_response_content: 'A duplicate response must be rejected.' })
assert(Boolean(duplicate.error), 'duplicate challenge response was accepted')
const creatorResult = await a.client.rpc('resolve_challenge', { p_token: token })
if (creatorResult.error || !creatorResult.data?.result) fail(`creator could not retrieve challenge result: ${creatorResult.error?.message || 'no result'}`)
const responderResult = await b.client.rpc('resolve_challenge', { p_token: token })
if (responderResult.error || !responderResult.data?.result || responderResult.data.response !== completed.data.response) fail(`responder could not retrieve the allowed challenge result: ${responderResult.error?.message || 'no result'}`)

const expired = await a.client.rpc('create_challenge', { p_take_id: takeId, p_mode: 'classic', p_creator_side: 'Support', p_creator_argument: 'An expired challenge fixture with enough text.' })
if (expired.error || !expired.data?.id || !expired.data?.token) fail(`expired challenge setup failed: ${expired.error?.message || 'no challenge returned'}`)
const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const expireFixture = await serviceClient.from('challenges').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', expired.data.id).select('id').single()
if (expireFixture.error) fail(`expired challenge fixture update failed: ${expireFixture.error.message}`)
const expiredResponse = await b.client.rpc('complete_challenge_response', { p_token: expired.data.token, p_response_content: 'An expired challenge response must be rejected.' })
assert(Boolean(expiredResponse.error), 'expired challenge response was accepted')
const expiredState = await a.client.rpc('resolve_challenge', { p_token: expired.data.token })
if (expiredState.error || expiredState.data?.status !== 'expired') fail(`expired challenge did not resolve as expired: ${expiredState.error?.message || expiredState.data?.status || 'unknown status'}`)

const report = await a.client.rpc('submit_report', { p_debate_id: debateId, p_challenge_id: null, p_reported_content_type: 'debate', p_reason: 'other', p_details: 'Integration report.' })
if (report.error) fail(`report persistence failed: ${report.error.message}`)
const bReports = await b.client.from('reports').select('id').eq('reporter_id', a.user.id)
if (bReports.error) fail(`report privacy query failed: ${bReports.error.message}`)
deniedRows(bReports.data, 'user B reports')

const directFeedback = await a.client.from('beta_feedback').insert({ owner_id: a.user.id, category: 'suggestion', message: 'Direct feedback write must be rejected.', surface: 'settings', screen: 'settings', ai_model_id: null, app_version: 'integration-direct-write' })
deniedError(directFeedback.error, 'user A wrote beta feedback directly')
const feedbackRpc = await a.client.rpc('submit_beta_feedback', { p_category: 'suggestion', p_message: 'Integration feedback only.', p_surface: 'settings', p_screen: 'settings', p_ai_model_id: null, p_app_version: 'integration-test' })
if (feedbackRpc.error) fail('beta feedback RPC persistence failed: ' + feedbackRpc.error.message)
const feedback = await a.client.from('beta_feedback').select('id').eq('owner_id', a.user.id).eq('app_version', 'integration-test').single()
if (feedback.error) fail('beta feedback row lookup failed: ' + feedback.error.message)
const bFeedback = await b.client.from('beta_feedback').select('id').eq('owner_id', a.user.id)
if (bFeedback.error) fail(`beta feedback privacy query failed: ${bFeedback.error.message}`)
deniedRows(bFeedback.data, 'user B beta feedback')
const usageInsert = await a.client.from('basic_ai_daily_usage').insert({ user_id: a.user.id, usage_date: new Date().toISOString().slice(0, 10) })
deniedError(usageInsert.error, 'user A inserted Basic AI usage directly')
const usageUpdate = await a.client.from('basic_ai_daily_usage').update({ debates_started: 99 }).eq('user_id', a.user.id)
deniedError(usageUpdate.error, 'user A modified Basic AI usage directly')
const usageRpc = await a.client.rpc('get_basic_ai_usage', { p_user_id: a.user.id })
deniedError(usageRpc.error, 'authenticated client called server-only Basic AI usage RPC')

const bDelete = await b.client.rpc('delete_my_beta_data')
if (bDelete.error) fail(`user B data deletion failed: ${bDelete.error.message}`)
const aProfileAfterBDelete = await a.client.from('profiles').select('id').eq('id', a.user.id).maybeSingle()
if (aProfileAfterBDelete.error || !aProfileAfterBDelete.data) fail(`user B deletion affected user A profile: ${aProfileAfterBDelete.error?.message || 'profile missing'}`)
const resultAfterResponderDelete = await a.client.rpc('resolve_challenge', { p_token: token })
if (resultAfterResponderDelete.error || resultAfterResponderDelete.data?.response !== completed.data.response || !resultAfterResponderDelete.data?.result) fail(`user B deletion removed another user's challenge response: ${resultAfterResponderDelete.error?.message || 'result missing'}`)

const aDelete = await a.client.rpc('delete_my_beta_data')
if (aDelete.error) fail(`user A data deletion failed: ${aDelete.error.message}`)
const deletedProfile = await a.client.from('profiles').select('id').eq('id', a.user.id).maybeSingle()
if (deletedProfile.error || deletedProfile.data) fail(`user A profile remained after deletion: ${deletedProfile.error?.message || 'row still exists'}`)
const deletedDebate = await a.client.from('debates').select('id').eq('id', debateId)
if (deletedDebate.error) fail(`user A debate deletion check failed: ${deletedDebate.error.message}`)
noRows(deletedDebate.data, 'user A debate after deletion')
const deletedFeedback = await a.client.from('beta_feedback').select('id').eq('id', feedback.data.id)
if (deletedFeedback.error) fail(`user A beta feedback deletion check failed: ${deletedFeedback.error.message}`)
noRows(deletedFeedback.data, 'user A beta feedback after deletion')

console.log(`SUPABASE_INTEGRATION_OK auth=2 profiles=2 preferences=1 debates=1 turns=1 stances=1 results=1 challenges=2 reports=1 beta_feedback_rpc=1 direct_feedback_denied=1 rls_denials=${rlsDenials} challenge_checks=self_response,second_user,duplicate,expired,creator_result,responder_result deletion=owner_only,responder_anonymized,feedback_removed`)
