import { clearState, loadState, saveState, type PersistedState } from '../storage'
import type { AiFeedbackInput, AppRepository, BetaFeedbackInput, ChallengeRecord, ChallengeResolved, FriendChallengeRecord, FriendshipRecord, GroupFriendInvitation, ProfilePreview, ReportInput } from './repository'
import type { BackendName, RepositoryDiagnostics, UserPreferences, UserProfile, UserStatsSnapshot } from './types'
import { makeUuid } from '../domain'
import type { CreateGroupInput, CreateGroupTopicInput, GroupDetail, GroupInvite, GroupRole, GroupSummary } from '../collaboration'
import type { LocalGroup } from '../storage'
import { defaultProfileFieldVisibility } from '../profile'

function cloneState(): PersistedState {
  return loadState()
}

function groupRole(group: LocalGroup, userId: string): GroupRole {
  return group.ownerId === userId ? 'owner' : group.members.find(member => member.userId === userId)?.role || 'member'
}

function groupSummary(group: LocalGroup, userId: string): GroupSummary {
  return { id: group.id, name: group.name, description: group.description, icon: group.icon, accent: group.accent, language: group.language, role: groupRole(group, userId), memberCount: group.members.length, leaderboardEnabled: group.leaderboardEnabled, updatedAt: group.updatedAt }
}

