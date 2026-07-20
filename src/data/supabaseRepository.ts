import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getTake, type DebateSnapshot, type Language, type ResultData, type Stance } from '../domain'
import { defaultProfileFieldVisibility, normalizePreferences } from '../profile'
import { challengeRecordSchema, debateSnapshotSchema, resultDataSchema, teamDebateSessionSchema } from './schemas'
import type { AiFeedbackInput, AppRepository, BetaFeedbackInput, ChallengeRecord, ChallengeResolved, FriendChallengeRecord, FriendshipRecord, GroupFriendInvitation, ProfilePreview, ProfileView, ReportInput, ReportRecord, RepositoryError } from './repository'
import { RepositoryError as RepositoryErrorClass } from './repository'
import type { BackendName, RepositoryDiagnostics, UserPreferences, UserProfile, UserStatsSnapshot, VisibleProfileStats } from './types'
import type { CreateGroupInput, CreateGroupTopicInput, GroupDetail, GroupInvite, GroupMember, GroupRole, GroupSummary, GroupTopic, TeamDebateSession } from '../collaboration'

type TableRow = Record<string, unknown>
type SupabaseFailure = { code?: string; message?: string; details?: string }

const languageSchema = z.enum(['en', 'de', 'fr', 'es', 'it'])
const preferenceArrayValueSchema = z.union([z.array(z.unknown()), z.string(), z.null()]).optional()
const preferencesRowSchema = z.object({
  user_id: z.string().uuid(),
  topic_preferences: preferenceArrayValueSchema,
  debate_languages: preferenceArrayValueSchema,
  intensity: z.string().nullable().optional(),
  preferred_mode: z.enum(['classic', 'sideswitch', 'blindside', 'commonground']).nullable().optional(),
  preferred_ai_style: z.string().nullable().optional(),
  preferred_opponent_type: z.enum(['ask', 'ai', 'person']).nullable().optional(),
  preferred_ai_family: z.enum(['Gemini', 'Claude', 'GPT', 'DeepSeek']).nullable().optional(),
  preferred_opponent_id: z.string().nullable().optional(),
  preferred_ai_model_id: z.string().nullable().optional(),
  ai_difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).nullable().optional(),
  ai_round_length: z.enum(['quick', 'standard', 'deep']).nullable().optional(),
  ai_quality: z.enum(['fast', 'balanced', 'maximum']).nullable().optional(),
  ai_response_length: z.enum(['concise', 'standard', 'detailed']).nullable().optional(),
  show_model_details: z.boolean().nullable().optional(),
  theme: z.enum(['system', 'light', 'dark']).nullable().optional(),
  accent: z.enum(['violet', 'cyan', 'amber', 'coral', 'mint', 'neutral']).nullable().optional(),
  reduced_motion: z.boolean().nullable().optional(),
  text_size: z.enum(['compact', 'comfortable']).nullable().optional(),
  share_real_stance: z.boolean().nullable().optional(),
  onboarding_completed: z.boolean().nullable().optional(),
  onboarding_stage: z.number().int().nullable().optional(),
  onboarding_goal: z.enum(['reasoning', 'school', 'friends', 'perspectives', 'fun']).nullable().optional(),
  onboarding_dismissed: z.boolean().nullable().optional(),
}).passthrough()
const visibilitySchema = z.enum(['private', 'friends', 'shared_groups', 'public'])
const fieldVisibilitySchema = z.object({ avatar: visibilitySchema, displayName: visibilitySchema, bio: visibilitySchema, profileAccent: visibilitySchema, argumentDna: visibilitySchema, statistics: visibilitySchema, socialLinks: visibilitySchema, groupRelationship: visibilitySchema }).partial()
const socialLinkSchema = z.object({ provider: z.enum(['instagram', 'tiktok', 'youtube', 'twitch', 'github', 'spotify', 'x', 'website']), url: z.string().url(), label: z.string().max(40).nullable(), visibility: visibilitySchema, order: z.number().int().min(0).max(4) })
const profilePreviewSchema = z.object({ profileKey: z.string().uuid(), handle: z.string().nullable(), displayName: z.string().nullable(), bio: z.string().nullable(), avatarPath: z.string().nullable(), avatarPreset: z.enum(['orbit', 'spark', 'wave', 'sun', 'leaf']), profileAccent: z.enum(['violet', 'cyan', 'amber', 'coral', 'mint', 'neutral']), visibleStats: z.record(z.string(), z.boolean()) })
const privateProfileSchema = z.object({ profileKey: z.string().uuid(), handle: z.string().nullable(), friendCode: z.string().nullable(), displayName: z.string().nullable(), bio: z.string().nullable(), avatarPreset: z.enum(['orbit', 'spark', 'wave', 'sun', 'leaf']), avatarPath: z.string().nullable(), profileAccent: z.enum(['violet', 'cyan', 'amber', 'coral', 'mint', 'neutral']), profileVisibility: visibilitySchema, avatarVisibility: visibilitySchema, fieldVisibility: fieldVisibilitySchema, visibleStats: z.record(z.string(), z.boolean()), socialLinks: z.array(socialLinkSchema), interfaceLanguage: languageSchema, challengeShowName: z.boolean(), shareRealStance: z.boolean() })
const profileViewSchema = z.object({ state: z.enum(['available', 'private', 'unavailable']), relationship: z.enum(['owner', 'friend', 'shared_group', 'outsider']), profile: profilePreviewSchema.nullable(), socialLinks: z.array(socialLinkSchema), statistics: z.record(z.string(), z.number()), isOwner: z.boolean() })
const friendshipSchema = z.object({ id: z.string().uuid(), status: z.enum(['pending', 'accepted', 'declined', 'cancelled', 'removed', 'blocked']), direction: z.enum(['incoming', 'outgoing']), profile: profilePreviewSchema.nullable() })
const friendChallengeSchema = z.object({ id: z.string().uuid(), takeId: z.string(), mode: z.string(), argument: z.string(), creatorSide: z.string(), status: z.enum(['open', 'completed', 'expired', 'revoked']), expiresAt: z.string(), response: z.string().nullable(), result: z.object({ total: z.number() }).nullable(), direction: z.enum(['incoming', 'outgoing']), creator: profilePreviewSchema.nullable(), recipient: profilePreviewSchema.nullable() })
const groupFriendInvitationSchema = z.object({ id: z.string().uuid(), groupId: z.string().uuid(), groupName: z.string(), status: z.enum(['pending', 'expired']), expiresAt: z.string(), inviter: profilePreviewSchema.nullable() })
const reportRowSchema = z.object({ id: z.string(), status: z.string(), created_at: z.string() })

