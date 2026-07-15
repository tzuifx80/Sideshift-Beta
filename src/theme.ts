import type { UserPreferences } from './data/types'

export function applyTheme(preferences: Pick<UserPreferences, 'theme' | 'accent' | 'reducedMotion' | 'textSize'>): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = preferences.theme
  root.dataset.accent = preferences.accent
  root.dataset.textSize = preferences.textSize
  root.classList.toggle('reduced-motion', preferences.reducedMotion)
}
