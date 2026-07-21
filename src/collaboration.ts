import type { Language, Take } from './domain'

export type TeamRoundType = 'opening' | 'argument' | 'rebuttal' | 'question' | 'answer' | 'closing'
export type TeamFormat = 'rounds' | 'timer'
export type TeamScoring = 'none' | 'facilitator' | 'ai'
export type TeamSessionStatus = 'active' | 'paused' | 'completed' | 'ended'

export type TeamDefinition = {
  id: string
  name: string
  color: 'team-a' | 'team-b' | 'team-c' | 'team-d'
  icon: string
}

export type TeamTurn = {
  id: string
  teamId: string
  round: number
  roundType: TeamRoundType
  content: string
  submittedAt: string
  skipped?: boolean
}

export type TeamDebateResult = {
  scoring: TeamScoring
  facilitatorScores: Record<string, { clarity: number; relevance: number; rebuttal: number; teamwork: number; fairness: number }>
  commonGround: string
  completedAt: string
  aiReview?: TeamAiReview
}

export type TeamAiReview = {
  summary: string
  commonGround: string
  teams: Record<string, {
    clarity: number
    relevance: number
    rebuttal: number
    teamwork: number
    fairness: number
    strongestPoint: string
    unansweredQuestion: string
    evidence: string[]
  }>
}

export type TeamDebateSession = {
  id: string
  facilitatorId: string
  groupId: string | null
  language: Language
  topic: { statement: string; context: string; takeId: string | null; custom: boolean }
  teams: TeamDefinition[]
  format: TeamFormat
  rounds: number
  roundTypes: TeamRoundType[]
  teamTurnSeconds: number
  totalSeconds: number
  preparationSeconds: number
  closingRound: boolean
  scoring: TeamScoring
  status: TeamSessionStatus
  currentTurnIndex: number
  remainingSeconds: number
  turns: TeamTurn[]
  result: TeamDebateResult | null
  updatedAt: string
}

export type TeamSetupInput = {
  facilitatorId: string
  groupId?: string | null
  language: Language
  topic: { statement: string; context: string; takeId: string | null; custom: boolean }
  teams: TeamDefinition[]
  format: TeamFormat
  rounds: number
  roundTypes: TeamRoundType[]
  teamTurnSeconds: number
  totalSeconds: number
  preparationSeconds: number
  closingRound: boolean
  scoring: TeamScoring
}

export type GroupRole = 'owner' | 'moderator' | 'member'
export type GroupTopicStatus = 'approved' | 'pending' | 'archived'

export type GroupSummary = {
  id: string
  name: string
  description: string
  icon: string
  accent: string
  language: Language
  role: GroupRole
  memberCount: number
  leaderboardEnabled: boolean
  updatedAt: string
}

export type GroupMember = {
  userId: string
  profileKey?: string | null
  displayName: string
  role: GroupRole
  points: number
  debatesCompleted: number
  constructive: boolean
}

export type GroupTopic = {
  id: string
  groupId: string
  statement: string
  context: string
  sideLabels: [string, string]
  category: string
  language: Language
  sensitivity: 'standard' | 'sensitive'
  creatorId: string
  status: GroupTopicStatus
  createdAt: string
}

const INVITE_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function encodeInviteBase32(hex: string): string {
  const bytes = hex.match(/[0-9A-F]{2}/g)?.map(value => Number.parseInt(value, 16)) || []
  let buffer = 0
  let bits = 0
  let output = ''
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      output += INVITE_BASE32[(buffer >> bits) & 31]
    }
  }
  if (bits > 0) output += INVITE_BASE32[(buffer << (5 - bits)) & 31]
  return output
}

function decodeInviteBase32(value: string): string | null {
  let buffer = 0
  let bits = 0
  const bytes: number[] = []
  for (const character of value) {
    const digit = INVITE_BASE32.indexOf(character)
    if (digit < 0) return null
    buffer = (buffer << 5) | digit
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 255)
    }
  }
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function formatGroupInviteCode(rawCode: string): string {
  const raw = rawCode.trim().toUpperCase()
  const payload = raw.replace(/^SS-/, '').replaceAll('-', '')
  if (!/^[0-9A-F]+$/.test(payload) || payload.length % 2 !== 0) return raw
  const displayPayload = encodeInviteBase32(payload)
  return `SS-${displayPayload.match(/.{1,4}/g)?.join('-') || displayPayload}`
}

export function normalizeGroupInviteCode(input: string): string {
  const value = input.trim().toUpperCase().replace(/\s+/g, '')
  const payload = value.replace(/^SS-/, '').replaceAll('-', '')
  if (/^[0-9A-F]+$/.test(payload) && payload.length % 2 === 0) return `SS-${payload}`
  if (!/^SS-[A-Z2-7]+(?:-[A-Z2-7]+)+$/.test(value)) return value
  const decoded = decodeInviteBase32(payload)
  return decoded ? `SS-${decoded}` : value
}

export type GroupInvite = {
  id: string
  groupId: string
  code: string
  expiresAt: string | null
  maxUses: number | null
  uses: number
  revoked: boolean
}

export type GroupDetail = GroupSummary & {
  rules: string
  members: GroupMember[]
  topics: GroupTopic[]
  invites: GroupInvite[]
}