function asRow(value: unknown): TableRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as TableRow : {}
}

const preferenceFieldAliases: Record<string, string> = {
  user_id: 'userId',
  topic_preferences: 'topicPreferences',
  debate_languages: 'debateLanguages',
  intensity: 'intensity',
  preferred_mode: 'preferredMode',
  preferred_ai_style: 'preferredAiStyle',
  preferred_opponent_type: 'preferredOpponentType',
  preferred_ai_family: 'preferredAiFamily',
  preferred_opponent_id: 'preferredOpponentId',
  preferred_ai_model_id: 'preferredAiModelId',
  ai_difficulty: 'aiDifficulty',
  ai_round_length: 'aiRoundLength',
  ai_quality: 'aiQuality',
  ai_response_length: 'aiResponseLength',
  show_model_details: 'showModelDetails',
  theme: 'theme',
  accent: 'accent',
  reduced_motion: 'reducedMotion',
  text_size: 'textSize',
  share_real_stance: 'shareRealStance',
  onboarding_completed: 'onboardingCompleted',
  onboarding_stage: 'onboardingStage',
  onboarding_goal: 'onboardingGoal',
  onboarding_dismissed: 'onboardingDismissed',
}

function valueType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

export function getPreferenceStructureDiagnostics(value: unknown, issuePaths: ReadonlyArray<ReadonlyArray<PropertyKey>> = []) {
  const row = asRow(value)
  const fieldTypes: Record<string, string> = {}
  const missingFields: string[] = []
  const nullFields: string[] = []
  for (const [snake, camel] of Object.entries(preferenceFieldAliases)) {
    const field = Object.prototype.hasOwnProperty.call(row, snake) ? snake : Object.prototype.hasOwnProperty.call(row, camel) ? camel : null
    if (!field) { missingFields.push(snake); continue }
    fieldTypes[snake] = valueType(row[field])
    if (row[field] === null) nullFields.push(snake)
  }
  return { fieldTypes, missingFields, nullFields, issuePaths: issuePaths.map(path => path.map(String)) }
}

function canonicalizePreferenceRow(value: unknown): TableRow {
  const row = asRow(value)
  const canonical: TableRow = {}
  for (const [snake, camel] of Object.entries(preferenceFieldAliases)) {
    if (Object.prototype.hasOwnProperty.call(row, snake)) canonical[snake] = row[snake]
    else if (Object.prototype.hasOwnProperty.call(row, camel)) canonical[snake] = row[camel]
  }
  return canonical
}

class PreferenceShapeError extends Error {
  constructor(readonly field: string) {
    super(`Invalid preference field: ${field}`)
  }
}

function decodeStringArray(value: unknown, field: string): string[] {
  if (value === null || value === undefined) return []
  let decoded = value
  if (typeof value === 'string') {
    try { decoded = JSON.parse(value) } catch { throw new PreferenceShapeError(field) }
  }
  if (!Array.isArray(decoded) || decoded.some(item => typeof item !== 'string')) throw new PreferenceShapeError(field)
  return decoded as string[]
}

function rejectPreferenceData(value: unknown, issuePaths: ReadonlyArray<ReadonlyArray<PropertyKey>> = []): never {
  // Deliberately log structure only: no values, identifiers, interests, or private content.
  console.warn('[Supabase preferences] rejected', getPreferenceStructureDiagnostics(value, issuePaths))
  throw new RepositoryErrorClass('validation', 'Your private preferences could not be loaded.')
}

export function parseSupabasePreferences(value: unknown, userId: string): UserPreferences {
  const canonical = canonicalizePreferenceRow(value)
  const parsed = preferencesRowSchema.safeParse(canonical)
  if (!parsed.success) return rejectPreferenceData(value, parsed.error.issues.map(issue => issue.path))
  if (parsed.data.user_id !== userId) return rejectPreferenceData(value, [['user_id']])
  try {
    const row = parsed.data
    const debateLanguages = decodeStringArray(row.debate_languages, 'debate_languages').filter((item): item is Language => item === 'en' || item === 'de' || item === 'fr' || item === 'es' || item === 'it')
    return normalizePreferences({
      userId,
      topicPreferences: decodeStringArray(row.topic_preferences, 'topic_preferences'),
      debateLanguages: debateLanguages.length ? debateLanguages : ['en'],
      intensity: row.intensity ?? undefined,
      preferredMode: row.preferred_mode ?? undefined,
      preferredAiStyle: row.preferred_ai_style ?? undefined,
      preferredOpponentType: row.preferred_opponent_type ?? undefined,
      preferredAiFamily: row.preferred_ai_family ?? undefined,
      preferredOpponentId: row.preferred_opponent_id ?? undefined,
      preferredAiModelId: row.preferred_ai_model_id ?? null,
      aiDifficulty: row.ai_difficulty ?? undefined,
      aiRoundLength: row.ai_round_length ?? undefined,
      aiQuality: row.ai_quality ?? undefined,
      aiResponseLength: row.ai_response_length ?? undefined,
      showModelDetails: row.show_model_details === true,
      theme: row.theme ?? undefined,
      accent: row.accent ?? undefined,
      reducedMotion: row.reduced_motion === true,
      textSize: row.text_size ?? undefined,
      shareRealStance: row.share_real_stance === true,
      onboardingCompleted: row.onboarding_completed === true,
      onboardingStage: row.onboarding_stage ?? undefined,
      onboardingGoal: row.onboarding_goal ?? undefined,
      onboardingDismissed: row.onboarding_dismissed === true,
    })
  } catch (caught) {
    const issuePaths = caught instanceof PreferenceShapeError ? [[caught.field]] : caught instanceof z.ZodError ? caught.issues.map(issue => issue.path) : []
    return rejectPreferenceData(value, issuePaths)
  }
}

