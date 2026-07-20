export function getCorsDecision(origin, allowedOrigins) {
  if (!origin) return { allowed: true, headers: {} }
  if (!allowedOrigins.has('*') && !allowedOrigins.has(origin)) return { allowed: false, headers: {} }
  return {
    allowed: true,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, apikey, content-type, x-request-id, x-sideshift-user-id',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      vary: 'Origin',
    },
  }
}
