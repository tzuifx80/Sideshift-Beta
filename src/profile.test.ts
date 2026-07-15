import { describe, expect, it } from 'vitest'
import { normalizePreferences, normalizeProfile, userPreferencesSchema, userProfileSchema } from './profile'

describe('private profile and preference validation', () => {
  it('normalizes a profile and enforces the bio limit', () => {
    const profile = normalizeProfile({ id: 'user-1', displayName: '  Ada  ', bio: '  Curious about trade-offs.  ', avatarPreset: 'spark', interfaceLanguage: 'de', challengeShowName: true, shareRealStance: false })
    expect(profile).toMatchObject({ displayName: 'Ada', bio: 'Curious about trade-offs.', avatarPreset: 'spark', interfaceLanguage: 'de', challengeShowName: true })
    expect(() => userProfileSchema.parse({ ...profile, bio: 'x'.repeat(161) })).toThrow()
  })

  it('validates theme and keeps share privacy off by default', () => {
    const preferences = normalizePreferences({ userId: 'user-1', topicPreferences: ['Politics and Democracy', 'Politics and Democracy'], debateLanguages: ['en'], theme: 'dark', accent: 'mint', textSize: 'compact', shareRealStance: false, onboardingCompleted: true })
    expect(preferences.topicPreferences).toEqual(['Politics and Democracy'])
    expect(preferences.shareRealStance).toBe(false)
    expect(() => userPreferencesSchema.parse({ ...preferences, theme: 'neon' })).toThrow()
  })

  it('normalizes private AI defaults without requiring legacy callers to provide them', () => {
    const preferences = normalizePreferences({ userId: 'user-1' })
    expect(preferences).toMatchObject({ preferredOpponentType: 'ask', preferredAiFamily: 'GPT', preferredAiModelId: null, aiQuality: 'balanced', aiResponseLength: 'standard', showModelDetails: false })
    expect(normalizePreferences({ ...preferences, preferredOpponentType: 'person', preferredAiFamily: 'Claude', aiQuality: 'maximum', aiResponseLength: 'concise', showModelDetails: true })).toMatchObject({ preferredOpponentType: 'person', preferredAiFamily: 'Claude', aiQuality: 'maximum', aiResponseLength: 'concise', showModelDetails: true })
  })
})
