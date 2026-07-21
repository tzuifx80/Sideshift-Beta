export type OnboardingProgress = { step: number; name: string; selected: string[]; goal: string }

export const onboardingStepOrder = ['welcome', 'sideswitch', 'personalize'] as const

export function onboardingStorageKey(userId: string) {
  return `sideshift-onboarding-progress:${userId}`
}

export function parseOnboardingProgress(raw: string | null): OnboardingProgress {
  try {
    const value = JSON.parse(raw || '{}') as Partial<OnboardingProgress>
    const legacyStep = Math.max(0, Math.min(3, Number(value.step) || 0))
    const currentStep = (value as Partial<OnboardingProgress> & { version?: number }).version === 2 ? Math.min(2, legacyStep) : legacyStep >= 2 ? legacyStep - 1 : legacyStep
    return {
      // The removed debate-choice stage occupied step 1 in older clients.
      // Map the remaining SideSwitch and personalization stages down one slot.
      step: currentStep,
      name: typeof value.name === 'string' ? value.name.slice(0, 24) : '',
      selected: Array.isArray(value.selected) ? value.selected.filter(item => typeof item === 'string').slice(0, 6) : [],
      goal: typeof value.goal === 'string' ? value.goal : 'reasoning',
    }
  } catch {
    return { step: 0, name: '', selected: [], goal: 'reasoning' }
  }
}

export function serializeOnboardingProgress(progress: OnboardingProgress) {
  return JSON.stringify({ ...progress, version: 2 })
}
