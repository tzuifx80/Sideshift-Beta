import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'

export type SupabaseConfig = { url: string; anonKey: string }

let browserClient: SupabaseClient | null = null
let browserClientKey = ''
let anonymousSessionPromise: Promise<Session> | null = null

export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase backend selected but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.')
  return { url, anonKey }
}

export function createSupabaseBrowserClient(config: SupabaseConfig): SupabaseClient {
  const key = `${config.url}\u0000${config.anonKey}`
  if (!browserClient || browserClientKey !== key) {
    browserClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'sideshift-supabase-session',
      },
    })
    browserClientKey = key
  }
  return browserClient
}

export async function getOrCreateAnonymousSession(client: SupabaseClient): Promise<Session> {
  const existing = await client.auth.getSession()
  if (existing.error) throw existing.error
  if (existing.data.session) return existing.data.session

  if (!anonymousSessionPromise) {
    anonymousSessionPromise = client.auth.signInAnonymously().then(result => {
      if (result.error) throw result.error
      if (!result.data.session) throw new Error('Supabase did not return an anonymous session.')
      return result.data.session
    }).finally(() => { anonymousSessionPromise = null })
  }
  return anonymousSessionPromise
}
