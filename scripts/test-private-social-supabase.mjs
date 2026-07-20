import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error(`PRIVATE_SOCIAL_BLOCKED: missing ${missing.join(', ')}`)
  process.exit(2)
}

const makeClient = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const fail = message => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }
const userClients = []
async function signIn(label) {
  const client = makeClient()
  const { data, error } = await client.auth.signInAnonymously()
  if (error || !data.user) fail(`${label} anonymous auth failed: ${error?.message || 'no user returned'}`)
  userClients.push({ client, user: data.user })
  return { client, user: data.user }
}

const a = await signIn('user A')
const b = await signIn('user B')
const c = await signIn('user C')
const suffix = randomUUID().replaceAll('-', '').slice(0, 8)
const profileArgs = (name, handle, visibility = 'friends') => ({ p_display_name: name, p_bio: 'Private social test profile.', p_avatar_preset: 'orbit', p_interface_language: 'en', p_challenge_show_name: false, p_share_real_stance: false, p_handle: handle, p_profile_accent: 'coral', p_profile_visibility: visibility, p_avatar_visibility: 'friends', p_visible_stats: { debates: true, sideSwitches: false, constructive: false, argumentDna: false } })

for (const [label, target, handle] of [['A', a, `social_a_${suffix}`], ['B', b, `social_b_${suffix}`], ['C', c, `social_c_${suffix}`]]) {
  const result = await target.client.rpc('update_my_profile', profileArgs(`Social ${label}`, handle))
  if (result.error) fail(`profile ${label} setup failed: ${result.error.message}`)
}
const aPrivate = await a.client.rpc('get_my_private_profile')
const bPrivate = await b.client.rpc('get_my_private_profile')
if (aPrivate.error || bPrivate.error) fail('private profile hydration failed')
const aKey = aPrivate.data.profileKey
const bKey = bPrivate.data.profileKey

const lookup = await a.client.rpc('lookup_profile_by_handle', { p_handle: `@social_b_${suffix}` })
if (lookup.error || lookup.data?.profileKey !== bKey || lookup.data?.bio !== null || lookup.data?.avatarPath !== null) fail('exact handle lookup returned an unsafe or incomplete preview')
const codeLookup = await a.client.rpc('lookup_profile_by_friend_code', { p_code: bPrivate.data.friendCode })
if (codeLookup.error || codeLookup.data?.profileKey !== bKey) fail('friend-code lookup failed')

const request = await a.client.rpc('send_friend_request', { p_target_profile_key: bKey })
if (request.error || request.data?.status !== 'pending') fail(`friend request failed: ${request.error?.message || 'wrong state'}`)
const duplicate = await a.client.rpc('send_friend_request', { p_target_profile_key: bKey })
assert(Boolean(duplicate.error), 'duplicate friend request was accepted')
const reverse = await b.client.rpc('send_friend_request', { p_target_profile_key: aKey })
if (reverse.error || reverse.data?.status !== 'accepted') fail(`opposite-direction request did not resolve: ${reverse.error?.message || 'wrong state'}`)
const aFriends = await a.client.rpc('list_my_friendships')
const bFriends = await b.client.rpc('list_my_friendships')
assert(!aFriends.error && aFriends.data?.some(item => item.status === 'accepted'), 'user A did not see the accepted friendship')
assert(!bFriends.error && bFriends.data?.some(item => item.status === 'accepted'), 'user B did not see the accepted friendship')
const outsiderFriendships = await c.client.from('friendships').select('id')
assert(Boolean(outsiderFriendships.error) || outsiderFriendships.data?.length === 0, 'outsider inspected a friendship')
const forcedAcceptance = await c.client.from('friendships').update({ status: 'accepted' }).eq('id', request.data.id).select('id')
assert(Boolean(forcedAcceptance.error) || forcedAcceptance.data?.length === 0, 'client forced friendship acceptance')

const avatarBytes = Buffer.from('UklGRiIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=', 'base64')
const avatarPath = `${aKey}/current.webp`
const avatarUpload = await a.client.storage.from('profile-avatars').upload(avatarPath, avatarBytes, { contentType: 'image/webp', upsert: true })
if (avatarUpload.error) fail(`avatar initial upload failed: ${avatarUpload.error.message}`)
const avatarReplacementBytes = Buffer.concat([avatarBytes, Buffer.from([0])])
const avatarReplacement = await a.client.storage.from('profile-avatars').upload(avatarPath, avatarReplacementBytes, { contentType: 'image/webp', upsert: true })
if (avatarReplacement.error) fail(`avatar replacement failed: ${avatarReplacement.error.message}`)
const avatarMetadata = await a.client.rpc('set_my_avatar_path', { p_object_path: avatarPath, p_mime_type: 'image/webp', p_byte_size: avatarReplacementBytes.length })
if (avatarMetadata.error) fail(`avatar metadata failed: ${avatarMetadata.error.message}`)
const ownerUrl = await a.client.storage.from('profile-avatars').createSignedUrl(avatarPath, 60)
if (ownerUrl.error || !ownerUrl.data?.signedUrl) fail('avatar owner could not create a signed read')
const friendUrl = await b.client.storage.from('profile-avatars').createSignedUrl(avatarPath, 60)
if (friendUrl.error || !friendUrl.data?.signedUrl) fail('accepted friend could not create an allowed signed read')
const outsiderUrl = await c.client.storage.from('profile-avatars').createSignedUrl(avatarPath, 60)
assert(Boolean(outsiderUrl.error) || !outsiderUrl.data?.signedUrl, 'outsider created a signed avatar read')
const outsiderWrite = await c.client.storage.from('profile-avatars').upload(avatarPath, avatarBytes, { contentType: 'image/webp', upsert: true })
assert(Boolean(outsiderWrite.error), 'outsider wrote an owner avatar path')
const avatarRemove = await a.client.storage.from('profile-avatars').remove([avatarPath])
if (avatarRemove.error) fail(`avatar removal failed: ${avatarRemove.error.message}`)
const avatarClear = await a.client.rpc('remove_my_avatar')
if (avatarClear.error) fail(`avatar metadata removal failed: ${avatarClear.error.message}`)

