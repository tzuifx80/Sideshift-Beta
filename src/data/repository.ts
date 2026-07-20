import type { BackendName, ProfileStats, RepositoryDiagnostics, SocialLink, UserPreferences, UserProfile, UserStatsSnapshot, VisibleProfileStats } from './types'
import type { DebateSnapshot, ResultData } from '../domain'
import type { CreateGroupInput, CreateGroupTopicInput, GroupDetail, GroupInvite, GroupSummary, TeamDebateSession } from '../collaboration'

export type ChallengeRecord = {
  id: string
  token: string
  url: string
  expiresAt: string
  takeId: string
  argument: string
  mode: string
  creatorSide: string
  status: 'open' | 'completed' | 'expired' | 'revoked'
  response: string | null
  result: { total: number } | null
  creator?: ProfilePreview | null
}

export type ChallengeResolved = ChallengeRecord & { canRespond: boolean }

export type ReportRecord = {
  id: string
  status: string
  createdAt: string
}

export type ReportInput = {
  debateId?: string | null
  challengeId?: string | null
  reportedContentType: string
  reason: string
  details?: string | null
}

export type AiFeedbackInput = {
  debateId: string
  opponentId: string
  modelId: string
  feedbackType: 'helpful' | 'not_helpful' | 'incorrect' | 'too_long' | 'missed_point'
}

export type BetaFeedbackCategory = 'broken' | 'ai_quality' | 'design_usability' | 'missing_topic' | 'suggestion' | 'other'

export type BetaFeedbackInput = {
  category: BetaFeedbackCategory
  message?: string | null
  surface: 'settings' | 'debate_result'
  screen: string
  aiModelId?: string | null
  appVersion: string
}

export type ProfilePreview = {
  profileKey: string
  handle: string | null
  displayName: string | null
  bio: string | null
  avatarPath: string | null
  avatarPreset: UserProfile['avatarPreset']
  profileAccent: UserProfile['profileAccent']
  visibleStats: Partial<VisibleProfileStats>
}

export type ProfileView = {
  state: 'available' | 'private' | 'unavailable'
  relationship: 'owner' | 'friend' | 'shared_group' | 'outsider'
  profile: ProfilePreview | null
  socialLinks: SocialLink[]
  statistics: Partial<ProfileStats>
  isOwner: boolean
}

export type FriendshipRecord = { id: string; status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'removed' | 'blocked'; direction: 'incoming' | 'outgoing'; profile: ProfilePreview | null }
export type FriendChallengeRecord = { id: string; takeId: string; mode: string; argument: string; creatorSide: string; status: 'open' | 'completed' | 'expired' | 'revoked'; expiresAt: string; response: string | null; result: { total: number } | null; direction: 'incoming' | 'outgoing'; creator: ProfilePreview | null; recipient: ProfilePreview | null }
export type GroupFriendInvitation = { id: string; groupId: string; groupName: string; status: 'pending' | 'expired'; expiresAt: string; inviter: ProfilePreview | null }

export type AppRepository = {
  backend: BackendName
  diagnostics(): RepositoryDiagnostics
  loadProfile(userId: string): Promise<UserProfile | null>
  saveProfile(profile: UserProfile): Promise<void>
  loadPreferences(userId: string): Promise<UserPreferences | null>
  savePreferences(preferences: UserPreferences): Promise<void>
  getPrivateProfile(userId: string): Promise<UserProfile | null>
  getProfileForViewer(userId: string, profileKey: string): Promise<ProfileView>
  lookupProfileByHandle(userId: string, handle: string): Promise<ProfilePreview | null>
  lookupProfileByFriendCode(userId: string, code: string): Promise<ProfilePreview | null>
  regenerateFriendCode(userId: string): Promise<string>
  listFriendships(userId: string): Promise<FriendshipRecord[]>
  sendFriendRequest(userId: string, profileKey: string): Promise<FriendshipRecord>
  updateFriendRequest(userId: string, relationshipId: string, action: 'accept' | 'decline' | 'cancel' | 'remove'): Promise<FriendshipRecord | null>
  listBlocks(userId: string): Promise<ProfilePreview[]>
  blockUser(userId: string, profileKey: string): Promise<void>
  unblockUser(userId: string, profileKey: string): Promise<void>
  uploadAvatar(userId: string, file: Blob, detectedMime: string): Promise<string>
  removeAvatar(userId: string): Promise<void>
  getAvatarUrl(userId: string, objectPath: string): Promise<string | null>
  createFriendChallenge(userId: string, payload: { profileKey: string; takeId: string; mode: string; creatorSide: string; argument: string }): Promise<FriendChallengeRecord>
  listFriendChallenges(userId: string): Promise<FriendChallengeRecord[]>
  completeFriendChallenge(userId: string, challengeId: string, response: string): Promise<FriendChallengeRecord>
  listGroupFriendInvitations(userId: string): Promise<GroupFriendInvitation[]>
  createGroupFriendInvitation(userId: string, groupId: string, profileKey: string): Promise<void>
  respondGroupFriendInvitation(userId: string, invitationId: string, action: 'accept' | 'decline'): Promise<void>
  loadDebate(userId: string): Promise<DebateSnapshot | null>
  saveDebate(userId: string, debate: DebateSnapshot | null): Promise<void>
  loadResult(userId: string): Promise<ResultData | null>
  saveResult(userId: string, result: ResultData | null): Promise<void>
  loadHistory(userId: string): Promise<ResultData[]>
  saveHistory(userId: string, history: ResultData[]): Promise<void>
  loadStats(userId: string): Promise<UserStatsSnapshot>
  createChallenge(userId: string, payload: { takeId: string; argument: string; mode: string; creatorSide: string }): Promise<ChallengeRecord>
  loadChallenge(token: string): Promise<ChallengeResolved>
  listChallenges(userId: string): Promise<ChallengeRecord[]>
  revokeChallenge(userId: string, challengeId: string): Promise<void>
  deleteMyBetaData(userId: string): Promise<void>
  respondToChallenge(token: string, response: string, responderId?: string): Promise<ChallengeResolved>
  submitReport(userId: string, payload: ReportInput): Promise<ReportRecord>
  recordAiFeedback(userId: string, payload: AiFeedbackInput): Promise<void>
  submitBetaFeedback(userId: string, payload: BetaFeedbackInput): Promise<string>
  loadTeamSession(userId: string): Promise<TeamDebateSession | null>
  saveTeamSession(userId: string, session: TeamDebateSession | null): Promise<void>
  listGroups(userId: string): Promise<GroupSummary[]>
  createGroup(userId: string, input: CreateGroupInput): Promise<GroupSummary>
  loadGroup(userId: string, groupId: string): Promise<GroupDetail>
  createGroupInvite(userId: string, groupId: string): Promise<GroupInvite>
  joinGroupByInvite(userId: string, code: string): Promise<GroupSummary>
  createGroupTopic(userId: string, groupId: string, input: CreateGroupTopicInput): Promise<void>
  recordGroupParticipation(userId: string, groupId: string, points: number): Promise<void>
}

export class RepositoryError extends Error {
  constructor(
    public readonly code: 'auth_required' | 'network' | 'validation' | 'conflict' | 'not_found' | 'forbidden' | 'backend',
    message: string,
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}
