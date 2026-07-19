import { describe, expect, it } from 'vitest'
import { onboardingStorageKey, parseOnboardingProgress, serializeOnboardingProgress } from './onboardingProgress'

describe('onboarding progress', () => {
  it('is scoped to the authenticated user and resumes bounded progress', () => {
    const progress = parseOnboardingProgress(JSON.stringify({ step: 9, name: 'A'.repeat(40), selected: ['AI', 4, 'Sport'], goal: 'fun' }))
    expect(onboardingStorageKey('user-1')).toBe('sideshift-onboarding-progress:user-1')
    expect(progress).toMatchObject({ step: 3, name: 'A'.repeat(24), selected: ['AI', 'Sport'], goal: 'fun' })
    expect(parseOnboardingProgress(serializeOnboardingProgress(progress))).toEqual(progress)
  })
})
