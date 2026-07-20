import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateAnonymousSession } from './supabaseClient'

describe('Supabase authentication bootstrap', () => {
  it('reuses a valid existing session without another authentication request', async () => {
    const session = { user: { id: 'user-1' }, access_token: '' }
    const signInAnonymously = vi.fn()
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session }, error: null })), signInAnonymously } } as unknown as SupabaseClient
    await expect(getOrCreateAnonymousSession(client)).resolves.toBe(session)
    expect(signInAnonymously).not.toHaveBeenCalled()
  })
})
