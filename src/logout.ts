const PRIVATE_KEYS = new Set([
  'sideshift-state-v2',
  'sideshift-ai-setup-v1',
  'sideshift-supabase-session',
])

const PRIVATE_PREFIXES = [
  'sideshift-draft-v1:',
  'sideshift-onboarding-progress:',
]

export const SIGNED_OUT_STORAGE_KEY = 'sideshift-signed-out-v1'
const SIGNED_OUT_STORAGE_VALUE = '1'

type LogoutClient = { auth: { signOut: (options: { scope: 'local' }) => Promise<{ error?: unknown | null }> } }

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage
  return typeof window !== 'undefined' ? window.localStorage : null
}

export function hasSignedOutPreference(storage?: Storage | null): boolean {
  const target = resolveStorage(storage)
  if (!target) return false
  try { return target.getItem(SIGNED_OUT_STORAGE_KEY) === SIGNED_OUT_STORAGE_VALUE } catch { return false }
}

export function markSignedOutPreference(storage?: Storage | null): void {
  const target = resolveStorage(storage)
  if (!target) return
  target.setItem(SIGNED_OUT_STORAGE_KEY, SIGNED_OUT_STORAGE_VALUE)
  if (target.getItem(SIGNED_OUT_STORAGE_KEY) !== SIGNED_OUT_STORAGE_VALUE) throw new Error('Signed-out state could not be saved.')
}

export function clearSignedOutPreference(storage?: Storage | null): void {
  const target = resolveStorage(storage)
  if (!target) return
  target.removeItem(SIGNED_OUT_STORAGE_KEY)
  if (target.getItem(SIGNED_OUT_STORAGE_KEY) !== null) throw new Error('Signed-out state could not be cleared.')
}

export function shouldIgnoreAuthStateChange(signingOut: boolean, signedOut: boolean): boolean {
  return signingOut || signedOut
}

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

export async function signOutAndClear(client: LogoutClient, clearState: () => void = clearPrivateClientState, storage?: Storage | null): Promise<void> {
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) throw error
  markSignedOutPreference(storage)
  clearState()
}
