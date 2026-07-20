import type { AppRepository } from './data/repository'
import type { UserProfile } from './data/types'

export type ProfileAvatarSnapshot = { profile: UserProfile; repository: AppRepository; userId: string; revision: number } | null

let snapshot: ProfileAvatarSnapshot = null
const listeners = new Set<() => void>()

export function getProfileAvatarSnapshot(): ProfileAvatarSnapshot { return snapshot }
export function subscribeToProfileAvatar(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener) }
export function publishProfileAvatar(next: ProfileAvatarSnapshot): void { snapshot = next; listeners.forEach(listener => listener()) }
