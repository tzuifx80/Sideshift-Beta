import type { Session, User } from '@supabase/supabase-js'

export type AuthFlowKind = 'sign-in' | 'secure-account'

export type AuthFlowClient = {
  auth: {
    signInWithOtp: (input: { email: string; options: { shouldCreateUser: boolean } }) => Promise<{ error: unknown | null }>
    updateUser: (input: { email: string }) => Promise<{ data?: { user?: User | null } | null; error: unknown | null }>
    verifyOtp: (input: { email: string; token: string; type: 'email' | 'email_change' }) => Promise<{ data?: { session?: Session | null } | null; error: unknown | null }>
  }
}

export type AuthFlowErrorCode = 'invalid_email' | 'invalid_code' | 'otp_request_failed' | 'otp_verification_failed' | 'rate_limited' | 'expired_code' | 'email_in_use' | 'session_missing'

export class AuthFlowError extends Error {
  constructor(public readonly code: AuthFlowErrorCode) {
    super(code)
    this.name = 'AuthFlowError'
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeAuthEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (!emailPattern.test(email) || email.length > 254) throw new AuthFlowError('invalid_email')
  return email
}

function normalizeOtp(value: string): string {
  const otp = value.replace(/\s/g, '')
  if (!/^\d{6}$/.test(otp)) throw new AuthFlowError('invalid_code')
  return otp
}

function errorDetails(error: unknown): { status?: number; message: string } {
  if (!error || typeof error !== 'object') return { message: '' }
  const candidate = error as { status?: unknown; message?: unknown }
  return { status: typeof candidate.status === 'number' ? candidate.status : undefined, message: typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '' }
}

function providerError(error: unknown, phase: 'request' | 'verify', kind: AuthFlowKind): AuthFlowError {
  const details = errorDetails(error)
  if (details.status === 429 || details.message.includes('rate') || details.message.includes('too many')) return new AuthFlowError('rate_limited')
  if (phase === 'verify' && (details.message.includes('expired') || details.message.includes('otp_expired'))) return new AuthFlowError('expired_code')
  if (kind === 'secure-account' && (details.message.includes('already') || details.message.includes('exists') || details.message.includes('registered'))) return new AuthFlowError('email_in_use')
  return new AuthFlowError(phase === 'request' ? 'otp_request_failed' : 'otp_verification_failed')
}

export async function requestEmailOtp(client: AuthFlowClient, rawEmail: string, kind: AuthFlowKind): Promise<string> {
  const email = normalizeAuthEmail(rawEmail)
  if (kind === 'secure-account') {
    const result = await client.auth.updateUser({ email })
    if (result.error) throw providerError(result.error, 'request', kind)
    if (!result.data?.user) throw new AuthFlowError('otp_request_failed')
    return email
  }
  const result = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  if (result.error) throw providerError(result.error, 'request', kind)
  return email
}

export async function verifyEmailOtp(client: AuthFlowClient, rawEmail: string, rawCode: string, kind: AuthFlowKind): Promise<Session> {
  const email = normalizeAuthEmail(rawEmail)
  const token = normalizeOtp(rawCode)
  const result = await client.auth.verifyOtp({ email, token, type: kind === 'secure-account' ? 'email_change' : 'email' })
  if (result.error) throw providerError(result.error, 'verify', kind)
  if (!result.data?.session) throw new AuthFlowError('session_missing')
  return result.data.session
}

export function authFlowErrorCode(error: unknown): AuthFlowErrorCode {
  if (error instanceof AuthFlowError) return error.code
  if (error instanceof Error && ['invalid_email', 'invalid_code', 'otp_request_failed', 'otp_verification_failed', 'rate_limited', 'expired_code', 'email_in_use', 'session_missing'].includes(error.message)) return error.message as AuthFlowErrorCode
  return 'otp_verification_failed'
}
