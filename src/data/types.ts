import type { Language, Mode } from '../domain'
import type { AiFamily, AiQuality, AiResponseLength, PreferredOpponentType } from '../lib/ai/types'

export type BackendName = 'local' | 'supabase'
export type AvatarPreset = 'orbit' | 'spark' | 'wave' | 'sun' | 'leaf'
export type AppearanceTheme = 'system' | 'light' | 'dark'
export type AccentTheme = 'violet' | 'cyan' | 'amber' | 'coral' | 'mint' | 'neutral'
export type TextSize = 'compact' | 'comfortable'
export type ProfileVisibility = 'private' | 'friends' | 'shared_groups' | 'public'
export type ProfileField = 'avatar' | 'displayName' | 'bio' | 'profileAccent' | 'argumentDna' | 'statistics' | 'socialLinks' | 'groupRelationship'
export type ProfileFieldVisibility = Record<ProfileField, ProfileVisibility>
export type SocialProvider = 'instagram' | 'tiktok' | 'youtube' | 'twitch' | 'github' | 'spotify' | 'x' | 'website'
export type SocialLink = { provider: SocialProvider; url: string; label: string | null; visibility: ProfileVisibility; order: number }
export type VisibleProfileStats = { debates: boolean; sideSwitches: boolean; constructive: boolean; argumentDna: boolean }
export type ProfileStats = { debatesCompleted: number; sideSwitchesCompleted: number; topicsExplored: number; challengeResponses: number; challengesCreated: number; languagesUsed: number }

export type UserProfile = {
  id: string
  displayName: string | null
  bio: string | null
  avatarPreset: AvatarPreset
  interfaceLanguage: Language
  challengeShowName: boolean
  shareRealStance: boolean
  publicProfileKey: string | null
  handle: string | null
  friendCode: string | null
  avatarPath: string | null
  avatarRevision?: number
  profileAccent: AccentTheme
  profileVisibility: ProfileVisibility
  avatarVisibility: ProfileVisibility
  fieldVisibility: ProfileFieldVisibility
  visibleStats: VisibleProfileStats
  socialLinks: SocialLink[]
}

export type UserPreferences = {
  userId: string
  topicPreferences: string[]
  debateLanguages: Language[]
  intensity: string | null
  preferredMode: Mode
  preferredAiStyle: string | null
  preferredOpponentType: PreferredOpponentType
  preferredAiFamily: AiFamily
  preferredOpponentId: string
  preferredAiModelId: string | null
  aiDifficulty: import('../domain').AiDifficulty
  aiRoundLength: import('../domain').AiRoundLength
  aiQuality: AiQuality
  aiResponseLength: AiResponseLength
  showModelDetails: boolean
  theme: AppearanceTheme
  accent: AccentTheme
  reducedMotion: boolean
  textSize: TextSize
  shareRealStance: boolean
  onboardingCompleted: boolean
  onboardingStage: number
  onboardingGoal: 'reasoning' | 'school' | 'friends' | 'perspectives' | 'fun'
  onboardingDismissed: boolean
}

export type UserStatsSnapshot = {
  challengeCreated: number
  challengeResponses: number
  activityDates: string[]
}

export type LegacyMigrationState = {
  migratedAt: string | null
  source: 'local-storage'
}

export type RepositoryDiagnostics = {
  backend: BackendName
  ready: boolean
  message: string
}
