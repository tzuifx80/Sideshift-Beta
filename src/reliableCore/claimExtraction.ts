const HTML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeClaimFragment(value: string): string {
  return value.replace(/[&<>"']/g, char => HTML_ESCAPE[char] || char)
}

export function extractClaimFragment(argument: string, maxLength = 72): string | null {
  const trimmed = argument.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 8) return null
  const sentence = trimmed.split(/[.!?]/).map(part => part.trim()).find(part => part.length >= 8)
  const source = sentence || trimmed
  const clipped = source.length > maxLength ? `${source.slice(0, maxLength - 1).trim()}…` : source
  const safe = escapeClaimFragment(clipped)
  if (!safe || /<script|javascript:/i.test(safe)) return null
  return safe
}
