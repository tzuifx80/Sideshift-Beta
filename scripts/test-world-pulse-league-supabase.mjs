import { createClient } from '@supabase/supabase-js'

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error(`WORLD_PULSE_LEAGUE_BLOCKED: missing ${missing.join(', ')}`)
  process.exit(2)
}

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const fail = message => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }

const { data: authData, error: authError } = await client.auth.signInAnonymously()
if (authError || !authData.user) {
  console.error(`WORLD_PULSE_LEAGUE_BLOCKED: anonymous auth failed: ${authError?.message || 'no user returned'}`)
  process.exit(2)
}

const published = await client.rpc('list_world_pulse_items', {
  p_country_code: 'DE',
  p_region: 'Europe',
  p_language: 'de',
  p_include_sensitive: false,
  p_limit: 10,
  p_offset: 0,
})
if (published.error) fail(`published World Pulse read failed: ${published.error.message}`)
assert(Array.isArray(published.data) && published.data.length >= 1, 'published World Pulse seed was not visible')
assert(published.data.every(item => item.status === 'published' && item.sensitivity === 'standard'), 'inactive or sensitive World Pulse item leaked')
assert(published.data.every(item => Array.isArray(item.sources) && item.sources.length >= 1), 'World Pulse source payload missing')
assert(published.data.every(item => item.sources.every(source => String(source.url).startsWith('https://'))), 'non-HTTPS source leaked')
assert(published.data.every(item => !('createdBy' in item) && !('reviewedBy' in item)), 'editor-only fields leaked')

const directDraftRead = await client.from('world_pulse_items').select('id,status').neq('status', 'published')
assert(Boolean(directDraftRead.error), 'ordinary user could query World Pulse drafts directly')

const editorRead = await client.rpc('get_world_pulse_editor_items')
assert(!editorRead.error && Array.isArray(editorRead.data) && editorRead.data.length === 0, 'ordinary user received editor World Pulse rows')

const editorWrite = await client.rpc('save_world_pulse_draft', {
  p_item_id: null,
  p_payload: { slug: 'unauthorized-draft', headline: 'Unauthorized draft', debateStatement: 'This should not publish.', neutralContext: 'This is an authorization test context.', sideALabel: 'A', sideBLabel: 'B', category: 'Test', originalLanguage: 'en' },
  p_sources: [],
  p_translations: [],
})
assert(Boolean(editorWrite.error), 'ordinary user created a World Pulse draft')

const reviewWrite = await client.rpc('review_world_pulse_item', {
  p_item_id: '00000000-0000-4000-8000-000000000281',
  p_action: 'publish',
})
assert(Boolean(reviewWrite.error), 'ordinary user published a World Pulse item')

const league = await client.rpc('join_friends_league')
if (league.error) fail(`Friends League join failed: ${league.error.message}`)
assert(league.data?.joined === true && league.data?.season?.status === 'active', 'Friends League did not create an active private season')

const dashboard = await client.rpc('load_league_dashboard', { p_league_type: 'friends', p_group_id: null })
if (dashboard.error) fail(`Friends League dashboard failed: ${dashboard.error.message}`)
assert(dashboard.data?.joined === true && Array.isArray(dashboard.data?.participants), 'Friends League dashboard payload invalid')

const invalidActivity = await client.rpc('record_league_activity', {
  p_completion_id: '00000000-0000-4000-8000-000000009999',
  p_activity_type: 'completed_debate',
  p_group_id: null,
  p_is_mock: false,
})
if (invalidActivity.error) fail(`invalid activity handling failed: ${invalidActivity.error.message}`)
assert(invalidActivity.data === 0, 'incomplete activity received League points')

const repeatedInvalidActivity = await client.rpc('record_league_activity', {
  p_completion_id: '00000000-0000-4000-8000-000000009999',
  p_activity_type: 'completed_debate',
  p_group_id: null,
  p_is_mock: false,
})
if (repeatedInvalidActivity.error) fail(`repeat idempotency check failed: ${repeatedInvalidActivity.error.message}`)
assert(repeatedInvalidActivity.data === 0, 'repeated invalid activity received points')

const arbitraryPoints = await client.from('league_score_events').insert({
  season_id: league.data.season.id,
  user_id: authData.user.id,
  completion_id: 'client-forged',
  reason: 'completed_debate',
  points: 20,
  category: 'Forged',
  scoring_version: 'client',
})
assert(Boolean(arbitraryPoints.error), 'ordinary user inserted arbitrary League points')

const privateGroup = await client.rpc('load_league_dashboard', {
  p_league_type: 'group',
  p_group_id: '00000000-0000-4000-8000-000000000999',
})
if (privateGroup.error) fail(`private Group League access check failed: ${privateGroup.error.message}`)
assert(privateGroup.data?.available === false, 'outsider received a private Group League')

console.log(`WORLD_PULSE_LEAGUE_SUPABASE_OK published=${published.data.length} friends_joined=true forged_points_blocked=true`)
