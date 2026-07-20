import { describe, expect, it } from 'vitest'
import { filterProfileForViewer, validateSocialLink, type ProfileVisibilityInput } from './profileVisibility'

const base: ProfileVisibilityInput = {
  overall: 'public',
  fields: {
    avatar: 'public',
    displayName: 'public',
    bio: 'friends',
    profileAccent: 'public',
    argumentDna: 'friends',
    statistics: 'friends',
    socialLinks: 'friends',
    groupRelationship: 'shared_groups',
  },
}

describe('profile visibility rules', () => {
  it('uses the most restrictive rule across overall and field visibility', () => {
    expect(filterProfileForViewer(base, 'outsider', { displayName: 'A', bio: 'B', socialLinks: ['x'] })).toEqual({ displayName: 'A' })
    expect(filterProfileForViewer(base, 'friend', { displayName: 'A', bio: 'B', socialLinks: ['x'] })).toEqual({ displayName: 'A', bio: 'B', socialLinks: ['x'] })
  })

  it('returns no profile fields for a blocked relationship', () => {
    expect(filterProfileForViewer({ ...base, blocked: true }, 'friend', { displayName: 'A', bio: 'B' })).toEqual({})
  })
})

describe('social profile links', () => {
  it('accepts known HTTPS profile domains and normalizes tracking parameters', () => {
    expect(validateSocialLink('instagram', 'https://www.instagram.com/example/?utm_source=test')).toEqual({ provider: 'instagram', url: 'https://www.instagram.com/example' })
  })

  it('rejects unsafe protocols and mismatched known providers', () => {
    expect(validateSocialLink('github', 'javascript:alert(1)')).toBeNull()
    expect(validateSocialLink('github', 'https://example.com/user')).toBeNull()
    expect(validateSocialLink('website', 'http://example.com')).toBeNull()
  })
})
