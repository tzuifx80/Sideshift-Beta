import { describe, expect, it, vi } from 'vitest'
import { AuthFlowError, normalizeAuthEmail, requestEmailOtp, verifyEmailOtp } from './authFlow'

function clientFixture() {
  return {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: { id: 'guest-1' } }, error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'guest-1' }, access_token: 'session-token' } }, error: null }),
    },
  }
}

describe('email authentication flows', () => {
  it('normalizes and validates email input without retaining credentials', () => {
    expect(normalizeAuthEmail('  Person@Example.COM ')).toBe('person@example.com')
    expect(() => normalizeAuthEmail('not-an-email')).toThrowError(new AuthFlowError('invalid_email'))
  })

  it('requests sign-in OTP without silently creating an account', async () => {
    const client = clientFixture()

    await requestEmailOtp(client, 'person@example.com', 'sign-in')

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'person@example.com', options: { shouldCreateUser: false } })
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('verifies sign-in OTP and returns the authenticated session', async () => {
    const client = clientFixture()

    const session = await verifyEmailOtp(client, 'person@example.com', '123456', 'sign-in')

    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'person@example.com', token: '123456', type: 'email' })
    expect(session.user.id).toBe('guest-1')
  })

  it('secures the active guest through email change OTP without changing identity', async () => {
    const client = clientFixture()

    await requestEmailOtp(client, 'person@example.com', 'secure-account')
    const session = await verifyEmailOtp(client, 'person@example.com', '654321', 'secure-account')

    expect(client.auth.updateUser).toHaveBeenCalledWith({ email: 'person@example.com' })
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'person@example.com', token: '654321', type: 'email_change' })
    expect(session.user.id).toBe('guest-1')
  })

  it('bounds OTP input to six digits and maps provider failures to safe categories', async () => {
    const client = clientFixture()
    client.auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'raw provider secret detail', status: 429 } })

    await expect(verifyEmailOtp(client, 'person@example.com', '12345', 'sign-in')).rejects.toMatchObject({ code: 'invalid_code' })
    await expect(verifyEmailOtp(client, 'person@example.com', '123456', 'sign-in')).rejects.toMatchObject({ code: 'rate_limited' })
    await expect(verifyEmailOtp(client, 'person@example.com', '123456', 'sign-in')).rejects.not.toThrow('raw provider secret detail')
  })
})
