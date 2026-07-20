const PRIVATE_KEYS = new Set([
  'sideshift-state-v2',
  'sideshift-ai-setup-v1',
  'sideshift-supabase-session',
])

const PRIVATE_PREFIXES = [
  'sideshift-draft-v1:',
  'sideshift-onboarding-progress:',
]

export function clearPrivateClientState(storage?: Storage | null): void {
  const target = storage || (typeof window !== 'undefined' ? window.localStorage : null)
  if (!target) return
  try {
    const keys: string[] = []
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index)
      if (key && (PRIVATE_KEYS.has(key) || PRIVATE_PREFIXES.some(prefix => key.startsWith(prefix)))) keys.push(key)
    }
    for (const key of keys) target.removeItem(key)
  } catch {
    // Logout must still complete when browser storage is unavailable or revoked.
  }
}
