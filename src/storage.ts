import type { DebateSnapshot, Language, Mode, ResultData } from './domain'
import type { AccentTheme, AppearanceTheme, AvatarPreset, ProfileFieldVisibility, ProfileVisibility, SocialLink, TextSize } from './data/types'
import type { GroupInvite, GroupMember, GroupTopic, TeamDebateSession } from './collaboration'
import { makeId } from './domain'

const STORAGE_KEY = 'sideshift-state-v2'

export type PersistedState = {
  userId: string
  onboarded: boolean
  name: string
  bio: string
  profileVisibility: ProfileVisibility
  profileFieldVisibility: ProfileFieldVisibility
  socialLinks: SocialLink[]
  avatarPreset: AvatarPreset
  challengeShowName: boolean
  shareRealStance: boolean
  interests: string[]
  language: Language
  debateLanguage: Language
  intensity: string
  preferredMode: Mode
  preferredAiStyle: string
  preferredOpponentType: import('./lib/ai/types').PreferredOpponentType
  preferredAiFamily: import('./lib/ai/types').AiFamily
  preferredOpponentId: string
  preferredAiModelId: string | null
  aiDifficulty: import('./domain').AiDifficulty
  aiRoundLength: import('./domain').AiRoundLength
  aiQuality: import('./lib/ai/types').AiQuality
  aiResponseLength: import('./lib/ai/types').AiResponseLength
  showModelDetails: boolean
  theme: AppearanceTheme
  accent: AccentTheme
  reducedMotion: boolean
  textSize: TextSize
  debate: DebateSnapshot | null
  result: ResultData | null
  history: ResultData[]
  challenges: Record<string, {
    id: string
    token: string
    creatorId: string
    takeId: string
    mode: string
    creatorSide: string
    argument: string
    expiresAt: string
    status: 'open' | 'completed' | 'expired' | 'revoked'
    response: string | null
    result: { total: number } | null
    completedAt: string | null
  }>
  reports: Array<{ id: string; status: string; createdAt: string; debateId: string | null; challengeId: string | null; reason: string }>
  aiFeedback: string[]
  betaFeedback: Array<{ id: string; category: string; message: string | null; surface: string; screen: string; aiModelId: string | null; appVersion: string; createdAt: string }>
  teamSession: TeamDebateSession | null
  groups: Record<string, LocalGroup>
}

export type LocalGroup = {
  id: string
  ownerId: string
  name: string
  description: string
  icon: string
  accent: string
  language: Language
  rules: string
  memberLimit: number | null
  leaderboardEnabled: boolean
  members: GroupMember[]
  topics: GroupTopic[]
  invites: GroupInvite[]
  createdAt: string
  updatedAt: string
}

const defaultState = (): PersistedState => ({
  userId: makeId('anon'),
  onboarded: false,
  name: '',
  bio: '',
  profileVisibility: 'private',
  profileFieldVisibility: { avatar: 'friends', displayName: 'public', bio: 'friends', profileAccent: 'friends', argumentDna: 'friends', statistics: 'friends', socialLinks: 'friends', groupRelationship: 'shared_groups' },
  socialLinks: [],
  avatarPreset: 'orbit',
  challengeShowName: false,
  shareRealStance: false,
  interests: [],
  language: 'en',
  debateLanguage: 'en',
  intensity: 'balanced',
  preferredMode: 'sideswitch',
  preferredAiStyle: 'sharp-skeptic',
  preferredOpponentType: 'ask',
  preferredAiFamily: 'GPT',
  preferredOpponentId: 'gpt-logician',
  preferredAiModelId: null,
  aiDifficulty: 'intermediate',
  aiRoundLength: 'standard',
  aiQuality: 'balanced',
  aiResponseLength: 'standard',
  showModelDetails: false,
  theme: 'system',
  accent: 'coral',
  reducedMotion: false,
  textSize: 'comfortable',
  debate: null,
  result: null,
  history: [],
  challenges: {},
  reports: [],
  aiFeedback: [],
  betaFeedback: [],
  teamSession: null,
  groups: {},
})

function hasStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function loadState(): PersistedState {
  const fallback = defaultState()
  if (!hasStorage()) return fallback
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const legacyOnboarded = window.localStorage.getItem('sideshift-onboarded') === 'true'
      const legacyName = window.localStorage.getItem('sideshift-name') || ''
      return legacyOnboarded ? { ...fallback, onboarded: true, name: legacyName } : fallback
    }
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      ...fallback,
      ...parsed,
      userId: typeof parsed.userId === 'string' && parsed.userId ? parsed.userId : fallback.userId,
      bio: typeof parsed.bio === 'string' ? parsed.bio.slice(0, 160) : '',
      profileVisibility: ['private', 'friends', 'shared_groups', 'public'].includes(parsed.profileVisibility as string) ? parsed.profileVisibility as ProfileVisibility : fallback.profileVisibility,
      profileFieldVisibility: parsed.profileFieldVisibility && typeof parsed.profileFieldVisibility === 'object' ? { ...fallback.profileFieldVisibility, ...parsed.profileFieldVisibility } : fallback.profileFieldVisibility,
      socialLinks: Array.isArray(parsed.socialLinks) ? parsed.socialLinks.slice(0, 5) as SocialLink[] : [],
      avatarPreset: ['orbit', 'spark', 'wave', 'sun', 'leaf'].includes(parsed.avatarPreset as string) ? parsed.avatarPreset as AvatarPreset : fallback.avatarPreset,
      challengeShowName: parsed.challengeShowName === true,
      shareRealStance: parsed.shareRealStance === true,
      interests: Array.isArray(parsed.interests) ? parsed.interests.filter(item => typeof item === 'string') : [],
      debateLanguage: ['en', 'de', 'fr', 'es', 'it'].includes(parsed.debateLanguage as string) ? parsed.debateLanguage as Language : 'en',
      intensity: typeof parsed.intensity === 'string' ? parsed.intensity : fallback.intensity,
      preferredMode: ['classic', 'sideswitch', 'blindside', 'commonground'].includes(parsed.preferredMode as string) ? parsed.preferredMode as Mode : fallback.preferredMode,
      preferredAiStyle: typeof parsed.preferredAiStyle === 'string' ? parsed.preferredAiStyle : fallback.preferredAiStyle,
      preferredOpponentType: ['ask', 'ai', 'person'].includes(parsed.preferredOpponentType as string) ? parsed.preferredOpponentType as PersistedState['preferredOpponentType'] : fallback.preferredOpponentType,
      preferredAiFamily: ['Gemini', 'Claude', 'GPT', 'DeepSeek'].includes(parsed.preferredAiFamily as string) ? parsed.preferredAiFamily as PersistedState['preferredAiFamily'] : fallback.preferredAiFamily,
      preferredOpponentId: typeof parsed.preferredOpponentId === 'string' ? parsed.preferredOpponentId : fallback.preferredOpponentId,
      preferredAiModelId: typeof parsed.preferredAiModelId === 'string' ? parsed.preferredAiModelId.slice(0, 160) : null,
      aiDifficulty: ['beginner', 'intermediate', 'advanced', 'expert'].includes(parsed.aiDifficulty as string) ? parsed.aiDifficulty as PersistedState['aiDifficulty'] : fallback.aiDifficulty,
      aiRoundLength: ['quick', 'standard', 'deep'].includes(parsed.aiRoundLength as string) ? parsed.aiRoundLength as PersistedState['aiRoundLength'] : fallback.aiRoundLength,
      aiQuality: ['fast', 'balanced', 'maximum'].includes(parsed.aiQuality as string) ? parsed.aiQuality as PersistedState['aiQuality'] : fallback.aiQuality,
      aiResponseLength: ['concise', 'standard', 'detailed'].includes(parsed.aiResponseLength as string) ? parsed.aiResponseLength as PersistedState['aiResponseLength'] : fallback.aiResponseLength,
      showModelDetails: parsed.showModelDetails === true,
      theme: ['system', 'light', 'dark'].includes(parsed.theme as string) ? parsed.theme as AppearanceTheme : fallback.theme,
      accent: ['violet', 'cyan', 'amber', 'coral', 'mint', 'neutral'].includes(parsed.accent as string) ? parsed.accent as AccentTheme : fallback.accent,
      reducedMotion: parsed.reducedMotion === true,
      textSize: parsed.textSize === 'compact' ? 'compact' : 'comfortable',
      history: Array.isArray(parsed.history) ? parsed.history : [],
      language: ['en', 'de', 'fr', 'es', 'it'].includes(parsed.language as string) ? parsed.language as Language : 'en',
      debate: parsed.debate ?? null,
      result: parsed.result ?? null,
      challenges: parsed.challenges && typeof parsed.challenges === 'object' ? parsed.challenges : {},
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      aiFeedback: Array.isArray(parsed.aiFeedback) ? parsed.aiFeedback.filter(item => typeof item === 'string') : [],
      betaFeedback: Array.isArray(parsed.betaFeedback) ? parsed.betaFeedback.filter(item => item && typeof item === 'object').slice(0, 100) as PersistedState['betaFeedback'] : [],
      teamSession: parsed.teamSession && typeof parsed.teamSession === 'object' ? parsed.teamSession as TeamDebateSession : null,
      groups: parsed.groups && typeof parsed.groups === 'object' ? parsed.groups as Record<string, LocalGroup> : {},
    }
  } catch {
    return fallback
  }
}

export function saveState(state: PersistedState): void {
  if (!hasStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearState(): void {
  if (hasStorage()) window.localStorage.removeItem(STORAGE_KEY)
}

export function persistPatch(patch: Partial<PersistedState>): PersistedState {
  const next = { ...loadState(), ...patch }
  saveState(next)
  return next
}

export { STORAGE_KEY }
