import { z } from 'zod'
import type { AccentTheme, AppearanceTheme, AvatarPreset, TextSize, UserPreferences, UserProfile } from './data/types'
import { sanitizeSocialLinks } from './profileVisibility'

export const avatarPresets: AvatarPreset[] = ['orbit', 'spark', 'wave', 'sun', 'leaf']
export const accentThemes: AccentTheme[] = ['violet', 'cyan', 'amber', 'coral', 'mint', 'neutral']

export const defaultProfileFieldVisibility = {
  avatar: 'friends',
  displayName: 'public',
  bio: 'friends',
  profileAccent: 'friends',
  argumentDna: 'friends',
  statistics: 'friends',
  socialLinks: 'friends',
  groupRelationship: 'shared_groups',
} as const

export const userProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().max(24).nullable(),
  bio: z.string().trim().max(160).nullable(),
  avatarPreset: z.enum(['orbit', 'spark', 'wave', 'sun', 'leaf']),
  interfaceLanguage: z.enum(['en', 'de', 'fr', 'es', 'it']),
  challengeShowName: z.boolean(),
  shareRealStance: z.boolean(),
  publicProfileKey: z.string().uuid().nullable(),
  handle: z.string().regex(/^[a-z0-9_]{3,24}$/).nullable(),
  friendCode: z.string().regex(/^SS-[A-Z2-9]{10}$/).nullable(),
  avatarPath: z.string().nullable(),
  avatarRevision: z.number().int().nonnegative().optional(),
  profileAccent: z.enum(['violet', 'cyan', 'amber', 'coral', 'mint', 'neutral']),
  profileVisibility: z.enum(['private', 'friends', 'shared_groups', 'public']),
  avatarVisibility: z.enum(['private', 'friends', 'shared_groups', 'public']),
  fieldVisibility: z.object({ avatar: z.enum(['private', 'friends', 'shared_groups', 'public']), displayName: z.enum(['private', 'friends', 'shared_groups', 'public']), bio: z.enum(['private', 'friends', 'shared_groups', 'public']), profileAccent: z.enum(['private', 'friends', 'shared_groups', 'public']), argumentDna: z.enum(['private', 'friends', 'shared_groups', 'public']), statistics: z.enum(['private', 'friends', 'shared_groups', 'public']), socialLinks: z.enum(['private', 'friends', 'shared_groups', 'public']), groupRelationship: z.enum(['private', 'friends', 'shared_groups', 'public']) }),
  visibleStats: z.object({ debates: z.boolean(), sideSwitches: z.boolean(), constructive: z.boolean(), argumentDna: z.boolean() }),
  socialLinks: z.array(z.object({ provider: z.enum(['instagram', 'tiktok', 'youtube', 'twitch', 'github', 'spotify', 'x', 'website']), url: z.string().url(), label: z.string().max(40).nullable(), visibility: z.enum(['private', 'friends', 'shared_groups', 'public']), order: z.number().int().min(0).max(4) })).max(5),
})

export const userPreferencesSchema = z.object({
  userId: z.string().min(1),
  topicPreferences: z.array(z.string().min(1).max(80)).min(0).max(32),
  debateLanguages: z.array(z.enum(['en', 'de', 'fr', 'es', 'it'])).min(1).max(2),
  intensity: z.string().max(40).nullable(),
  preferredMode: z.enum(['classic', 'sideswitch', 'blindside', 'commonground']),
  preferredAiStyle: z.string().max(40).nullable(),
  preferredOpponentType: z.enum(['ask', 'ai', 'person']),
  preferredAiFamily: z.enum(['Gemini', 'Claude', 'GPT', 'DeepSeek']),
  preferredOpponentId: z.string().min(1).max(60),
  preferredAiModelId: z.string().max(160).nullable(),
  aiDifficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  aiRoundLength: z.enum(['quick', 'standard', 'deep']),
  aiQuality: z.enum(['fast', 'balanced', 'maximum']),
  aiResponseLength: z.enum(['concise', 'standard', 'detailed']),
  showModelDetails: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
  accent: z.enum(['violet', 'cyan', 'amber', 'coral', 'mint', 'neutral']),
  reducedMotion: z.boolean(),
  textSize: z.enum(['compact', 'comfortable']),
  shareRealStance: z.boolean(),
  onboardingCompleted: z.boolean(),
  onboardingStage: z.number().int().min(0).max(3),
  onboardingGoal: z.enum(['reasoning', 'school', 'friends', 'perspectives', 'fun']),
  onboardingDismissed: z.boolean(),
})