export function mapSupabaseError(operation: string, error: SupabaseFailure): RepositoryError {
  const rateLimited = error.code === 'P0001' || /rate limit/i.test(error.message || '')
  const code = rateLimited ? 'backend' : error.code === '23505' ? 'conflict' : error.code === '42501' ? 'forbidden' : error.code === 'PGRST116' ? 'not_found' : 'backend'
  const message = code === 'conflict'
    ? 'This operation has already been recorded.'
    : rateLimited
      ? 'Too many requests. Please wait a moment and try again.'
    : code === 'forbidden'
      ? 'You do not have permission to access this data.'
      : code === 'not_found'
        ? 'The requested record was not found.'
        : `Supabase could not complete ${operation}.`
  return new RepositoryErrorClass(code, message)
}

function isCollaborationSchemaUnavailable(error: SupabaseFailure): boolean {
  return error.code === '42P01' || error.code === 'PGRST205' || /team_debate_sessions|list_my_groups|schema cache|does not exist/i.test(error.message || '')
}

function validateJson<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', `Supabase returned invalid ${label} data.`)
  return parsed.data
}

function stageForStep(step: number): string {
  return ['stance', 'opening', 'rebuttal', 'pressure', 'steelman', 'closing', 'post'][step] || 'stance'
}

function stepForStage(stage: unknown): number {
  const index = ['stance', 'opening', 'rebuttal', 'pressure', 'steelman', 'closing', 'post'].indexOf(String(stage))
  return index < 0 ? 0 : index
}

function confidenceForDatabase(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 20)))
}

function confidenceForUi(value: unknown): number {
  return Math.max(1, Math.min(5, Math.round(Number(value || 20) / 20)))
}

export function mapChallengeRow(value: unknown): ChallengeRecord {
  const row = asRow(value)
  const normalized = {
    id: String(row.id || ''),
    token: String(row.token || ''),
    url: String(row.url || (row.token ? `/challenge/${String(row.token)}` : '')),
    expiresAt: String(row.expiresAt || row.expires_at || ''),
    takeId: String(row.takeId || row.take_id || ''),
    argument: String(row.argument || row.creator_argument || ''),
    mode: String(row.mode || 'classic'),
    creatorSide: String(row.creatorSide || row.creator_side || ''),
    status: row.status === 'completed' || row.status === 'expired' || row.status === 'revoked' ? row.status : 'open',
    response: typeof row.response === 'string' ? row.response : null,
    result: row.result && typeof row.result === 'object' ? { total: Number(asRow(row.result).total) } : null,
    creator: row.creator,
  }
  const parsed = challengeRecordSchema.safeParse(normalized)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid challenge data.')
  return { ...parsed.data, creator: mapProfilePreview(parsed.data.creator) }
}

export function mapResultRow(value: unknown): ResultData {
  const row = asRow(value)
  const payload = asRow(row.argument_dna)
  return validateJson(resultDataSchema, { ...payload, id: String(row.id || payload.id || '') }, 'result')
}

function mapReport(value: unknown): ReportRecord {
  const parsed = reportRowSchema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid report data.')
  return { id: parsed.data.id, status: parsed.data.status, createdAt: parsed.data.created_at }
}

function mapVisibleStats(value: unknown): VisibleProfileStats {
  const row = asRow(value)
  return { debates: row.debates !== false, sideSwitches: row.sideSwitches !== false, constructive: row.constructive !== false, argumentDna: row.argumentDna === true }
}

function mapProfilePreview(value: unknown): ProfilePreview | null {
  if (value === null || value === undefined) return null
  const parsed = profilePreviewSchema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid profile preview data.')
  return parsed.data
}

function mapPrivateProfile(userId: string, value: unknown): UserProfile | null {
  if (value === null || value === undefined) return null
  const parsed = privateProfileSchema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid private profile data.')
  return { id: userId, displayName: parsed.data.displayName, bio: parsed.data.bio, avatarPreset: parsed.data.avatarPreset, interfaceLanguage: parsed.data.interfaceLanguage, challengeShowName: parsed.data.challengeShowName, shareRealStance: parsed.data.shareRealStance, publicProfileKey: parsed.data.profileKey, handle: parsed.data.handle, friendCode: parsed.data.friendCode, avatarPath: parsed.data.avatarPath, profileAccent: parsed.data.profileAccent, profileVisibility: parsed.data.profileVisibility, avatarVisibility: parsed.data.avatarVisibility, fieldVisibility: { ...defaultProfileFieldVisibility, ...parsed.data.fieldVisibility }, visibleStats: mapVisibleStats(parsed.data.visibleStats), socialLinks: parsed.data.socialLinks }
}

function mapProfileView(value: unknown): ProfileView {
  const parsed = profileViewSchema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid profile data.')
  return parsed.data
}

function mapFriendship(value: unknown): FriendshipRecord {
  const parsed = friendshipSchema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid friendship data.')
  return { ...parsed.data, profile: mapProfilePreview(parsed.data.profile) }
}

function mapFriendChallenge(value: unknown): FriendChallengeRecord {
  const parsed = friendChallengeSchema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid friend challenge data.')
  return { ...parsed.data, creator: mapProfilePreview(parsed.data.creator), recipient: mapProfilePreview(parsed.data.recipient) }
}

function mapGroupFriendInvitation(value: unknown): GroupFriendInvitation {
  const parsed = groupFriendInvitationSchema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid Group invitation data.')
  return { ...parsed.data, inviter: mapProfilePreview(parsed.data.inviter) }
}

const groupSummarySchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(60), description: z.string().max(240), icon: z.string().max(8), accent: z.string().max(32), language: languageSchema, role: z.enum(['owner', 'moderator', 'member']), memberCount: z.number().int().min(0), leaderboardEnabled: z.boolean(), updatedAt: z.string() })
const groupMemberSchema = z.object({ userId: z.string().uuid(), profileKey: z.string().uuid().nullable().optional(), displayName: z.string().min(1).max(80), role: z.enum(['owner', 'moderator', 'member']), points: z.number().int().min(0), debatesCompleted: z.number().int().min(0), constructive: z.boolean() })
const groupTopicSchema = z.object({ id: z.string().uuid(), groupId: z.string().uuid(), statement: z.string().min(8).max(240), context: z.string().max(600), sideLabels: z.tuple([z.string().min(1).max(28), z.string().min(1).max(28)]), category: z.string().min(1).max(60), language: languageSchema, sensitivity: z.enum(['standard', 'sensitive']), creatorId: z.string().uuid(), status: z.enum(['approved', 'pending', 'archived']), createdAt: z.string() })
const groupInviteSchema = z.object({ id: z.string().uuid(), groupId: z.string().uuid(), code: z.string().max(80), expiresAt: z.string().nullable(), maxUses: z.number().int().positive().nullable(), uses: z.number().int().min(0), revoked: z.boolean() })

