import { describe, expect, it } from 'vitest'
import { featureBelongsTo, isMobileNavDestination, MOBILE_FEATURE_OWNERSHIP, MOBILE_NAV_DESTINATIONS } from './mobileArchitecture'

describe('mobile information architecture contracts', () => {
  it('keeps exactly five top-level mobile destinations in the required order', () => {
    expect(MOBILE_NAV_DESTINATIONS).toEqual(['home', 'explore', 'friends', 'groups', 'profile'])
    expect(isMobileNavDestination('settings')).toBe(false)
  })

  it('keeps pulse and league surfaces owned by their intended sections', () => {
    expect(featureBelongsTo('worldPulse', 'home')).toBe(true)
    expect(featureBelongsTo('worldPulse', 'explore')).toBe(true)
    expect(featureBelongsTo('worldPulse', 'friends')).toBe(false)
    expect(featureBelongsTo('friendsLeague', 'friends')).toBe(true)
    expect(featureBelongsTo('friendsLeague', 'groups')).toBe(false)
    expect(featureBelongsTo('groupLeague', 'groups')).toBe(true)
    expect(featureBelongsTo('groupLeague', 'friends')).toBe(false)
    expect(featureBelongsTo('accountControls', 'friends')).toBe(false)
    expect(featureBelongsTo('avatarEditing', 'friends')).toBe(false)
    expect(MOBILE_FEATURE_OWNERSHIP.worldPulse).toContain('debate-flow')
  })
})
