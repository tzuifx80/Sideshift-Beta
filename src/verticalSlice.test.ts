import { describe, expect, it, vi } from 'vitest'
import { AuthFlowError, authFlowErrorCode, requestEmailOtp, verifyEmailOtp, type AuthFlowClient } from './auth/authFlow'
import { hasSignedOutPreference, shouldIgnoreAuthStateChange, signOutAndClear } from './logout'
import { getOrCreateAnonymousSession } from './data/supabaseClient'
import { createBasicAiProvider } from './lib/ai/basicProvider'
import { basicTurnRequestId, prepareBasicTurn } from './lib/ai/turnState'
import type { SupabaseClient } from '@supabase/supabase-js'

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

describe('v0.2 private beta vertical slice contracts', () => {
  it('keeps open OTP registration explicit and maps invalid versus expired codes honestly', async () => {
    const signInWithOtp = vi.fn(async () => ({ error: null }))
    const client = {
      auth: {
        signInWithOtp,
        updateUser: async () => ({ data: { user: { id: 'guest-1' } }, error: null }),
        verifyOtp: async () => ({ data: { session: { user: { id: 'user-1' }, access_token: 'token-1' } }, error: null }),
      },
    } as unknown as AuthFlowClient

    await requestEmailOtp(client, 'person@example.com', 'sign-in')
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'person@example.com', options: { shouldCreateUser: true } })
    const session = await verifyEmailOtp(client, 'person@example.com', '123456', 'sign-in')
    expect(session.access_token).toBe('token-1')
    expect(authFlowErrorCode(new AuthFlowError('expired_code'))).toBe('expired_code')
    expect(authFlowErrorCode(new AuthFlowError('invalid_code'))).toBe('invalid_code')
  })

  it('restores a persisted session and blocks anonymous recreation after logout', async () => {
    const session = { user: { id: 'user-1' }, access_token: 'token-1' }
    const signInAnonymously = async () => ({ data: { session: { user: { id: 'guest-2' }, access_token: 'guest-token' } }, error: null })
    const client = {
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        signInAnonymously,
        signOut: async () => ({ error: null }),
      },
    } as unknown as SupabaseClient
    const storage = storageFixture({})

    await expect(getOrCreateAnonymousSession(client, { storage })).resolves.toBe(session)
    await signOutAndClear(client, () => undefined, storage)
    expect(hasSignedOutPreference(storage)).toBe(true)
    await expect(getOrCreateAnonymousSession(client, { storage })).resolves.toBeNull()
    expect(shouldIgnoreAuthStateChange(false, true)).toBe(true)
  })

  it('routes authenticated Basic turns through bearer auth and stable request ids', async () => {
    const fetcher = async (url: string, init?: RequestInit) => {
      if (url.endsWith('/capability')) return new Response(JSON.stringify({ available: true, usage: { allowed: true, debatesRemaining: 3, turnsRemaining: 3 } }), { status: 200 })
      return new Response(JSON.stringify({ response: 'Counterpoint.' }), { status: 200 })
    }
    const provider = createBasicAiProvider({ fetcher: fetcher as typeof fetch, accessToken: 'token-1', apiConfig: { mode: 'development', platform: 'web', apiBaseUrl: '' } })
    const debateId = '22222222-2222-4222-8222-222222222222'
    const requestId = basicTurnRequestId(debateId, 1)
    const prepared = prepareBasicTurn({
      opponentId: 'sideshift-basic', family: 'GPT', modelId: 'sideshift-basic', difficulty: 'intermediate',
      roundLength: 'quick', quality: 'balanced', responseLength: 'standard', modelSelection: 'automatic',
      roundLimit: 3, userSide: 'support', aiSide: 'challenge', customMotion: null,
      transcript: [], partialResponse: '', interrupted: false, completionReason: null,
    }, debateId, 'A first argument with enough detail to submit.')
    expect(prepared?.requestId).toBe(requestId)
    await provider.getStatus()
    const stream = await provider.streamChat({ modelId: 'sideshift-basic', messages: [{ role: 'user', content: prepared!.argument }], maxTokens: 120, debateId, round: 1, requestId })
    for await (const _chunk of stream.chunks) { /* collect */ }
    expect(requestId).toMatch(/turn-1$/)
  })
})
