import type { Mode } from '../domain'
import type { AiFamily, AiQuality, AiResponseLength, PreferredOpponentType } from '../lib/ai/types'

export type BackendName = 'local' | 'supabase'
export type AvatarPreset = 'orbit' | 'spark' | 'wave' | 'sun' | 'leaf'
export type AppearanceTheme = 'system' | 'light' | 'dark'
export type AccentTheme = 'violet' | 'cyan' | 'amber' | 'coral' | 'mint' | 'neutral'
export type TextSize = 'compact' | 'comfortable'

export type UserProfile = {
  id: string
  displayName: string | null
  bio: string | null
  avatarPreset: AvatarPreset
  interfaceLanguage: 'en' | 'de'
  challengeShowName: boolean
  shareRealStance: boolean
}

export type UserPreferences = {
  userId: string
  topicPreferences: string[]
  debateLanguages: ('en' | 'de')[]
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
