export const HANDLE_MIN_LENGTH = 3
export const HANDLE_MAX_LENGTH = 24
export const AVATAR_MAX_BYTES = 450_000
export const RESERVED_HANDLES = new Set(['admin', 'administrator', 'moderator', 'support', 'sideshift', 'system', 'official', 'staff', 'help'])

const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeHandle(input: string): string {
  const value = input.normalize('NFKC').trim().replace(/^@/, '').toLowerCase()
  if (value.length < HANDLE_MIN_LENGTH || value.length > HANDLE_MAX_LENGTH || !/^[a-z0-9_]+$/.test(value) || RESERVED_HANDLES.has(value)) throw new Error('Choose a different handle.')
  return value
}

export function generateFriendCode(): string {
  const values = new Uint32Array(10)
  globalThis.crypto.getRandomValues(values)
  return `SS-${Array.from(values, value => FRIEND_CODE_ALPHABET[value % FRIEND_CODE_ALPHABET.length]).join('')}`
}

export type AvatarInput = { mime: string; size: number; detectedMime?: string }

export function validateAvatarInput(input: AvatarInput): { ok: true } | { ok: false; reason: 'type' | 'size' } {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowed.has(input.mime) || (input.detectedMime !== undefined && input.detectedMime !== input.mime)) return { ok: false, reason: 'type' }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > AVATAR_MAX_BYTES) return { ok: false, reason: 'size' }
  return { ok: true }
}

export type ProfileVisibility = 'friends' | 'shared_groups' | 'private'

export function resolveProfileVisibility(visibility: ProfileVisibility, relationship: { isFriend: boolean; sharesGroup?: boolean; isBlocked: boolean }): boolean {
  if (relationship.isBlocked) return false
  if (visibility === 'private') return false
  return visibility === 'friends' ? relationship.isFriend : relationship.isFriend || relationship.sharesGroup === true
}

export type FriendRelationship = { status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'removed'; requesterId: string; addresseeId: string }
export type FriendRelationshipAction = { actorId: string; targetId: string; action: 'request' | 'accept' | 'decline' | 'cancel' | 'remove' }

export function applyFriendRequestTransition(current: FriendRelationship | null, action: FriendRelationshipAction): FriendRelationship {
  if (action.actorId === action.targetId) throw new Error('You cannot connect with yourself.')
  if (action.action === 'request') {
    if (!current) return { status: 'pending', requesterId: action.actorId, addresseeId: action.targetId }
    if (current.status === 'pending' && current.requesterId === action.targetId && current.addresseeId === action.actorId) return { ...current, status: 'accepted' }
    if (current.status === 'accepted') throw new Error('You are already connected.')
    throw new Error('This connection is unavailable.')
  }
  if (!current || ![current.requesterId, current.addresseeId].includes(action.actorId) || ![current.requesterId, current.addresseeId].includes(action.targetId)) throw new Error('This connection is unavailable.')
  if (action.action === 'accept' && current.status === 'pending' && current.addresseeId === action.actorId) return { ...current, status: 'accepted' }
  if (action.action === 'decline' && current.status === 'pending' && current.addresseeId === action.actorId) return { ...current, status: 'declined' }
  if (action.action === 'cancel' && current.status === 'pending' && current.requesterId === action.actorId) return { ...current, status: 'cancelled' }
  if (action.action === 'remove' && current.status === 'accepted') return { ...current, status: 'removed' }
  throw new Error('This connection action is unavailable.')
}
