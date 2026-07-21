import { describe, expect, it, vi } from 'vitest'
import * as logout from './logout'
import { acceptsAnonymousLogoutConfirmation, clearPrivateClientState, shouldIgnoreAuthStateChange, signOutAndClear } from './logout'

function storageFixture(values: Record<string, string>): Storage {
  const map = new Map(Object.entries(values))
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: key => map.get(key) || null,
    key: index => Array.from(map.keys())[index] || null,
    removeItem: key => { map.delete(key) },
    setItem: (key, value) => { map.set(key, value) },
    get values() { return map },
  } as Storage & { values: Map<string, string> }
}

describe('private logout cleanup', () => {
  it('persists a non-sensitive signed-out marker until deliberate guest continuation', () => {
    const storage = storageFixture({})
    const mark = (logout as typeof logout & { markSignedOutPreference: (storage: Storage) => void }).markSignedOutPreference
    const has = (logout as typeof logout & { hasSignedOutPreference: (storage: Storage) => boolean }).hasSignedOutPreference
    const clear = (logout as typeof logout & { clearSignedOutPreference: (storage: Storage) => void }).clearSignedOutPreference

    mark(storage)
    expect(has(storage)).toBe(true)
    clear(storage)
    expect(has(storage)).toBe(false)
  })

  it('requires the exact anonymous destructive confirmation', () => {
    expect(acceptsAnonymousLogoutConfirmation('SIGN OUT', 'SIGN OUT')).toBe(true)
    expect(acceptsAnonymousLogoutConfirmation(' sign out ', 'SIGN OUT')).toBe(false)
    expect(acceptsAnonymousLogoutConfirmation(null, 'SIGN OUT')).toBe(false)
  })

  it('ignores late auth callbacks during sign-out and while signed out', () => {
    expect(shouldIgnoreAuthStateChange(true, false)).toBe(true)
    expect(shouldIgnoreAuthStateChange(false, true)).toBe(true)
    expect(shouldIgnoreAuthStateChange(false, false)).toBe(false)
  })

  it('clears private state and drafts while retaining language and appearance preferences', () => {
    const storage = storageFixture({
      'sideshift-state-v2': '{}',
      'sideshift-draft-v1:ai:debate-1': 'private argument',
      'sideshift-onboarding-progress:user-1': '{}',
      'sideshift-ai-setup-v1': '{}',
      'sideshift-supabase-session': '{}',
      'sideshift-locale-v1': 'de',
      'sideshift-install-dismissed-v1': '1',
    }) as Storage & { values: Map<string, string> }

    clearPrivateClientState(storage)

    expect(Array.from(storage.values.keys()).sort()).toEqual(['sideshift-install-dismissed-v1', 'sideshift-locale-v1'])
  })

  it('signs out locally before clearing private state', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const clearState = vi.fn()
    const storage = storageFixture({})
    const signOutAndClearWithStorage = signOutAndClear as unknown as (client: unknown, clearState: () => void, storage: Storage) => Promise<void>

    await signOutAndClearWithStorage({ auth: { signOut } }, clearState, storage)

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(clearState).toHaveBeenCalledOnce()
    expect(storage.getItem('sideshift-signed-out-v1')).toBe('1')
  })

  it('preserves local state when Supabase sign-out fails', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error('network') })
    const clearState = vi.fn()
    const storage = storageFixture({})
    const signOutAndClearWithStorage = signOutAndClear as unknown as (client: unknown, clearState: () => void, storage: Storage) => Promise<void>

    await expect(signOutAndClearWithStorage({ auth: { signOut } }, clearState, storage)).rejects.toThrow('network')
    expect(clearState).not.toHaveBeenCalled()
    expect(storage.getItem('sideshift-signed-out-v1')).toBeNull()
  })
})
