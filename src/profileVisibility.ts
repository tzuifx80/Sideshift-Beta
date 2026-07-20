import type { ProfileVisibility, SocialProvider, SocialLink } from './data/types'

export type ProfileViewerRole = 'owner' | 'friend' | 'shared_group' | 'outsider'
export type ProfileField = 'avatar' | 'displayName' | 'bio' | 'profileAccent' | 'argumentDna' | 'statistics' | 'socialLinks' | 'groupRelationship'
export type ProfileFieldVisibility = Record<ProfileField, ProfileVisibility>

export type ProfileVisibilityInput = {
  overall: ProfileVisibility
  fields: Partial<ProfileFieldVisibility>
  blocked?: boolean
}

const visibilityRank: Record<ProfileVisibility, number> = { private: 0, friends: 1, shared_groups: 2, public: 3 }
const knownHosts: Partial<Record<SocialProvider, string[]>> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
  twitch: ['twitch.tv', 'www.twitch.tv'],
  github: ['github.com', 'www.github.com'],
  spotify: ['open.spotify.com', 'spotify.com', 'www.spotify.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
}

function fieldIsVisible(input: ProfileVisibilityInput, role: ProfileViewerRole, field: ProfileField): boolean {
  if (input.blocked || role === 'outsider' && input.overall === 'private') return false
  if (role === 'owner') return true
  const overallRank = visibilityRank[input.overall]
  const fieldRank = visibilityRank[input.fields[field] || 'private']
  if (fieldRank > overallRank) return false
  if (fieldRank === 0) return false
  const roleRank: Record<Exclude<ProfileViewerRole, 'owner'>, number> = { friend: visibilityRank.friends, shared_group: visibilityRank.shared_groups, outsider: visibilityRank.public }
  return fieldRank >= roleRank[role]
}

export function filterProfileForViewer(input: ProfileVisibilityInput, role: ProfileViewerRole, values: Partial<Record<ProfileField | 'displayName' | 'bio' | 'socialLinks', unknown>>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    const field = key as ProfileField
    if (value !== undefined && fieldIsVisible(input, role, field)) result[key] = value
  }
  return result
}

function isTrackingParameter(name: string): boolean {
  return name.toLowerCase().startsWith('utm_') || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(name.toLowerCase())
}

export function validateSocialLink(provider: SocialProvider, rawUrl: string): { provider: SocialProvider; url: string } | null {
  const value = rawUrl.trim()
  if (!value || value.length > 2048) return null
  let parsed: URL
  try { parsed = new URL(value) } catch { return null }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) return null
  const allowedHosts = knownHosts[provider]
  if (allowedHosts && !allowedHosts.includes(parsed.hostname.toLowerCase())) return null
  if (!parsed.pathname || parsed.pathname === '/') {
    if (provider !== 'website') return null
  }
  for (const name of [...parsed.searchParams.keys()]) if (isTrackingParameter(name)) parsed.searchParams.delete(name)
  parsed.hash = ''
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  return { provider, url: parsed.toString().replace(/\/$/, '') }
}

export function sanitizeSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return []
  const links: SocialLink[] = []
  for (const raw of value.slice(0, 5)) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const provider = row.provider
    const validated = typeof provider === 'string' && ['instagram', 'tiktok', 'youtube', 'twitch', 'github', 'spotify', 'x', 'website'].includes(provider)
      && typeof row.url === 'string' ? validateSocialLink(provider as SocialProvider, row.url) : null
    if (!validated) continue
    const visibility = row.visibility === 'public' || row.visibility === 'friends' || row.visibility === 'shared_groups' || row.visibility === 'private' ? row.visibility : 'private'
    const label = typeof row.label === 'string' ? row.label.trim().slice(0, 40) || null : null
    links.push({ provider: validated.provider, url: validated.url, label, visibility, order: links.length })
  }
  return links
}
