import type { UserProfile } from './data/types'

export function profileWithAvatarPath(profile: UserProfile, avatarPath: string | null, avatarRevision: number): UserProfile {
  return { ...profile, avatarPath, avatarRevision }
}

export function avatarDisplayKey(profile: Pick<UserProfile, 'avatarPath' | 'avatarPreset'>, avatarRevision = 0): string {
  return profile.avatarPath ? `photo:${profile.avatarPath}:${avatarRevision}` : `preset:${profile.avatarPreset}:${avatarRevision}`
}

export function avatarInitial(profile: Pick<UserProfile, 'displayName' | 'avatarPreset'>): string {
  return profile.displayName?.trim().slice(0, 1).toUpperCase() || profile.avatarPreset.slice(0, 1).toUpperCase()
}