export function normalizeProfile(profile: Partial<UserProfile> & Pick<UserProfile, 'id'>): UserProfile {
  return userProfileSchema.parse({
    id: profile.id,
    displayName: profile.displayName?.trim() || null,
    bio: profile.bio?.trim() || null,
    avatarPreset: profile.avatarPreset || 'orbit',
    interfaceLanguage: profile.interfaceLanguage || 'en',
    challengeShowName: profile.challengeShowName === true,
    shareRealStance: profile.shareRealStance === true,
    publicProfileKey: profile.publicProfileKey || null,
    handle: profile.handle || null,
    friendCode: profile.friendCode || null,
    avatarPath: profile.avatarPath || null,
    avatarRevision: profile.avatarRevision || 0,
    profileAccent: profile.profileAccent || 'coral',
    profileVisibility: profile.profileVisibility || 'friends',
    avatarVisibility: profile.avatarVisibility || 'private',
    fieldVisibility: profile.fieldVisibility || { ...defaultProfileFieldVisibility },
    visibleStats: profile.visibleStats || { debates: true, sideSwitches: true, constructive: true, argumentDna: false },
    socialLinks: sanitizeSocialLinks(profile.socialLinks),
  })
}

export function normalizePreferences(preferences: Partial<UserPreferences> & Pick<UserPreferences, 'userId'>): UserPreferences {
  return userPreferencesSchema.parse({
    userId: preferences.userId,
    topicPreferences: Array.from(new Set(preferences.topicPreferences || [])).slice(0, 32),
    debateLanguages: preferences.debateLanguages?.length ? preferences.debateLanguages : ['en'],
    intensity: preferences.intensity || 'balanced',
    preferredMode: preferences.preferredMode || 'sideswitch',
    preferredAiStyle: preferences.preferredAiStyle || 'sharp-skeptic',
    preferredOpponentType: preferences.preferredOpponentType || 'ask',
    preferredAiFamily: preferences.preferredAiFamily || 'GPT',
    preferredOpponentId: preferences.preferredOpponentId || 'gpt-logician',
    preferredAiModelId: preferences.preferredAiModelId || null,
    aiDifficulty: preferences.aiDifficulty || 'intermediate',
    aiRoundLength: preferences.aiRoundLength || 'standard',
    aiQuality: preferences.aiQuality || 'balanced',
    aiResponseLength: preferences.aiResponseLength || 'standard',
    showModelDetails: preferences.showModelDetails === true,
    theme: preferences.theme || 'system',
    accent: preferences.accent || 'coral',
    reducedMotion: preferences.reducedMotion === true,
    textSize: preferences.textSize || 'comfortable',
    shareRealStance: preferences.shareRealStance === true,
    onboardingCompleted: preferences.onboardingCompleted === true,
    onboardingStage: Math.max(0, Math.min(3, Number(preferences.onboardingStage) || 0)),
    onboardingGoal: preferences.onboardingGoal || 'reasoning',
    onboardingDismissed: preferences.onboardingDismissed === true,
  })
}

export const appearanceLabels: Record<AppearanceTheme, string> = { system: 'System', light: 'Light', dark: 'Dark' }
export const textSizeLabels: Record<TextSize, string> = { compact: 'Standard', comfortable: 'Large' }
