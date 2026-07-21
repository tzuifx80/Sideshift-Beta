import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateAnonymousSession } from './supabaseClient'

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

describe('Supabase authentication bootstrap', () => {
  it('reuses a valid existing session without another authentication request', async () => {
    const session = { user: { id: 'user-1' }, access_token: '' }
    const signInAnonymously = vi.fn()
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session }, error: null })), signInAnonymously } } as unknown as SupabaseClient
    await expect(getOrCreateAnonymousSession(client)).resolves.toBe(session)
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('does not create a guest merely because startup has no session', async () => {
    const signInAnonymously = vi.fn()
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })), signInAnonymously } } as unknown as SupabaseClient

    await expect(getOrCreateAnonymousSession(client, { storage: storageFixture({}) })).resolves.toBeNull()
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('reproduces the physical logout failure when restart sees a durable signed-out marker', async () => {
    const replacementSession = { user: { id: 'replacement-user' }, access_token: 'replacement-token' }
    const signInAnonymously = vi.fn(async () => ({ data: { session: replacementSession }, error: null }))
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })), signInAnonymously } } as unknown as SupabaseClient
    const storage = storageFixture({ 'sideshift-signed-out-v1': '1' })
    const bootstrap = getOrCreateAnonymousSession as unknown as (client: SupabaseClient, options: { storage: Storage }) => Promise<unknown>

    await expect(bootstrap(client, { storage })).resolves.toBeNull()
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('creates a new anonymous session only after deliberate marker clearance', async () => {
    const replacementSession = { user: { id: 'new-guest' }, access_token: 'new-token' }
    const signInAnonymously = vi.fn(async () => ({ data: { session: replacementSession }, error: null }))
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })), signInAnonymously } } as unknown as SupabaseClient
    const storage = storageFixture({ 'sideshift-signed-out-v1': '1' })
    const bootstrap = getOrCreateAnonymousSession as unknown as (client: SupabaseClient, options: { storage: Storage; allowAnonymousCreation?: boolean }) => Promise<unknown>

    storage.removeItem('sideshift-signed-out-v1')
    await expect(bootstrap(client, { storage, allowAnonymousCreation: true })).resolves.toBe(replacementSession)
    expect(signInAnonymously).toHaveBeenCalledOnce()
  })

  it('does not return a newly created session when logout is requested during bootstrap', async () => {
    const storage = storageFixture({})
    const replacementSession = { user: { id: 'late-guest' }, access_token: 'late-token' }
    const signInAnonymously = vi.fn(async () => {
      storage.setItem('sideshift-signed-out-v1', '1')
      return { data: { session: replacementSession }, error: null }
    })
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })), signInAnonymously } } as unknown as SupabaseClient

    await expect(getOrCreateAnonymousSession(client, { storage, allowAnonymousCreation: true })).resolves.toBeNull()
  })
})
