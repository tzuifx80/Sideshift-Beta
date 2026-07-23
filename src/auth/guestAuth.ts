import type { SupabaseClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { getOrCreateAnonymousSession } from '../data/supabaseClient'

export const GUEST_AUTH_DISABLED_MESSAGE = 'Guest sign-in is disabled for this SideShift environment. Enable Anonymous sign-ins in the Supabase dashboard.'
export const SUPABASE_CONFIG_MISSING_MESSAGE = 'Supabase backend selected but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.'
export const AUTH_CLIENT_UNAVAILABLE_MESSAGE = 'Authentication is not available in this build.'

export async function continueGuestSession(client: SupabaseClient, storage?: Storage | null): Promise<Session | null> {
  return getOrCreateAnonymousSession(client, {
    storage,
    allowAnonymousCreation: true,
    allowSignedOutContinuation: true,
  })
}

function providerErrorDetails(error: unknown): { code: string; message: string } {
  if (!error || typeof error !== 'object') return { code: '', message: '' }
  const candidate = error as { code?: unknown; message?: unknown }
  return {
    code: typeof candidate.code === 'string' ? candidate.code : '',
    message: typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '',
  }
}

export function guestAuthFailureMessage(error: unknown): string {
  const details = providerErrorDetails(error)
  if (details.code === 'signup_disabled' || details.message.includes('signups not allowed')) return GUEST_AUTH_DISABLED_MESSAGE
  if (details.code === 'anonymous_provider_disabled' || (details.message.includes('anonymous') && details.message.includes('disabled'))) return GUEST_AUTH_DISABLED_MESSAGE
  if (error instanceof Error && error.message === 'Guest mode could not start. Please try again.') return error.message
  if (error instanceof Error && error.message === SUPABASE_CONFIG_MISSING_MESSAGE) return error.message
  return 'Guest sign-in could not start. Please try again.'
}

export function assertAuthClientAvailable(backend: 'local' | 'supabase', client: SupabaseClient | null): asserts client is SupabaseClient {
  if (backend !== 'supabase' || !client) throw new Error(AUTH_CLIENT_UNAVAILABLE_MESSAGE)
}
