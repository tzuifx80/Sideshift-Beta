import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AUTH_CLIENT_UNAVAILABLE_MESSAGE, assertAuthClientAvailable, continueGuestSession, guestAuthFailureMessage } from './guestAuth'
import { getOrCreateAnonymousSession } from '../data/supabaseClient'

vi.mock('../data/supabaseClient', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/supabaseClient')>()
  return { ...actual, getOrCreateAnonymousSession: vi.fn(actual.getOrCreateAnonymousSession) }
})

function storageFixture(values: Record<string, string>): Storage {
  const map = new Map(Object.entries(values))
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: key => map.get(key) || null,
    key: index => Array.from(map.keys())[index] || null,
    removeItem: key => { map.delete(key) },
    setItem: (key, value) => { map.set(key, value) },
  } as Storage
}

describe('guest authentication helpers', () => {
  it('creates an anonymous session for explicit guest continuation', async () => {
    const session = { user: { id: 'guest-1' }, access_token: 'guest-token' }
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        signInAnonymously: vi.fn(async () => ({ data: { session }, error: null })),
      },
    } as unknown as SupabaseClient

    await expect(continueGuestSession(client, storageFixture({ 'sideshift-signed-out-v1': '1' }))).resolves.toBe(session)
    expect(getOrCreateAnonymousSession).toHaveBeenCalledWith(client, {
      storage: expect.any(Object),
      allowAnonymousCreation: true,
      allowSignedOutContinuation: true,
    })
  })

  it('does not let a signed-out marker block explicit guest continuation', async () => {
    const session = { user: { id: 'guest-2' }, access_token: 'guest-token' }
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        signInAnonymously: vi.fn(async () => ({ data: { session }, error: null })),
      },
    } as unknown as SupabaseClient

    await expect(continueGuestSession(client, storageFixture({ 'sideshift-signed-out-v1': '1' }))).resolves.toBe(session)
  })

  it('maps disabled anonymous sign-in to a safe operator-facing message', () => {
    expect(guestAuthFailureMessage({ code: 'signup_disabled', message: 'Signups not allowed for this instance' })).toContain('Anonymous sign-ins')
    expect(guestAuthFailureMessage({ code: 'anonymous_provider_disabled', message: 'Anonymous sign-ins are disabled' })).toContain('Anonymous sign-ins')
  })

  it('requires a Supabase client before secure-account or sign-in OTP flows run', () => {
    expect(() => assertAuthClientAvailable('local', {} as SupabaseClient)).toThrow(AUTH_CLIENT_UNAVAILABLE_MESSAGE)
    expect(() => assertAuthClientAvailable('supabase', null)).toThrow(AUTH_CLIENT_UNAVAILABLE_MESSAGE)
    expect(() => assertAuthClientAvailable('supabase', {} as SupabaseClient)).not.toThrow()
  })
})
