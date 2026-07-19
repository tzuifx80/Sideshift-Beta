import { describe, expect, it } from 'vitest'
import { applyFriendRequestTransition, generateFriendCode, normalizeHandle, resolveProfileVisibility, validateAvatarInput } from './privateSocial'

describe('private social primitives', () => {
  it('normalizes safe handles and rejects reserved or impersonating values', () => {
    expect(normalizeHandle('  @Mira_42  ')).toBe('mira_42')
    expect(() => normalizeHandle('admin')).toThrow()
    expect(() => normalizeHandle('mіra')).toThrow()
    expect(() => normalizeHandle('two words')).toThrow()
  })

  it('generates a shareable code that is not derived from the user id', () => {
    const first = generateFriendCode()
    const second = generateFriendCode()
    expect(first).toMatch(/^SS-[A-Z2-9]{10}$/)
    expect(second).toMatch(/^SS-[A-Z2-9]{10}$/)
    expect(first).not.toBe(second)
  })

  it('accepts only bounded image uploads with matching supported types', () => {
    expect(validateAvatarInput({ mime: 'image/webp', size: 400_000 })).toEqual({ ok: true })
    expect(validateAvatarInput({ mime: 'image/svg+xml', size: 10_000 }).ok).toBe(false)
    expect(validateAvatarInput({ mime: 'image/png', size: 400_000, detectedMime: 'image/jpeg' }).ok).toBe(false)
    expect(validateAvatarInput({ mime: 'image/jpeg', size: 600_000 }).ok).toBe(false)
  })

  it('resolves private profile visibility without leaking blocked users', () => {
    expect(resolveProfileVisibility('friends', { isFriend: true, isBlocked: false })).toBe(true)
    expect(resolveProfileVisibility('friends', { isFriend: true, isBlocked: true })).toBe(false)
    expect(resolveProfileVisibility('shared_groups', { isFriend: false, sharesGroup: true, isBlocked: false })).toBe(true)
    expect(resolveProfileVisibility('private', { isFriend: true, sharesGroup: true, isBlocked: false })).toBe(false)
  })

  it('resolves opposite pending requests to one accepted relationship', () => {
    expect(applyFriendRequestTransition({ status: 'pending', requesterId: 'a', addresseeId: 'b' }, { actorId: 'b', action: 'request', targetId: 'a' })).toEqual({ status: 'accepted', requesterId: 'a', addresseeId: 'b' })
    expect(() => applyFriendRequestTransition({ status: 'accepted', requesterId: 'a', addresseeId: 'b' }, { actorId: 'a', action: 'accept', targetId: 'b' })).toThrow()
  })
})
