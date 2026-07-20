import { describe, expect, it } from 'vitest'
import { onboardingStepOrder, parseOnboardingProgress } from './lib/onboardingProgress'
import { supportedLanguages, translate } from './i18n'

describe('mobile onboarding flow', () => {
  it('uses the phone-first story order', () => {
    expect(onboardingStepOrder).toEqual(['welcome', 'debate-choice', 'sideswitch', 'personalize'])
  })

  it('resumes a saved stage without treating completion as a new onboarding run', () => {
    expect(parseOnboardingProgress(JSON.stringify({ step: 2, name: 'Alex', selected: ['Football'], goal: 'fun' }))).toMatchObject({ step: 2, name: 'Alex', goal: 'fun' })
    expect(parseOnboardingProgress(JSON.stringify({ step: 9 }))).toMatchObject({ step: 3 })
  })

  it('has localized copy for every introduction language', () => {
    for (const language of supportedLanguages) {
      expect(translate(language, 'onboarding.welcomeTitle')).not.toBe('onboarding.welcomeTitle')
      expect(translate(language, 'onboarding.chooseModeTitle')).not.toBe('onboarding.chooseModeTitle')
      expect(translate(language, 'onboarding.switchTitle')).not.toBe('onboarding.switchTitle')
      expect(translate(language, 'onboarding.personalizeTitle')).not.toBe('onboarding.personalizeTitle')
    }
  })
})
