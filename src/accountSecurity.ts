export type AccountSecurityState = 'anonymous' | 'email' | 'oauth'

type AuthIdentity = { provider?: string | null }
type AuthUserLike = { is_anonymous?: boolean; email?: string | null; identities?: AuthIdentity[] | null }

export function accountSecurityState(user: AuthUserLike | null): AccountSecurityState {
  if (!user || user.is_anonymous === true) return 'anonymous'
  if ((user.identities || []).some(identity => identity.provider && identity.provider !== 'email')) return 'oauth'
  return user.email ? 'email' : 'anonymous'
}

export function shouldRequireAnonymousLogoutConfirmation(state: AccountSecurityState): boolean {
  return state === 'anonymous'
}
