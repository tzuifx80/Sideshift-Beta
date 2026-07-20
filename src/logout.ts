const PRIVATE_KEYS = new Set([
  'sideshift-state-v2',
  'sideshift-ai-setup-v1',
  'sideshift-supabase-session',
])

const PRIVATE_PREFIXES = [
  'sideshift-draft-v1:',
  'sideshift-onboarding-progress:',
]

type LogoutClient = { auth: { signOut: (options: { scope: 'local' }) => Promise<{ error?: unknown | null }> } }

export function logoutDiagnostic(event: string): void {
  if (import.meta.env.DEV) console.debug(`[SideShift logout] ${event}`)
}

export function acceptsAnonymousLogoutConfirmation(value: string | null, expected: string): boolean {
  return value === expected
}

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

export async function signOutAndClear(client: LogoutClient, clearState: () => void = clearPrivateClientState): Promise<void> {
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) throw error
  clearState()
}
