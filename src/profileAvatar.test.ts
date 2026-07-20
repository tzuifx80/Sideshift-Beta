import { describe, expect, it } from 'vitest'
import type { UserProfile } from './data/types'
import { avatarDisplayKey, profileWithAvatarPath } from './profileAvatar'

const profile: UserProfile = {
  id: 'user-1', displayName: 'Alex', bio: null, avatarPreset: 'orbit', interfaceLanguage: 'en',
  challengeShowName: false, shareRealStance: false, publicProfileKey: 'profile-1', handle: null,
  friendCode: null, avatarPath: null, profileAccent: 'coral', profileVisibility: 'friends',
  avatarVisibility: 'private', visibleStats: { debates: true, sideSwitches: true, constructive: true, argumentDna: false },
}

describe('profile avatar display state', () => {
  it('changes identity after upload, replacement and removal', () => {
    const uploaded = profileWithAvatarPath(profile, 'profile-1/current.webp', 1)
    const replaced = profileWithAvatarPath(uploaded, 'profile-1/current.webp', 2)
    const removed = profileWithAvatarPath(replaced, null, 3)

    expect(avatarDisplayKey(profile, 0)).toBe('preset:orbit:0')
    expect(avatarDisplayKey(uploaded, 1)).toBe('photo:profile-1/current.webp:1')
    expect(avatarDisplayKey(replaced, 2)).not.toBe(avatarDisplayKey(uploaded, 1))
    expect(avatarDisplayKey(removed, 3)).toBe('preset:orbit:3')
  })

  it('keeps cache revision out of the persisted avatar path', () => {
    const uploaded = profileWithAvatarPath(profile, 'profile-1/current.webp', 1)
    expect(uploaded.avatarPath).toBe('profile-1/current.webp')
  })
})
