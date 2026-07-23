import { describe, expect, it, vi } from 'vitest'
import { AuthFlowError, authFlowErrorCode, normalizeAuthEmail, requestEmailOtp, verifyEmailOtp } from './authFlow'
import { authMessages } from '../i18n/auth'

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

  it('requests sign-in OTP with shouldCreateUser true for new emails', async () => {
    const client = clientFixture()

    await requestEmailOtp(client, 'new@example.com', 'sign-in')

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'new@example.com', options: { shouldCreateUser: true } })
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('uses the same OTP request path for existing emails', async () => {
    const client = clientFixture()

    await requestEmailOtp(client, 'existing@example.com', 'sign-in')

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'existing@example.com', options: { shouldCreateUser: true } })
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('verifies sign-in OTP with type email and returns the authenticated session', async () => {
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
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled()
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

  it('maps expired and invalid provider OTP responses to distinct safe categories', async () => {
    const client = clientFixture()
    client.auth.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: { message: 'otp_expired' } })
    await expect(verifyEmailOtp(client, 'person@example.com', '123456', 'sign-in')).rejects.toMatchObject({ code: 'expired_code' })

    client.auth.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Token is invalid' } })
    await expect(verifyEmailOtp(client, 'person@example.com', '123456', 'sign-in')).rejects.toMatchObject({ code: 'invalid_code' })
  })

  it('maps rate-limited OTP send responses safely', async () => {
    const client = clientFixture()
    client.auth.signInWithOtp.mockResolvedValue({ error: { message: 'rate limit exceeded', status: 429 } })

    await expect(requestEmailOtp(client, 'person@example.com', 'sign-in')).rejects.toMatchObject({ code: 'rate_limited' })
    await expect(requestEmailOtp(client, 'person@example.com', 'sign-in')).rejects.not.toThrow('rate limit exceeded')
  })

  it('maps disabled signup or OTP configuration to a safe auth config error without raw provider text', async () => {
    const client = clientFixture()
    client.auth.signInWithOtp.mockResolvedValueOnce({ error: { code: 'signup_disabled', message: 'Signups not allowed for this instance' } })
    await expect(requestEmailOtp(client, 'person@example.com', 'sign-in')).rejects.toSatisfy((error: unknown) => {
      expect(error).toMatchObject({ code: 'auth_config_disabled' })
      expect(String(error)).not.toContain('Signups not allowed')
      return true
    })

    client.auth.signInWithOtp.mockResolvedValueOnce({ error: { code: 'otp_disabled', message: 'otp is disabled' } })
    await expect(requestEmailOtp(client, 'person@example.com', 'sign-in')).rejects.toSatisfy((error: unknown) => {
      expect(error).toMatchObject({ code: 'auth_config_disabled' })
      expect(String(error)).not.toContain('otp is disabled')
      return true
    })
  })

  it('does not expose raw Supabase provider messages through authFlowErrorCode', () => {
    expect(authFlowErrorCode(new AuthFlowError('auth_config_disabled'))).toBe('auth_config_disabled')
    expect(authFlowErrorCode(new Error('raw provider secret detail'))).toBe('otp_verification_failed')
  })

  it('uses unified email flow copy in every locale', () => {
    const expected = {
      en: { signIn: 'Continue with email', bodyFragment: 'one will be created automatically' },
      de: { signIn: 'Mit E-Mail fortfahren', bodyFragment: 'wird automatisch eines erstellt' },
      fr: { signIn: 'Continuer avec l’e-mail', bodyFragment: 'sera créé automatiquement' },
      es: { signIn: 'Continuar con correo', bodyFragment: 'se creará una automáticamente' },
      it: { signIn: 'Continua con e-mail', bodyFragment: 'ne verrà creato uno automaticamente' },
    } as const

    for (const language of Object.keys(expected) as Array<keyof typeof expected>) {
      const messages = authMessages[language]
      expect(messages['auth.signIn']).toBe(expected[language].signIn)
      expect(messages['auth.signInBody']).toContain(expected[language].bodyFragment)
      expect(messages['auth.configDisabled'].trim()).not.toBe('')
    }
  })
})
