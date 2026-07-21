export const MOBILE_NAV_DESTINATIONS = ['home', 'explore', 'friends', 'groups', 'profile'] as const

export type MobileNavDestination = typeof MOBILE_NAV_DESTINATIONS[number]

export const MOBILE_FEATURE_OWNERSHIP = {
  worldPulse: ['home', 'explore', 'debate-flow'],
  friendsLeague: ['friends'],
  groupLeague: ['groups'],
  accountControls: ['settings'],
  avatarEditing: ['profile', 'settings'],
} as const

export function isMobileNavDestination(value: string): value is MobileNavDestination {
  return (MOBILE_NAV_DESTINATIONS as readonly string[]).includes(value)
}

export function featureBelongsTo(feature: keyof typeof MOBILE_FEATURE_OWNERSHIP, surface: string): boolean {
  return (MOBILE_FEATURE_OWNERSHIP[feature] as readonly string[]).includes(surface)
}
