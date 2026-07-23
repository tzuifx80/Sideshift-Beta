import { describe, expect, it, beforeEach, vi } from 'vitest'
import { dismissBetaWelcome, isBetaWelcomeDismissed } from './BetaWelcomeNote'
import { BETA_WELCOME_STORAGE_KEY } from '../i18n/polish'

describe('BetaWelcomeNote storage', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value) },
        removeItem: (key: string) => { storage.delete(key) },
      },
    })
  })

  it('starts visible until dismissed', () => {
    expect(isBetaWelcomeDismissed()).toBe(false)
    dismissBetaWelcome()
    expect(isBetaWelcomeDismissed()).toBe(true)
    expect(storage.get(BETA_WELCOME_STORAGE_KEY)).toBe('dismissed')
  })
})
