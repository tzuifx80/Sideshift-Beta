import { describe, expect, it } from 'vitest'
import { getTake } from '../domain'
import { hashChallengeToken } from './challengeToken'
import { getPreferenceStructureDiagnostics, mapChallengeRow, mapResultRow, mapSupabaseError, parseSupabasePreferences } from './supabaseRepository'

const preferenceUserId = '9f0d9c5f-2f2d-40e9-8ad7-6fd0cf6bb8e1'
const currentPreferenceRow = {
  user_id: preferenceUserId,
  topic_preferences: ['Politics and Democracy', 'AI and Technology'],
  debate_languages: ['de'],
  intensity: 'balanced',
  preferred_mode: 'classic',
  preferred_ai_style: 'curious-coach',
  preferred_opponent_type: 'person',
  preferred_ai_family: 'Claude',
  preferred_opponent_id: 'claude-coach',
  preferred_ai_model_id: 'claude-sonnet',
  ai_difficulty: 'advanced',
  ai_round_length: 'deep',
  ai_quality: 'maximum',
  ai_response_length: 'detailed',
  show_model_details: true,
  theme: 'dark',
  accent: 'mint',
  reduced_motion: true,
  text_size: 'compact',
  share_real_stance: true,
  onboarding_completed: true,
  onboarding_stage: 3,
  onboarding_goal: 'perspectives',
  onboarding_dismissed: false,
}

describe('Supabase repository boundaries', () => {
  it('maps a stored result JSON row back to a domain result', () => {
    const take = getTake('society-media-age')
    const payload = { id: 'f5d9a2f3-9c6f-47a0-bb1b-9a1d2c8f9e10', debateId: '9f0d9c5f-2f2d-40e9-8ad7-6fd0cf6bb8e1', score: 72, movement: 1, understanding: 'yes', mode: 'sideswitch', take, assignedSide: take.opposeLabel, transcript: [{ role: 'user', round: 1, content: 'A sufficiently long opening argument.' }], scores: [{ label: 'Clarity', score: 15, explanation: 'Clear.' }], coaching: 'Keep your claim specific.', completedAt: new Date().toISOString() }
    expect(mapResultRow({ id: payload.id, argument_dna: payload })).toMatchObject({ id: payload.id, debateId: payload.debateId, score: 72, take: { id: take.id } })
  })

  it('maps challenge RPC data without exposing creator identity', () => {
    const mapped = mapChallengeRow({ id: 'challenge-1', token: 'raw-token', expiresAt: new Date(Date.now() + 60_000).toISOString(), takeId: 'society-media-age', argument: 'A valid challenge argument with a trade-off.', mode: 'classic', creatorSide: 'Support the statement', status: 'open', response: null, result: null })
    expect(mapped).toMatchObject({ token: 'raw-token', takeId: 'society-media-age', status: 'open' })
    expect(mapped).not.toHaveProperty('creatorId')
  })

  it('accepts token-redacted challenge history rows', () => {
    expect(mapChallengeRow({ id: 'challenge-2', token: '', url: '', expiresAt: new Date(Date.now() + 60_000).toISOString(), takeId: 'society-media-age', argument: 'A valid challenge argument with a trade-off.', mode: 'classic', creatorSide: 'Support the statement', status: 'completed', response: 'A valid counterpoint.', result: { total: 64 } })).toMatchObject({ token: '', status: 'completed', response: 'A valid counterpoint.' })
  })

  it('maps database errors to explicit UI-safe repository errors', () => {
    expect(mapSupabaseError('loading data', { code: '42501', message: 'private detail' })).toMatchObject({ name: 'RepositoryError', code: 'forbidden', message: 'You do not have permission to access this data.' })
    expect(mapSupabaseError('saving data', { code: '23505' }).code).toBe('conflict')
  })

  it('hashes challenge tokens deterministically as lowercase SHA-256 hex', async () => {
    const first = await hashChallengeToken('token-for-test')
    const second = await hashChallengeToken('token-for-test')
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hydrates a fully current preference row without losing server choices', () => {
    expect(parseSupabasePreferences(currentPreferenceRow, preferenceUserId)).toMatchObject({ userId: preferenceUserId, topicPreferences: currentPreferenceRow.topic_preferences, debateLanguages: ['de'], preferredMode: 'classic', preferredOpponentType: 'person', preferredAiFamily: 'Claude', theme: 'dark', accent: 'mint', onboardingCompleted: true, onboardingGoal: 'perspectives' })
  })

  it('merges pre-0016 and nullable onboarding rows with safe defaults', () => {
    const legacy = { user_id: preferenceUserId, topic_preferences: ['Football'], debate_languages: ['en'], intensity: null, onboarding_completed: false, onboarding_goal: null }
    expect(parseSupabasePreferences(legacy, preferenceUserId)).toMatchObject({ topicPreferences: ['Football'], debateLanguages: ['en'], preferredMode: 'sideswitch', preferredOpponentId: 'gpt-logician', onboardingStage: 0, onboardingGoal: 'reasoning', onboardingDismissed: false })
  })

  it('accepts legacy JSON strings and camel-case response aliases while tolerating extra fields', () => {
    const legacy = { userId: preferenceUserId, topicPreferences: '["School and Education"]', debateLanguages: '["fr"]', onboardingCompleted: true, onboardingStage: 2, onboardingGoal: 'school', server_only_field: { ignored: true } }
    expect(parseSupabasePreferences(legacy, preferenceUserId)).toMatchObject({ topicPreferences: ['School and Education'], debateLanguages: ['fr'], onboardingCompleted: true, onboardingStage: 2, onboardingGoal: 'school' })
  })

  it('keeps valid server hydration authoritative over a local fallback', () => {
    const localFallback = { ...parseSupabasePreferences({ ...currentPreferenceRow, theme: 'light', topic_preferences: ['Local topic'], debate_languages: ['en'] }, preferenceUserId) }
    const server = parseSupabasePreferences(currentPreferenceRow, preferenceUserId)
    expect(server.theme).toBe('dark')
    expect(server.topicPreferences).toEqual(['Politics and Democracy', 'AI and Technology'])
    expect(localFallback.theme).toBe('light')
  })

  it('rejects invalid primitive/object types and reports only safe structure', () => {
    expect(() => parseSupabasePreferences({ ...currentPreferenceRow, topic_preferences: { private: 'content' } }, preferenceUserId)).toThrow('private preferences could not be loaded')
    expect(() => parseSupabasePreferences({ ...currentPreferenceRow, onboarding_stage: { value: 2 } }, preferenceUserId)).toThrow('private preferences could not be loaded')
    const diagnostics = getPreferenceStructureDiagnostics({ user_id: preferenceUserId, onboarding_goal: null, topic_preferences: [] }, [['onboarding_goal']])
    expect(diagnostics.fieldTypes).toMatchObject({ user_id: 'string', onboarding_goal: 'null', topic_preferences: 'array' })
    expect(diagnostics.nullFields).toContain('onboarding_goal')
    expect(diagnostics.issuePaths).toEqual([['onboarding_goal']])
    expect(JSON.stringify(diagnostics)).not.toContain(preferenceUserId)
  })
})
