export type OnboardingProgress = { step: number; name: string; selected: string[]; goal: string }

export function onboardingStorageKey(userId: string) {
  return `sideshift-onboarding-progress:${userId}`
}

export function parseOnboardingProgress(raw: string | null): OnboardingProgress {
  try {
    const value = JSON.parse(raw || '{}') as Partial<OnboardingProgress>
    return {
      step: Math.max(0, Math.min(3, Number(value.step) || 0)),
      name: typeof value.name === 'string' ? value.name.slice(0, 24) : '',
      selected: Array.isArray(value.selected) ? value.selected.filter(item => typeof item === 'string').slice(0, 6) : [],
      goal: typeof value.goal === 'string' ? value.goal : 'reasoning',
    }
  } catch {
    return { step: 0, name: '', selected: [], goal: 'reasoning' }
  }
}

export function serializeOnboardingProgress(progress: OnboardingProgress) {
  return JSON.stringify(progress)
}
