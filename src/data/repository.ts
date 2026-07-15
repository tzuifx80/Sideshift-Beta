import type { BackendName, RepositoryDiagnostics, UserPreferences, UserProfile, UserStatsSnapshot } from './types'
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

export type AppRepository = {
  backend: BackendName
  diagnostics(): RepositoryDiagnostics
  loadProfile(userId: string): Promise<UserProfile | null>
  saveProfile(profile: UserProfile): Promise<void>
  loadPreferences(userId: string): Promise<UserPreferences | null>
  savePreferences(preferences: UserPreferences): Promise<void>
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
  submitBetaFeedback(userId: string, payload: BetaFeedbackInput): Promise<void>
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