export type CreateGroupInput = {
  name: string
  description: string
  icon: string
  accent: string
  language: Language
  rules: string
  memberLimit: number | null
  leaderboardEnabled: boolean
}

export type CreateGroupTopicInput = {
  statement: string
  context: string
  sideLabels: [string, string]
  category: string
  language: Language
  sensitivity: 'standard' | 'sensitive'
}

export const teamRoundLabels: Record<TeamRoundType, string> = {
  opening: 'Opening statement',
  argument: 'Main argument',
  rebuttal: 'Rebuttal',
  question: 'Cross-question',
  answer: 'Cross-answer',
  closing: 'Closing statement',
}

export const teamColors: TeamDefinition['color'][] = ['team-a', 'team-b', 'team-c', 'team-d']
export const teamIcons = ['◒', '✦', '≈', '◇']

export function validateTopic(statement: string, context = ''): string | null {
  const trimmed = statement.trim()
  if (trimmed.length < 8) return 'Keep the topic to at least 8 characters.'
  if (trimmed.length > 240) return 'Keep the topic under 240 characters.'
  if (context.trim().length > 600) return 'Keep the context under 600 characters.'
  return null
}

export function validateTurn(content: string): string | null {
  const trimmed = content.trim()
  if (trimmed.length < 12) return 'Add at least 12 characters so the team has a clear point.'
  if (trimmed.length > 2000) return 'Keep each turn under 2,000 characters.'
  return null
}

export function createTeamSession(input: TeamSetupInput, now = new Date().toISOString(), id = `team-${crypto.randomUUID()}`): TeamDebateSession {
  const initialSeconds = input.format === 'timer' ? input.totalSeconds : input.teamTurnSeconds
  return {
    ...input,
    groupId: input.groupId || null,
    id,
    status: 'active',
    currentTurnIndex: 0,
    remainingSeconds: initialSeconds,
    turns: [],
    result: null,
    updatedAt: now,
  }
}

export function roundForTurn(session: Pick<TeamDebateSession, 'currentTurnIndex' | 'teams' | 'rounds'>): number {
  return Math.floor(session.currentTurnIndex / Math.max(session.teams.length, 1)) + 1
}

export function roundTypeForTurn(session: Pick<TeamDebateSession, 'currentTurnIndex' | 'roundTypes'>): TeamRoundType {
  return session.roundTypes[session.currentTurnIndex % Math.max(session.roundTypes.length, 1)] || 'argument'
}

export function isSessionComplete(session: Pick<TeamDebateSession, 'currentTurnIndex' | 'teams' | 'rounds'>): boolean {
  return session.currentTurnIndex >= session.teams.length * session.rounds
}

export function tickTeamSession(session: TeamDebateSession, seconds = 1, now = new Date().toISOString()): TeamDebateSession {
  if (session.status !== 'active' || session.remainingSeconds <= 0) return session
  const remainingSeconds = Math.max(0, session.remainingSeconds - Math.max(1, Math.round(seconds)))
  return { ...session, remainingSeconds, status: remainingSeconds === 0 ? 'paused' : 'active', updatedAt: now }
}

export function submitTeamTurn(session: TeamDebateSession, content: string, now = new Date().toISOString(), skip = false): { session: TeamDebateSession | null; error: string | null } {
  if (session.status !== 'active') return { session: null, error: 'The timer is paused. Resume before submitting a turn.' }
  if (!skip) {
    const error = validateTurn(content)
    if (error) return { session: null, error }
  }
  const team = session.teams[session.currentTurnIndex % session.teams.length]
  const round = roundForTurn(session)
  const nextIndex = session.currentTurnIndex + 1
  const finished = nextIndex >= session.teams.length * session.rounds
  const turn: TeamTurn = { id: `turn-${session.id}-${session.currentTurnIndex}`, teamId: team.id, round, roundType: roundTypeForTurn(session), content: skip ? '[Skipped by facilitator]' : content.trim(), submittedAt: now, skipped: skip || undefined }
  return { session: { ...session, currentTurnIndex: nextIndex, turns: [...session.turns, turn], status: finished ? 'completed' : 'active', remainingSeconds: finished ? 0 : session.format === 'timer' ? session.remainingSeconds : session.teamTurnSeconds, result: finished ? { scoring: session.scoring, facilitatorScores: {}, commonGround: '', completedAt: now } : null, updatedAt: now }, error: null }
}

export function calculateGroupPoints(input: { completedDebate: boolean; teamParticipation: boolean; fair: boolean; topicVariety: boolean }): number {
  return (input.completedDebate ? 10 : 0) + (input.teamParticipation ? 5 : 0) + (input.fair ? 3 : 0) + (input.topicVariety ? 2 : 0)
}

export function takeFromGroupTopic(topic: GroupTopic, fallback: Take): Take {
  return {
    ...fallback,
    id: `group-topic-${topic.id}`,
    statement: topic.statement,
    statementDe: topic.language === 'de' ? topic.statement : fallback.statementDe,
    context: topic.context || fallback.context,
    contextDe: topic.language === 'de' ? topic.context : fallback.contextDe,
    category: topic.category || fallback.category,
    categoryDe: topic.category || fallback.categoryDe,
    supportLabel: topic.sideLabels[0],
    opposeLabel: topic.sideLabels[1],
  }
}
