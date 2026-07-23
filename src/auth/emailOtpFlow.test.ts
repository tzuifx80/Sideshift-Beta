import { describe, expect, it } from 'vitest'
import { normalizeAuthEmail } from './authFlow'

describe('EmailOtpFlow email readiness', () => {
  it('accepts valid emails for send enablement', () => {
    expect(normalizeAuthEmail('user@example.com')).toBe('user@example.com')
  })

  it('rejects invalid emails before request', () => {
    expect(() => normalizeAuthEmail('not-an-email')).toThrow()
    expect(() => normalizeAuthEmail('')).toThrow()
  })
})