function mapGroupSummary(value: unknown): GroupSummary {
  const parsed = groupSummarySchema.safeParse(value)
  if (!parsed.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid group data.')
  return parsed.data
}

function mapGroupDetail(value: unknown): GroupDetail {
  const row = asRow(value)
  const summary = mapGroupSummary(row.summary)
  const members = z.array(groupMemberSchema).safeParse(row.members)
  const topics = z.array(groupTopicSchema).safeParse(row.topics)
  const invites = z.array(groupInviteSchema).safeParse(row.invites)
  if (!members.success || !topics.success || !invites.success) throw new RepositoryErrorClass('validation', 'Supabase returned invalid private group detail.')
  return { ...summary, rules: typeof row.rules === 'string' ? row.rules : '', members: members.data, topics: topics.data, invites: invites.data }
}

function mapGroupInvite(value: unknown): GroupInvite {
  const parsed = groupInviteSchema.safeParse(value)
  if (!parsed.success || parsed.data.code.length < 8) throw new RepositoryErrorClass('validation', 'Supabase returned invalid group invite data.')
  return parsed.data
}

export function createSupabaseRepository(client: SupabaseClient): AppRepository {
  const backend: BackendName = 'supabase'
  const diagnostics: RepositoryDiagnostics = { backend, ready: true, message: 'Using authenticated Supabase persistence.' }
  const saveQueues = new Map<string, Promise<void>>()

  async function loadProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await client.rpc('get_my_private_profile')
    if (error) throw mapSupabaseError('loading your profile', error)
    return mapPrivateProfile(userId, data)
  }

  async function saveProfile(profile: UserProfile): Promise<void> {
    const { error } = await client.rpc('update_my_profile_v2', { p_display_name: profile.displayName, p_bio: profile.bio, p_avatar_preset: profile.avatarPreset, p_interface_language: profile.interfaceLanguage, p_challenge_show_name: profile.challengeShowName, p_share_real_stance: profile.shareRealStance, p_handle: profile.handle, p_profile_accent: profile.profileAccent, p_profile_visibility: profile.profileVisibility, p_avatar_visibility: profile.avatarVisibility, p_visible_stats: profile.visibleStats, p_field_visibility: profile.fieldVisibility, p_social_links: profile.socialLinks })
    if (error) throw mapSupabaseError('saving your profile', error)
  }

  async function loadPreferences(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await client.from('user_preferences').select('user_id,topic_preferences,debate_languages,intensity,preferred_mode,preferred_ai_style,preferred_opponent_type,preferred_ai_family,preferred_opponent_id,preferred_ai_model_id,ai_difficulty,ai_round_length,ai_quality,ai_response_length,show_model_details,theme,accent,reduced_motion,text_size,share_real_stance,onboarding_completed,onboarding_stage,onboarding_goal,onboarding_dismissed').eq('user_id', userId).maybeSingle()
    if (error) throw mapSupabaseError('loading your preferences', error)
    if (!data) return null
    return parseSupabasePreferences(data, userId)
  }

  async function savePreferences(preferences: UserPreferences): Promise<void> {
    const { error } = await client.from('user_preferences').upsert({ user_id: preferences.userId, topic_preferences: preferences.topicPreferences, debate_languages: preferences.debateLanguages, intensity: preferences.intensity, preferred_mode: preferences.preferredMode, preferred_ai_style: preferences.preferredAiStyle, preferred_opponent_type: preferences.preferredOpponentType, preferred_ai_family: preferences.preferredAiFamily, preferred_opponent_id: preferences.preferredOpponentId, preferred_ai_model_id: preferences.preferredAiModelId, ai_difficulty: preferences.aiDifficulty, ai_round_length: preferences.aiRoundLength, ai_quality: preferences.aiQuality, ai_response_length: preferences.aiResponseLength, show_model_details: preferences.showModelDetails, theme: preferences.theme, accent: preferences.accent, reduced_motion: preferences.reducedMotion, text_size: preferences.textSize, share_real_stance: preferences.shareRealStance, onboarding_completed: preferences.onboardingCompleted, onboarding_stage: preferences.onboardingStage, onboarding_goal: preferences.onboardingGoal, onboarding_dismissed: preferences.onboardingDismissed }, { onConflict: 'user_id' })
    if (error) throw mapSupabaseError('saving your preferences', error)
  }

  async function getPrivateProfile(userId: string): Promise<UserProfile | null> {
    return loadProfile(userId)
  }

  async function getProfileForViewer(_userId: string, profileKey: string): Promise<ProfileView> {
    const { data, error } = await client.rpc('get_profile_for_viewer', { p_profile_key: profileKey })
    if (error) throw mapSupabaseError('loading that profile', error)
    return mapProfileView(data)
  }

  async function lookupProfileByHandle(_userId: string, handle: string): Promise<ProfilePreview | null> {
    const { data, error } = await client.rpc('lookup_profile_by_handle', { p_handle: handle })
    if (error) throw mapSupabaseError('looking up that handle', error)
    return mapProfilePreview(data)
  }

  async function lookupProfileByFriendCode(_userId: string, code: string): Promise<ProfilePreview | null> {
    const { data, error } = await client.rpc('lookup_profile_by_friend_code', { p_code: code })
    if (error) throw mapSupabaseError('looking up that friend code', error)
    return mapProfilePreview(data)
  }

  async function regenerateFriendCode(_userId: string): Promise<string> {
    const { data, error } = await client.rpc('regenerate_friend_code')
    if (error) throw mapSupabaseError('regenerating your friend code', error)
    const code = asRow(data).friendCode
    if (typeof code !== 'string') throw new RepositoryErrorClass('validation', 'Supabase returned an invalid friend code.')
    return code
  }

  async function listFriendships(_userId: string): Promise<FriendshipRecord[]> {
    const { data, error } = await client.rpc('list_my_friendships')
    if (error) throw mapSupabaseError('loading your friends', error)
    if (!Array.isArray(data)) throw new RepositoryErrorClass('validation', 'Supabase returned invalid friendship data.')
    return data.map(mapFriendship)
  }

  async function sendFriendRequest(_userId: string, profileKey: string): Promise<FriendshipRecord> {
    const { data, error } = await client.rpc('send_friend_request', { p_target_profile_key: profileKey })
    if (error) throw mapSupabaseError('sending the friend request', error)
    return mapFriendship(data)
  }

  async function updateFriendRequest(_userId: string, relationshipId: string, action: 'accept' | 'decline' | 'cancel' | 'remove'): Promise<FriendshipRecord | null> {
    const { data, error } = await client.rpc('update_friend_request', { p_relationship_id: relationshipId, p_action: action })
    if (error) throw mapSupabaseError('updating that friend request', error)
    return mapFriendship(data)
  }

  async function listBlocks(_userId: string): Promise<ProfilePreview[]> {
    const { data, error } = await client.rpc('list_my_blocks')
    if (error) throw mapSupabaseError('loading blocked users', error)
    if (!Array.isArray(data)) throw new RepositoryErrorClass('validation', 'Supabase returned invalid blocked-user data.')
    return data.map(item => mapProfilePreview(item)).filter((item): item is ProfilePreview => Boolean(item))
  }

  async function blockUser(_userId: string, profileKey: string): Promise<void> {
    const { error } = await client.rpc('block_user', { p_target_profile_key: profileKey })
    if (error) throw mapSupabaseError('blocking that user', error)
  }

  async function unblockUser(_userId: string, profileKey: string): Promise<void> {
    const { error } = await client.rpc('unblock_user', { p_target_profile_key: profileKey })
    if (error) throw mapSupabaseError('unblocking that user', error)
  }

  async function uploadAvatar(userId: string, file: Blob, detectedMime: string): Promise<string> {
    const profile = await getPrivateProfile(userId)
    if (!profile?.publicProfileKey) throw new RepositoryErrorClass('not_found', 'Your private profile is not ready yet.')
    const objectPath = `${profile.publicProfileKey}/current.webp`
    const upload = await client.storage.from('profile-avatars').upload(objectPath, file, { contentType: detectedMime, upsert: true, cacheControl: '300' })
    if (upload.error) throw mapSupabaseError('uploading your profile photo', upload.error)
    const { error } = await client.rpc('set_my_avatar_path', { p_object_path: objectPath, p_mime_type: detectedMime, p_byte_size: file.size })
    if (error) {
      await client.storage.from('profile-avatars').remove([objectPath])
      throw mapSupabaseError('saving your profile photo', error)
    }
    return objectPath
  }

  async function removeAvatar(userId: string): Promise<void> {
    const profile = await getPrivateProfile(userId)
    if (profile?.avatarPath) {
      const removed = await client.storage.from('profile-avatars').remove([profile.avatarPath])
      if (removed.error) throw mapSupabaseError('removing your profile photo', removed.error)
    }
    const { error } = await client.rpc('remove_my_avatar')
    if (error) throw mapSupabaseError('removing your profile photo', error)
  }

  async function getAvatarUrl(_userId: string, objectPath: string): Promise<string | null> {
    const { data, error } = await client.storage.from('profile-avatars').createSignedUrl(objectPath, 300)
    if (error) throw mapSupabaseError('loading a private profile photo', error)
    return data?.signedUrl || null
  }

  async function createFriendChallenge(_userId: string, payload: { profileKey: string; takeId: string; mode: string; creatorSide: string; argument: string }): Promise<FriendChallengeRecord> {
    const { data, error } = await client.rpc('create_friend_challenge', { p_recipient_profile_key: payload.profileKey, p_take_id: payload.takeId, p_mode: payload.mode, p_creator_side: payload.creatorSide, p_creator_argument: payload.argument })
    if (error) throw mapSupabaseError('creating the friend challenge', error)
    return mapFriendChallenge({ ...asRow(data), direction: 'outgoing', creator: null, recipient: null, response: null, result: null })
  }

  async function listFriendChallenges(_userId: string): Promise<FriendChallengeRecord[]> {
    const { data, error } = await client.rpc('list_my_friend_challenges')
    if (error) throw mapSupabaseError('loading friend challenges', error)
    if (!Array.isArray(data)) throw new RepositoryErrorClass('validation', 'Supabase returned invalid friend challenge data.')
    return data.map(mapFriendChallenge)
  }

  async function completeFriendChallenge(_userId: string, challengeId: string, response: string): Promise<FriendChallengeRecord> {
    const { data, error } = await client.rpc('complete_friend_challenge', { p_challenge_id: challengeId, p_response_content: response })
    if (error) throw mapSupabaseError('answering the friend challenge', error)
    return mapFriendChallenge({ ...asRow(data), direction: 'incoming', creator: null, recipient: null, expiresAt: new Date().toISOString(), response, result: asRow(data).result || null })
  }

  async function listGroupFriendInvitations(_userId: string): Promise<GroupFriendInvitation[]> {
    const { data, error } = await client.rpc('list_my_group_invitations')
    if (error) throw mapSupabaseError('loading Group invitations', error)
    if (!Array.isArray(data)) throw new RepositoryErrorClass('validation', 'Supabase returned invalid Group invitation data.')
    return data.map(mapGroupFriendInvitation)
  }

  async function createGroupFriendInvitation(_userId: string, groupId: string, profileKey: string): Promise<void> {
    const { error } = await client.rpc('create_group_friend_invitation', { p_group_id: groupId, p_invitee_profile_key: profileKey })
    if (error) throw mapSupabaseError('creating the Group invitation', error)
  }

  async function respondGroupFriendInvitation(_userId: string, invitationId: string, action: 'accept' | 'decline'): Promise<void> {
    const { error } = await client.rpc('respond_group_friend_invitation', { p_invitation_id: invitationId, p_action: action })
    if (error) throw mapSupabaseError('responding to the Group invitation', error)
  }

  async function loadDebate(userId: string): Promise<DebateSnapshot | null> {
    const { data, error } = await client.from('debates').select('id,take_id,mode,assigned_side,language,status,current_stage,snapshot,updated_at').eq('owner_id', userId).eq('status', 'active').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw mapSupabaseError('loading your active debate', error)
    if (!data) return null
    const row = asRow(data)
    const stored = debateSnapshotSchema.safeParse(row.snapshot)
    if (stored.success) return stored.data

    const [turnsResponse, stancesResponse] = await Promise.all([
      client.from('debate_turns').select('author_type,content,sequence_number').eq('debate_id', String(row.id)).order('sequence_number', { ascending: true }),
      client.from('stance_snapshots').select('stage,stance_value,confidence').eq('debate_id', String(row.id)).eq('user_id', userId),
    ])
    if (turnsResponse.error) throw mapSupabaseError('loading your debate turns', turnsResponse.error)
    if (stancesResponse.error) throw mapSupabaseError('loading your private stances', stancesResponse.error)
    const responses: Record<number, string> = {}
    const opponentMessages: Record<number, string> = {}
    for (const raw of turnsResponse.data || []) {
      const turn = asRow(raw)
      const sequence = Number(turn.sequence_number)
      const round = Math.floor(sequence / 2)
      if (turn.author_type === 'user') responses[round] = String(turn.content)
      if (turn.author_type === 'opponent') opponentMessages[round] = String(turn.content)
    }
    const before = (stancesResponse.data || []).map(asRow).find(rowValue => rowValue.stage === 'before')
    const after = (stancesResponse.data || []).map(asRow).find(rowValue => rowValue.stage === 'after')
    return validateJson(debateSnapshotSchema, {
      id: String(row.id),
      takeId: String(row.take_id),
      mode: row.mode,
      step: stepForStage(row.current_stage),
      stance: Number(before?.stance_value || 1) as Stance,
      postStance: Number(after?.stance_value || before?.stance_value || 1) as Stance,
      confidence: confidenceForUi(before?.confidence),
      understanding: 'yes',
      responses,
      opponentMessages,
      assignedSide: String(row.assigned_side),
      language: row.language === 'en' || row.language === 'de' || row.language === 'fr' || row.language === 'es' || row.language === 'it' ? row.language : 'en',
      status: 'active',
      updatedAt: String(row.updated_at),
    }, 'active debate')
  }

  async function saveDebateNow(userId: string, debate: DebateSnapshot | null): Promise<void> {
    if (!debate) {
      const { error } = await client.from('debates').update({ status: 'abandoned', updated_at: new Date().toISOString() }).eq('owner_id', userId).eq('status', 'active')
      if (error) throw mapSupabaseError('closing your active debate', error)
      return
    }
    const { error } = await client.from('debates').upsert({
      id: debate.id,
      owner_id: userId,
      take_id: debate.takeId,
      mode: debate.mode,
      assigned_side: debate.assignedSide,
      opponent_type: 'mock_or_configured_ai',
      language: debate.language,
      status: debate.status,
      current_stage: stageForStep(debate.step),
      snapshot: debate,
      completed_at: debate.status === 'completed' ? debate.updatedAt : null,
      updated_at: debate.updatedAt,
    }, { onConflict: 'id' })
    if (error) throw mapSupabaseError('saving your debate', error)

    if (debate.status === 'active') {
      const turns = Object.entries(debate.responses).map(([step, content]) => ({ debate_id: debate.id, author_type: 'user', round_type: stageForStep(Number(step)), content, sequence_number: Number(step) * 2 }))
      for (const [step, content] of Object.entries(debate.opponentMessages)) turns.push({ debate_id: debate.id, author_type: 'opponent', round_type: stageForStep(Number(step)), content, sequence_number: Number(step) * 2 + 1 })
      if (turns.length) {
        const turnResponse = await client.from('debate_turns').upsert(turns, { onConflict: 'debate_id,sequence_number' })
        if (turnResponse.error) throw mapSupabaseError('saving your debate turns', turnResponse.error)
      }
      const stances = [
        { debate_id: debate.id, user_id: userId, stage: 'before', stance_value: debate.stance, confidence: confidenceForDatabase(debate.confidence) },
        { debate_id: debate.id, user_id: userId, stage: 'after', stance_value: debate.postStance, confidence: confidenceForDatabase(debate.confidence) },
      ]
      const stanceResponse = await client.from('stance_snapshots').upsert(stances, { onConflict: 'debate_id,user_id,stage' })
      if (stanceResponse.error) throw mapSupabaseError('saving your private stance', stanceResponse.error)
    }
  }

  async function saveDebate(userId: string, debate: DebateSnapshot | null): Promise<void> {
    const key = debate?.id || `${userId}:active`
    const previous = saveQueues.get(key) || Promise.resolve()
    const next = previous.catch(() => undefined).then(() => saveDebateNow(userId, debate))
    saveQueues.set(key, next)
    try { await next } finally { if (saveQueues.get(key) === next) saveQueues.delete(key) }
  }

  async function loadResult(userId: string): Promise<ResultData | null> {
    const { data, error } = await client.from('debate_results').select('id,argument_dna').eq('owner_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw mapSupabaseError('loading your latest result', error)
    return data ? mapResultRow(data) : null
  }

  async function saveResult(userId: string, result: ResultData | null): Promise<void> {
    if (!result) return
    if (!result.debateId) throw new RepositoryErrorClass('validation', 'A completed result must reference its debate.')
    const { error } = await client.from('debate_results').upsert({ id: result.id, debate_id: result.debateId, owner_id: userId, scores: result.scores, argument_dna: result, coaching: result.coaching, model_provider: 'server-ai-or-mock' }, { onConflict: 'debate_id' })
    if (error) throw mapSupabaseError('saving your result', error)
  }

  async function loadHistory(userId: string): Promise<ResultData[]> {
    const { data, error } = await client.from('debate_results').select('id,argument_dna').eq('owner_id', userId).order('created_at', { ascending: false })
    if (error) throw mapSupabaseError('loading your debate history', error)
    return (data || []).map(mapResultRow)
  }

  async function saveHistory(userId: string, history: ResultData[]): Promise<void> {
    for (const result of history) if (result.debateId) await saveResult(userId, result)
  }

  async function loadStats(userId: string): Promise<UserStatsSnapshot> {
    if (!userId) return { challengeCreated: 0, challengeResponses: 0, activityDates: [] }
    const { data, error } = await client.rpc('get_my_beta_stats')
    if (error) throw mapSupabaseError('loading your private statistics', error)
    const row = asRow(data)
    const activityDates = Array.isArray(row.activityDates) ? row.activityDates.filter((item): item is string => typeof item === 'string') : []
    return { challengeCreated: Number(row.challengeCreated || 0), challengeResponses: Number(row.challengeResponses || 0), activityDates }
  }

  async function createChallenge(userId: string, payload: { takeId: string; argument: string; mode: string; creatorSide: string }): Promise<ChallengeRecord> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to create a challenge.')
    const { data, error } = await client.rpc('create_challenge', { p_take_id: payload.takeId, p_mode: payload.mode, p_creator_side: payload.creatorSide, p_creator_argument: payload.argument })
    if (error) throw mapSupabaseError('creating your challenge', error)
    return mapChallengeRow(data)
  }

  async function loadChallenge(token: string): Promise<ChallengeResolved> {
    const { data, error } = await client.rpc('resolve_challenge', { p_token: token })
    if (error) throw mapSupabaseError('loading this challenge', error)
    const record = mapChallengeRow(data)
    return { ...record, canRespond: record.status === 'open' }
  }

  async function listChallenges(userId: string): Promise<ChallengeRecord[]> {
    if (!userId) return []
    const { data, error } = await client.rpc('list_my_challenges')
    if (error) throw mapSupabaseError('loading your challenges', error)
    if (!Array.isArray(data)) throw new RepositoryErrorClass('validation', 'Supabase returned invalid challenge history.')
    return data.map(mapChallengeRow)
  }

  async function revokeChallenge(userId: string, challengeId: string): Promise<void> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to revoke a challenge.')
    const { error } = await client.rpc('revoke_challenge', { p_challenge_id: challengeId })
    if (error) throw mapSupabaseError('revoking your challenge', error)
  }

  async function deleteMyBetaData(userId: string): Promise<void> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to delete beta data.')
    const profile = await getPrivateProfile(userId)
    if (profile?.avatarPath) {
      const removed = await client.storage.from('profile-avatars').remove([profile.avatarPath])
      if (removed.error) throw mapSupabaseError('removing your profile photo', removed.error)
    }
    const { error } = await client.rpc('delete_my_beta_data')
    if (error) throw mapSupabaseError('deleting your beta data', error)
    const { error: usageError } = await client.rpc('delete_my_basic_ai_usage')
    if (usageError) throw mapSupabaseError('deleting your Basic AI usage', usageError)
  }

  async function respondToChallenge(token: string, response: string): Promise<ChallengeResolved> {
    const { data, error } = await client.rpc('complete_challenge_response', { p_token: token, p_response_content: response })
    if (error) throw mapSupabaseError('submitting your challenge response', error)
    const record = mapChallengeRow(data)
    return { ...record, canRespond: false }
  }

  async function submitReport(userId: string, payload: ReportInput): Promise<ReportRecord> {
    const input = z.object({ reason: z.string().trim().min(1).max(80), details: z.string().trim().max(1000).nullable().optional() }).safeParse(payload)
    if (!input.success) throw new RepositoryErrorClass('validation', 'Choose a reason and keep details under 1,000 characters.')
    const { data, error } = await client.rpc('submit_report', { p_debate_id: payload.debateId || null, p_challenge_id: payload.challengeId || null, p_reported_content_type: payload.reportedContentType, p_reason: input.data.reason, p_details: input.data.details || null })
    if (!error && data) return mapReport(data)
    if (error?.code === '23505') {
      const existing = await client.from('reports').select('id,status,created_at').eq('reporter_id', userId).eq('reason', input.data.reason).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (existing.error) throw mapSupabaseError('checking your existing report', existing.error)
      if (existing.data) return mapReport(existing.data)
    }
    throw mapSupabaseError('submitting your report', error || { message: 'No report was returned.' })
  }

  async function recordAiFeedback(userId: string, payload: AiFeedbackInput): Promise<void> {
    const { error } = await client.from('ai_quality_feedback').upsert({ owner_id: userId, debate_id: payload.debateId, opponent_id: payload.opponentId, model_id: payload.modelId, feedback_type: payload.feedbackType }, { onConflict: 'owner_id,debate_id,opponent_id,feedback_type' })
    if (error) throw mapSupabaseError('recording AI feedback', error)
  }

  async function submitBetaFeedback(userId: string, payload: BetaFeedbackInput): Promise<string> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to send feedback.')
    const input = z.object({ category: z.enum(['broken', 'ai_quality', 'design_usability', 'missing_topic', 'suggestion', 'other']), message: z.string().trim().max(600).nullable().optional(), surface: z.enum(['settings', 'debate_result']), screen: z.string().trim().min(1).max(40), aiModelId: z.string().trim().max(160).nullable().optional(), appVersion: z.string().trim().min(1).max(40) }).safeParse(payload)
    if (!input.success) throw new RepositoryErrorClass('validation', 'Choose a feedback type and keep the message under 600 characters.')
    const { data, error } = await client.rpc('submit_beta_feedback', { p_category: input.data.category, p_message: input.data.message || null, p_surface: input.data.surface, p_screen: input.data.screen, p_ai_model_id: input.data.aiModelId || null, p_app_version: input.data.appVersion })
    if (error) throw mapSupabaseError('sending beta feedback', error)
    if (typeof data !== 'string') throw new RepositoryErrorClass('validation', 'Feedback was saved without a valid id.')
    return data
  }

  async function loadTeamSession(userId: string): Promise<TeamDebateSession | null> {
    if (!userId) return null
    const { data, error } = await client.from('team_debate_sessions').select('snapshot').eq('facilitator_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (error && isCollaborationSchemaUnavailable(error)) return null
    if (error) throw mapSupabaseError('loading your Team Debate session', error)
    if (!data) return null
    return validateJson(teamDebateSessionSchema, asRow(data).snapshot, 'Team Debate session')
  }

  async function saveTeamSession(userId: string, session: TeamDebateSession | null): Promise<void> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to save a Team Debate session.')
    if (!session) {
      const { data, error } = await client.from('team_debate_sessions').select('snapshot').eq('facilitator_id', userId).in('status', ['active', 'paused']).order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw mapSupabaseError('loading your active Team Debate session', error)
      if (!data) return
      const current = validateJson(teamDebateSessionSchema, asRow(data).snapshot, 'Team Debate session')
      const ended = { ...current, status: 'ended' as const, updatedAt: new Date().toISOString() }
      const { error: saveError } = await client.rpc('save_team_debate_session', { p_id: ended.id, p_group_id: ended.groupId, p_status: ended.status, p_topic: ended.topic, p_teams: ended.teams, p_snapshot: ended, p_completed_at: ended.result?.completedAt || null, p_updated_at: ended.updatedAt })
      if (saveError) throw mapSupabaseError('closing your Team Debate session', saveError)
      return
    }
    const checked = validateJson(teamDebateSessionSchema, session, 'Team Debate session')
    const { error } = await client.rpc('save_team_debate_session', { p_id: checked.id, p_group_id: checked.groupId, p_status: checked.status, p_topic: checked.topic, p_teams: checked.teams, p_snapshot: checked, p_completed_at: checked.result?.completedAt || null, p_updated_at: checked.updatedAt })
    if (error) throw mapSupabaseError('saving your Team Debate session', error)
  }

  async function listGroups(userId: string): Promise<GroupSummary[]> {
    if (!userId) return []
    const { data, error } = await client.rpc('list_my_groups')
    if (error && isCollaborationSchemaUnavailable(error)) return []
    if (error) throw mapSupabaseError('loading your private groups', error)
    if (!Array.isArray(data)) throw new RepositoryErrorClass('validation', 'Supabase returned invalid group data.')
    return data.map(mapGroupSummary)
  }

  async function createGroup(userId: string, input: CreateGroupInput): Promise<GroupSummary> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to create a group.')
    const checked = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(240), rules: z.string().trim().max(600), icon: z.string().max(8), accent: z.string().max(32), language: languageSchema, memberLimit: z.number().int().min(2).max(500).nullable(), leaderboardEnabled: z.boolean() }).safeParse(input)
    if (!checked.success) throw new RepositoryErrorClass('validation', 'Keep the group name, description and rules within their limits.')
    const { data, error } = await client.rpc('create_group', { p_name: checked.data.name, p_description: checked.data.description, p_rules: checked.data.rules, p_icon: checked.data.icon, p_accent: checked.data.accent, p_language: checked.data.language, p_member_limit: checked.data.memberLimit, p_leaderboard_enabled: checked.data.leaderboardEnabled })
    if (error) throw mapSupabaseError('creating your private group', error)
    return mapGroupSummary(data)
  }

  async function loadGroup(userId: string, groupId: string): Promise<GroupDetail> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to open a group.')
    const checked = z.string().uuid().safeParse(groupId)
    if (!checked.success) throw new RepositoryErrorClass('validation', 'This group link is invalid.')
    const { data, error } = await client.rpc('load_group', { p_group_id: checked.data })
    if (error) throw mapSupabaseError('loading this private group', error)
    return mapGroupDetail(data)
  }

  async function createGroupInvite(userId: string, groupId: string): Promise<GroupInvite> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to create an invite.')
    const { data, error } = await client.rpc('create_group_invite', { p_group_id: groupId })
    if (error) throw mapSupabaseError('creating your group invite', error)
    return mapGroupInvite(data)
  }

  async function joinGroupByInvite(userId: string, code: string): Promise<GroupSummary> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to join a group.')
    const checked = z.string().trim().min(8).max(80).safeParse(code)
    if (!checked.success) throw new RepositoryErrorClass('validation', 'Enter a valid group invite code.')
    const { data, error } = await client.rpc('join_group_by_invite', { p_code: checked.data })
    if (error) throw mapSupabaseError('joining this private group', error)
    return mapGroupSummary(data)
  }

  async function createGroupTopic(userId: string, groupId: string, input: CreateGroupTopicInput): Promise<void> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to add a group topic.')
    const checked = z.object({ statement: z.string().trim().min(8).max(240), context: z.string().trim().max(600), sideLabels: z.tuple([z.string().trim().min(1).max(28), z.string().trim().min(1).max(28)]), category: z.string().trim().min(1).max(60), language: languageSchema, sensitivity: z.enum(['standard', 'sensitive']) }).safeParse(input)
    if (!checked.success) throw new RepositoryErrorClass('validation', 'Keep the group topic within its limits.')
    const { error } = await client.rpc('create_group_topic', { p_group_id: groupId, p_statement: checked.data.statement, p_context: checked.data.context, p_support_label: checked.data.sideLabels[0], p_question_label: checked.data.sideLabels[1], p_category: checked.data.category, p_language: checked.data.language, p_sensitivity: checked.data.sensitivity })
    if (error) throw mapSupabaseError('saving the group topic', error)
  }

  async function recordGroupParticipation(userId: string, groupId: string, points: number): Promise<void> {
    if (!userId) throw new RepositoryErrorClass('auth_required', 'Authentication is required to record group participation.')
    const { error } = await client.rpc('record_group_participation', { p_group_id: groupId, p_points: Math.max(0, Math.min(100, Math.round(points))) })
    if (error) throw mapSupabaseError('recording group participation', error)
  }

  return { backend, diagnostics: () => diagnostics, loadProfile, saveProfile, loadPreferences, savePreferences, getPrivateProfile, getProfileForViewer, lookupProfileByHandle, lookupProfileByFriendCode, regenerateFriendCode, listFriendships, sendFriendRequest, updateFriendRequest, listBlocks, blockUser, unblockUser, uploadAvatar, removeAvatar, getAvatarUrl, createFriendChallenge, listFriendChallenges, completeFriendChallenge, listGroupFriendInvitations, createGroupFriendInvitation, respondGroupFriendInvitation, loadDebate, saveDebate, loadResult, saveResult, loadHistory, saveHistory, loadStats, createChallenge, loadChallenge, listChallenges, revokeChallenge, deleteMyBetaData, respondToChallenge, submitReport, recordAiFeedback, submitBetaFeedback, loadTeamSession, saveTeamSession, listGroups, createGroup, loadGroup, createGroupInvite, joinGroupByInvite, createGroupTopic, recordGroupParticipation }
}
