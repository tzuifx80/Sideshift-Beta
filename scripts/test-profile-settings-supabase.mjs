import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('PROFILE_SETTINGS_BLOCKED: missing SUPABASE_URL or SUPABASE_ANON_KEY')
  process.exit(2)
}

const fail = message => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }
const clients = []
async function user(label) {
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await client.auth.signInAnonymously()
  if (result.error || !result.data.user) fail(`${label} anonymous auth failed`)
  clients.push(client)
  return { client, id: result.data.user.id }
}

const a = await user('A')
const b = await user('B')
const c = await user('C')
const d = await user('D')
const suffix = randomUUID().replaceAll('-', '').slice(0, 8)
const profileArgs = (name, handle, visibility = 'public') => ({
  p_display_name: name, p_bio: 'Visible only to the approved audience.', p_avatar_preset: 'orbit', p_interface_language: 'en',
  p_challenge_show_name: false, p_share_real_stance: false, p_handle: handle, p_profile_accent: 'coral',
  p_profile_visibility: visibility, p_avatar_visibility: 'public',
  p_visible_stats: { debates: true, sideSwitches: true, constructive: false, argumentDna: false },
  p_field_visibility: { avatar: 'public', displayName: 'public', bio: 'friends', profileAccent: 'public', argumentDna: 'private', statistics: 'friends', socialLinks: 'friends', groupRelationship: 'shared_groups' },
  p_social_links: [{ provider: 'github', url: 'https://github.com/sideshift-test', label: 'GitHub', visibility: 'friends', order: 0 }],
})

for (const [target, label] of [[a, 'A'], [b, 'B'], [c, 'C'], [d, 'D']]) {
  const saved = await target.client.rpc('update_my_profile_v2', profileArgs(`Profile ${label}`, `profile_${label.toLowerCase()}_${suffix}`))
  if (saved.error) fail(`profile ${label} setup failed: ${saved.error.message}`)
}
const aPrivate = await a.client.rpc('get_my_private_profile')
if (aPrivate.error) fail('owner profile hydration failed')
const aKey = aPrivate.data.profileKey
const bPrivate = await b.client.rpc('get_my_private_profile')
if (bPrivate.error) fail('friend profile hydration failed')
const bKey = bPrivate.data.profileKey
const cPrivate = await c.client.rpc('get_my_private_profile')
if (cPrivate.error) fail('group profile hydration failed')
const cKey = cPrivate.data.profileKey
const dPrivate = await d.client.rpc('get_my_private_profile')
if (dPrivate.error) fail('outsider profile hydration failed')
const dKey = dPrivate.data.profileKey

const request = await a.client.rpc('send_friend_request', { p_target_profile_key: bKey })
if (request.error) fail('friend request setup failed')
const accepted = await b.client.rpc('send_friend_request', { p_target_profile_key: aKey })
if (accepted.error) fail('friend acceptance setup failed')

const group = await a.client.rpc('create_group', { p_name: `Profile test ${suffix}`, p_description: 'Private profile test.', p_rules: '', p_icon: '*', p_accent: 'coral', p_language: 'en', p_member_limit: 10, p_leaderboard_enabled: false })
if (group.error) fail('Group setup failed')
const invite = await a.client.rpc('create_group_invite', { p_group_id: group.data.id })
if (invite.error) fail('Group invite setup failed')
const joined = await c.client.rpc('join_group_by_invite', { p_code: invite.data.code })
if (joined.error) fail('shared Group setup failed')

const inspect = async (client, key) => client.rpc('get_profile_for_viewer', { p_profile_key: key })
const owner = await inspect(a.client, aKey)
const friend = await inspect(b.client, aKey)
const groupMember = await inspect(c.client, aKey)
const outsider = await inspect(d.client, aKey)
for (const result of [owner, friend, groupMember, outsider]) if (result.error) fail('profile viewer RPC failed')
assert(owner.data.state === 'available' && owner.data.isOwner, 'owner profile was not available')
assert(friend.data.profile?.bio && friend.data.socialLinks?.length === 1 && friend.data.statistics, 'friend-visible profile fields were missing')
assert(groupMember.data.profile?.bio === null && groupMember.data.socialLinks?.length === 0, 'shared-group viewer received friend-only fields')
assert(outsider.data.profile?.bio === null && outsider.data.socialLinks?.length === 0 && Object.keys(outsider.data.statistics || {}).length === 0, 'outsider received hidden profile fields')
assert(!JSON.stringify(outsider.data).includes('sideshift-test'), 'hidden social URL reached an unauthorized response')

const blocked = await a.client.rpc('block_user', { p_target_profile_key: dKey })
if (blocked.error) fail('blocking fixture failed')
const blockedView = await d.client.rpc('get_profile_for_viewer', { p_profile_key: aKey })
if (blockedView.error) fail('blocked profile RPC failed')
assert(blockedView.data.state === 'unavailable' && blockedView.data.profile === null, 'blocked profile was not neutral')

for (const client of clients) await client.rpc('delete_my_beta_data')
console.log('PROFILE_SETTINGS_SUPABASE_OK viewers=owner,friend,shared_group,outsider hidden_social_absent=true')
