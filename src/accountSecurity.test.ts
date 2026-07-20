import { describe, expect, it } from 'vitest'
import { accountSecurityState, shouldRequireAnonymousLogoutConfirmation } from './accountSecurity'

describe('account security status', () => {
  it('does not claim recovery for anonymous sessions', () => {
    expect(accountSecurityState({ is_anonymous: true, email: undefined, identities: [] })).toBe('anonymous')
    expect(shouldRequireAnonymousLogoutConfirmation('anonymous')).toBe(true)
  })

  it('recognizes a verified email or OAuth identity', () => {
    expect(accountSecurityState({ is_anonymous: false, email: 'user@example.com', identities: [] })).toBe('email')
    expect(accountSecurityState({ is_anonymous: false, email: undefined, identities: [{ provider: 'google' }] })).toBe('oauth')
    expect(shouldRequireAnonymousLogoutConfirmation('email')).toBe(false)
  })
})