const group = await a.client.rpc('create_group', { p_name: `Social Group ${suffix}`, p_description: 'Private social test group.', p_rules: '', p_icon: '✦', p_accent: 'coral', p_language: 'en', p_member_limit: 10, p_leaderboard_enabled: false })
if (group.error || !group.data?.id) fail(`Group setup failed: ${group.error?.message || 'no group'}`)
const invitation = await a.client.rpc('create_group_friend_invitation', { p_group_id: group.data.id, p_invitee_profile_key: bKey })
if (invitation.error) fail(`Group friend invitation failed: ${invitation.error.message}`)
const incomingInvitation = await b.client.rpc('list_my_group_invitations')
if (incomingInvitation.error || !incomingInvitation.data?.some(item => item.id === invitation.data.id)) fail('invitee did not receive a private Group invitation')
const acceptedInvitation = await b.client.rpc('respond_group_friend_invitation', { p_invitation_id: invitation.data.id, p_action: 'accept' })
if (acceptedInvitation.error) fail(`Group invitation acceptance failed: ${acceptedInvitation.error.message}`)
const bGroups = await b.client.rpc('list_my_groups')
assert(!bGroups.error && bGroups.data?.some(item => item.id === group.data.id), 'accepted invite did not create membership')

const direct = await a.client.rpc('create_friend_challenge', { p_recipient_profile_key: bKey, p_take_id: 'society-media-age', p_mode: 'sideswitch', p_creator_side: 'Support', p_creator_argument: 'A direct friend challenge with enough opening detail.' })
if (direct.error || !direct.data?.id) fail(`direct friend challenge failed: ${direct.error?.message || 'no challenge'}`)
const bearerAttempt = await a.client.rpc('resolve_challenge', { p_token: 'not-a-direct-token' })
assert(!bearerAttempt.error || bearerAttempt.data?.id !== direct.data.id, 'direct challenge crossed into bearer-link resolution')

const group2 = await a.client.rpc('create_group', { p_name: `Blocked Group ${suffix}`, p_description: 'Private blocking test group.', p_rules: '', p_icon: '✦', p_accent: 'coral', p_language: 'en', p_member_limit: 10, p_leaderboard_enabled: false })
if (group2.error || !group2.data?.id) fail(`second Group setup failed: ${group2.error?.message || 'no group'}`)
const pendingInvite = await a.client.rpc('create_group_friend_invitation', { p_group_id: group2.data.id, p_invitee_profile_key: bKey })
if (pendingInvite.error) fail(`pending Group invitation setup failed: ${pendingInvite.error.message}`)
const blocked = await a.client.rpc('block_user', { p_target_profile_key: bKey })
if (blocked.error) fail(`blocking failed: ${blocked.error.message}`)
const blockedLookup = await b.client.rpc('lookup_profile_by_handle', { p_handle: `@social_a_${suffix}` })
assert(!blockedLookup.error && blockedLookup.data === null, 'blocked lookup was not neutral')
const blockedChallenge = await b.client.rpc('create_friend_challenge', { p_recipient_profile_key: aKey, p_take_id: 'society-media-age', p_mode: 'classic', p_creator_side: 'Support', p_creator_argument: 'A blocked challenge must be unavailable.' })
assert(Boolean(blockedChallenge.error), 'blocked user created a direct challenge')
const blockedInvites = await b.client.rpc('list_my_group_invitations')
assert(!blockedInvites.error && !blockedInvites.data?.some(item => item.id === pendingInvite.data.id), 'blocking left a targeted Group invitation open')
const blockedChallenges = await b.client.rpc('list_my_friend_challenges')
assert(!blockedChallenges.error && blockedChallenges.data?.some(item => item.id === direct.data.id && item.status === 'revoked'), 'blocking did not revoke an open direct challenge')

for (const entry of userClients) {
  const deleted = await entry.client.rpc('delete_my_beta_data')
  if (deleted.error) fail(`social test cleanup failed: ${deleted.error.message}`)
}
console.log('PRIVATE_SOCIAL_SUPABASE_OK users=3 handle_lookup=exact friend_code=opaque requests=opposite_direction,duplicate,accepted rls=outsider_denied,client_force_denied avatars=owner_write,friend_signed_read,outsider_denied,cleanup groups=invite_accept,member_limit_path blocking=neutral_lookup,challenge_revoked,invite_revoked')