export function createLocalRepository(): AppRepository {
  const backend: BackendName = 'local'
  const diagnostics: RepositoryDiagnostics = { backend, ready: true, message: 'Using local browser persistence for development.' }
  return {
    backend,
    diagnostics: () => diagnostics,
    async loadProfile(userId) {
      const state = cloneState()
      if (state.userId !== userId) return null
      return { id: state.userId, displayName: state.name || null, bio: state.bio || null, avatarPreset: state.avatarPreset, interfaceLanguage: state.language, challengeShowName: state.challengeShowName, shareRealStance: state.shareRealStance, publicProfileKey: null, handle: null, friendCode: null, avatarPath: null, profileAccent: state.accent, profileVisibility: state.profileVisibility, avatarVisibility: state.profileFieldVisibility.avatar, fieldVisibility: state.profileFieldVisibility, visibleStats: { debates: true, sideSwitches: true, constructive: true, argumentDna: false }, socialLinks: state.socialLinks }
    },
    async saveProfile(profile) {
      const state = cloneState()
      saveState({ ...state, userId: profile.id, name: profile.displayName || '', bio: profile.bio || '', avatarPreset: profile.avatarPreset, language: profile.interfaceLanguage, challengeShowName: profile.challengeShowName, shareRealStance: profile.shareRealStance, profileVisibility: profile.profileVisibility, profileFieldVisibility: profile.fieldVisibility, socialLinks: profile.socialLinks })
    },
    async loadPreferences(userId) {
      const state = cloneState()
      if (state.userId !== userId) return null
      return { userId, topicPreferences: state.interests, debateLanguages: [state.debateLanguage], intensity: state.intensity, preferredMode: state.preferredMode, preferredAiStyle: state.preferredAiStyle, preferredOpponentType: state.preferredOpponentType, preferredAiFamily: state.preferredAiFamily, preferredOpponentId: state.preferredOpponentId, preferredAiModelId: state.preferredAiModelId, aiDifficulty: state.aiDifficulty, aiRoundLength: state.aiRoundLength, aiQuality: state.aiQuality, aiResponseLength: state.aiResponseLength, showModelDetails: state.showModelDetails, theme: state.theme, accent: state.accent, reducedMotion: state.reducedMotion, textSize: state.textSize, shareRealStance: state.shareRealStance, onboardingCompleted: state.onboarded, onboardingStage: state.onboarded ? 3 : 0, onboardingGoal: 'reasoning', onboardingDismissed: false }
    },
    async savePreferences(preferences) {
      const state = cloneState()
      saveState({ ...state, userId: preferences.userId, interests: preferences.topicPreferences, onboarded: preferences.onboardingCompleted, debateLanguage: preferences.debateLanguages[0] || state.debateLanguage, intensity: preferences.intensity || state.intensity, preferredMode: preferences.preferredMode, preferredAiStyle: preferences.preferredAiStyle || state.preferredAiStyle, preferredOpponentType: preferences.preferredOpponentType, preferredAiFamily: preferences.preferredAiFamily, preferredOpponentId: preferences.preferredOpponentId, preferredAiModelId: preferences.preferredAiModelId, aiDifficulty: preferences.aiDifficulty, aiRoundLength: preferences.aiRoundLength, aiQuality: preferences.aiQuality, aiResponseLength: preferences.aiResponseLength, showModelDetails: preferences.showModelDetails, theme: preferences.theme, accent: preferences.accent, reducedMotion: preferences.reducedMotion, textSize: preferences.textSize, shareRealStance: preferences.shareRealStance })
    },
    async getPrivateProfile() { throw new Error('Friends are available only with authenticated Supabase persistence.') },
    async getProfileForViewer() { return { state: 'unavailable', relationship: 'outsider', profile: null, socialLinks: [], statistics: {}, isOwner: false } },
    async lookupProfileByHandle() { throw new Error('Friends are available only with authenticated Supabase persistence.') },
    async lookupProfileByFriendCode() { throw new Error('Friends are available only with authenticated Supabase persistence.') },
    async regenerateFriendCode() { throw new Error('Friends are available only with authenticated Supabase persistence.') },
    async listFriendships(): Promise<FriendshipRecord[]> { return [] },
    async sendFriendRequest() { throw new Error('Friends are available only with authenticated Supabase persistence.') },
    async updateFriendRequest() { throw new Error('Friends are available only with authenticated Supabase persistence.') },
    async listBlocks(): Promise<ProfilePreview[]> { return [] },
    async blockUser() { throw new Error('Friends are available only with authenticated Supabase persistence.') },
    async unblockUser() { throw new Error('Friends are available only with authenticated Supabase persistence.') },
    async uploadAvatar() { throw new Error('Profile photos are available only with authenticated Supabase persistence.') },
    async removeAvatar() { throw new Error('Profile photos are available only with authenticated Supabase persistence.') },
    async getAvatarUrl() { return null },
    async createFriendChallenge() { throw new Error('Friend challenges are available only with authenticated Supabase persistence.') },
    async listFriendChallenges(): Promise<FriendChallengeRecord[]> { return [] },
    async completeFriendChallenge() { throw new Error('Friend challenges are available only with authenticated Supabase persistence.') },
    async listGroupFriendInvitations(): Promise<GroupFriendInvitation[]> { return [] },
    async createGroupFriendInvitation() { throw new Error('Friend invitations are available only with authenticated Supabase persistence.') },
    async respondGroupFriendInvitation() { throw new Error('Friend invitations are available only with authenticated Supabase persistence.') },
    async loadDebate(userId) {
      const state = cloneState()
      if (state.userId !== userId) return null
      return state.debate ? { ...state.debate, language: ['en', 'de', 'fr', 'es', 'it'].includes(state.debate.language) ? state.debate.language : 'en' } : null
    },
    async saveDebate(userId, debate) {
      const state = cloneState()
      saveState({ ...state, userId, debate })
    },
    async loadResult(userId) {
      const state = cloneState()
      return state.userId === userId ? state.result : null
    },
    async saveResult(userId, result) {
      const state = cloneState()
      saveState({ ...state, userId, result })
    },
    async loadHistory(userId) {
      const state = cloneState()
      return state.userId === userId ? state.history : []
    },
    async saveHistory(userId, history) {
      const state = cloneState()
      saveState({ ...state, userId, history })
    },
    async loadStats(userId): Promise<UserStatsSnapshot> {
      const state = cloneState()
      if (state.userId !== userId) return { challengeCreated: 0, challengeResponses: 0, activityDates: [] }
      const challenges = Object.values(state.challenges)
      return { challengeCreated: challenges.length, challengeResponses: challenges.filter(item => Boolean(item.response)).length, activityDates: challenges.flatMap(item => item.completedAt ? [item.completedAt] : []) }
    },
    async createChallenge(userId, payload) {
      const state = cloneState()
      const token = `local-${makeUuid()}`
      const record = {
        id: makeUuid(),
        token,
        creatorId: userId,
        takeId: payload.takeId,
        mode: payload.mode,
        creatorSide: payload.creatorSide,
        argument: payload.argument,
        expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
        status: 'open' as const,
        response: null,
        result: null,
        completedAt: null,
      }
      saveState({ ...state, challenges: { ...state.challenges, [token]: record } })
      return { id: record.id, token, url: `/challenge/${token}`, expiresAt: record.expiresAt, takeId: record.takeId, argument: record.argument, mode: record.mode, creatorSide: record.creatorSide, status: record.status, response: null, result: null }
    },
    async loadChallenge(token) {
      const state = cloneState()
      const record = state.challenges[token]
      if (!record) throw new Error('This challenge does not exist or has expired.')
      if (record.status === 'open' && Date.parse(record.expiresAt) < Date.now()) {
        record.status = 'expired'
        saveState(state)
      }
      const canRespond = record.status === 'open'
      return { id: record.id, token: record.token, url: `/challenge/${record.token}`, expiresAt: record.expiresAt, takeId: record.takeId, argument: record.argument, mode: record.mode, creatorSide: record.creatorSide, status: record.status, response: record.response, result: record.result, creator: null, canRespond } satisfies ChallengeResolved
    },
    async listChallenges(userId) {
      const state = cloneState()
      return Object.values(state.challenges).filter(record => record.creatorId === userId).map(record => ({ id: record.id, token: '', url: '', expiresAt: record.expiresAt, takeId: record.takeId, argument: record.argument, mode: record.mode, creatorSide: record.creatorSide, status: record.status, response: record.response, result: record.result }))
    },
    async revokeChallenge(userId, challengeId) {
      const state = cloneState()
      const record = Object.values(state.challenges).find(item => item.id === challengeId && item.creatorId === userId)
      if (!record) throw new Error('Challenge not found.')
      record.status = 'revoked'
      saveState(state)
    },
    async deleteMyBetaData(userId) {
      const state = cloneState()
      if (state.userId !== userId) throw new Error('The local beta data owner could not be verified.')
      clearState()
    },
    async respondToChallenge(token, response, _responderId) {
      const state = cloneState()
      const record = state.challenges[token]
      if (!record) throw new Error('This challenge does not exist or has expired.')
      if (record.status !== 'open') throw new Error('This challenge has already been answered or is unavailable.')
      if (Date.parse(record.expiresAt) < Date.now()) {
        record.status = 'expired'
        saveState(state)
        throw new Error('This challenge has expired.')
      }
      record.response = response
      record.status = 'completed'
      record.result = { total: Math.max(0, Math.min(100, 40 + Math.round(response.length / 4))) }
      record.completedAt = new Date().toISOString()
      saveState(state)
      return { id: record.id, token: record.token, url: `/challenge/${record.token}`, expiresAt: record.expiresAt, takeId: record.takeId, argument: record.argument, mode: record.mode, creatorSide: record.creatorSide, status: record.status, response: record.response, result: record.result, creator: null, canRespond: false } satisfies ChallengeResolved
    },
    async submitReport(userId, payload: ReportInput) {
      const state = cloneState()
      const duplicate = state.reports.find(item => item.debateId === (payload.debateId || null) && item.challengeId === (payload.challengeId || null) && item.reason === payload.reason)
      if (duplicate) return { id: duplicate.id, status: duplicate.status, createdAt: duplicate.createdAt }
      const report = { id: `report-${makeUuid()}`, status: 'open', createdAt: new Date().toISOString() }
      saveState({ ...state, userId, reports: [...state.reports, { ...report, debateId: payload.debateId || null, challengeId: payload.challengeId || null, reason: payload.reason }] })
      return report
    },
    async recordAiFeedback(userId, payload: AiFeedbackInput) {
      const state = cloneState()
      if (state.userId !== userId) throw new Error('The local beta data owner could not be verified.')
      const key = `${payload.debateId}:${payload.opponentId}:${payload.feedbackType}`
      if (!state.aiFeedback.includes(key)) saveState({ ...state, aiFeedback: [...state.aiFeedback, key] })
    },
    async submitBetaFeedback(userId, payload: BetaFeedbackInput) {
      const state = cloneState()
      if (state.userId !== userId) throw new Error('The local beta data owner could not be verified.')
      const duplicate = state.betaFeedback.find(item => item.surface === payload.surface && item.category === payload.category && Date.parse(item.createdAt) > Date.now() - 20_000)
      if (duplicate) return duplicate.id
      const entry = { id: `feedback-${makeUuid()}`, category: payload.category, message: payload.message || null, surface: payload.surface, screen: payload.screen, aiModelId: payload.aiModelId || null, appVersion: payload.appVersion, createdAt: new Date().toISOString() }
      saveState({ ...state, betaFeedback: [entry, ...state.betaFeedback].slice(0, 100) })
      return entry.id
    },
    async loadTeamSession(userId) {
      const state = cloneState()
      return state.userId === userId ? state.teamSession : null
    },
    async saveTeamSession(userId, session) {
      const state = cloneState()
      if (state.userId !== userId) throw new Error('The local beta data owner could not be verified.')
      saveState({ ...state, teamSession: session })
    },
    async listGroups(userId) {
      const state = cloneState()
      if (state.userId !== userId) return []
      return Object.values(state.groups).filter(group => group.members.some(member => member.userId === userId) || group.ownerId === userId).map(group => groupSummary(group, userId))
    },
    async createGroup(userId, input: CreateGroupInput) {
      const state = cloneState()
      if (state.userId !== userId) throw new Error('The local beta data owner could not be verified.')
      const now = new Date().toISOString()
      const id = `group-${makeUuid()}`
      const group: LocalGroup = { id, ownerId: userId, name: input.name.trim(), description: input.description.trim(), icon: input.icon, accent: input.accent, language: input.language, rules: input.rules.trim(), memberLimit: input.memberLimit, leaderboardEnabled: input.leaderboardEnabled, members: [{ userId, displayName: state.name || 'You', role: 'owner', points: 0, debatesCompleted: 0, constructive: false }], topics: [], invites: [], createdAt: now, updatedAt: now }
      saveState({ ...state, groups: { ...state.groups, [id]: group } })
      return groupSummary(group, userId)
    },
    async loadGroup(userId, groupId): Promise<GroupDetail> {
      const state = cloneState()
      const group = state.groups[groupId]
      if (!group || (!group.members.some(member => member.userId === userId) && group.ownerId !== userId)) throw new Error('This group is private or no longer available.')
      return { ...groupSummary(group, userId), rules: group.rules, members: group.members, topics: group.topics.filter(topic => topic.status !== 'pending' || groupRole(group, userId) !== 'member'), invites: groupRole(group, userId) === 'member' ? [] : group.invites }
    },
    async createGroupInvite(userId, groupId): Promise<GroupInvite> {
      const state = cloneState()
      const group = state.groups[groupId]
      const role = group ? groupRole(group, userId) : null
      if (!group || (role !== 'owner' && role !== 'moderator')) throw new Error('Only the owner or a moderator can invite members.')
      const invite: GroupInvite = { id: `invite-${makeUuid()}`, groupId, code: `SS-${makeUuid().replaceAll('-', '').slice(0, 18).toUpperCase()}`, expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(), maxUses: 20, uses: 0, revoked: false }
      group.invites = [...group.invites, invite]
      group.updatedAt = new Date().toISOString()
      saveState(state)
      return invite
    },
    async joinGroupByInvite(userId, code) {
      const state = cloneState()
      const group = Object.values(state.groups).find(item => item.invites.some(invite => invite.code === code.trim().toUpperCase()))
      if (!group) throw new Error('That invite is invalid or has expired.')
      const invite = group.invites.find(item => item.code === code.trim().toUpperCase())!
      if (invite.revoked || (invite.expiresAt && Date.parse(invite.expiresAt) < Date.now()) || (invite.maxUses !== null && invite.uses >= invite.maxUses)) throw new Error('That invite is invalid or has expired.')
      const existing = group.members.find(member => member.userId === userId)
      if (!existing) {
        if (group.memberLimit !== null && group.members.length >= group.memberLimit) throw new Error('This group has reached its member limit.')
        group.members.push({ userId, displayName: state.name || 'Member', role: 'member', points: 0, debatesCompleted: 0, constructive: false })
        invite.uses += 1
        group.updatedAt = new Date().toISOString()
        saveState(state)
      }
      return groupSummary(group, userId)
    },
    async createGroupTopic(userId, groupId, input: CreateGroupTopicInput) {
      const state = cloneState()
      const group = state.groups[groupId]
      if (!group || !group.members.some(member => member.userId === userId)) throw new Error('You are not a member of this group.')
      const role = groupRole(group, userId)
      if (role !== 'owner' && role !== 'moderator' && input.sensitivity === 'sensitive') throw new Error('Sensitive topics need owner or moderator approval.')
      const topic = { id: `topic-${makeUuid()}`, groupId, statement: input.statement.trim(), context: input.context.trim(), sideLabels: input.sideLabels, category: input.category.trim() || 'Group topic', language: input.language, sensitivity: input.sensitivity, creatorId: userId, status: role === 'member' ? 'pending' as const : 'approved' as const, createdAt: new Date().toISOString() }
      group.topics = [topic, ...group.topics]
      group.updatedAt = new Date().toISOString()
      saveState(state)
    },
    async recordGroupParticipation(userId, groupId, points) {
      const state = cloneState()
      const group = state.groups[groupId]
      const member = group?.members.find(item => item.userId === userId)
      if (!group || !member) throw new Error('You are not a member of this group.')
      member.points += Math.max(0, Math.min(100, Math.round(points)))
      member.debatesCompleted += 1
      member.constructive = true
      group.updatedAt = new Date().toISOString()
      saveState(state)
    },
  }
}
