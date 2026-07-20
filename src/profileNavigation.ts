export type ProfileNavigationTarget = {
  kind: 'human' | 'ai'
  profileKey?: string | null
}

export function humanProfileKey(target: ProfileNavigationTarget): string | null {
  if (target.kind !== 'human') return null
  const profileKey = target.profileKey?.trim()
  return profileKey || null
}

export function restoreProfileOrigin<T>(origin: T): T {
  return origin
}
