export type ApiPlatform = 'web' | 'android' | 'native'

export type ApiConfigInput = {
  mode?: string
  platform?: ApiPlatform
  apiBaseUrl?: string
  androidTarget?: string
}

export class ApiConfigurationError extends Error {
  readonly code = 'configuration_missing' as const

  constructor(message: string) {
    super(message)
    this.name = 'ApiConfigurationError'
  }
}

const emulatorBaseUrl = 'http://10.0.2.2:8787'

function trimBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true
  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false
  return octets[0] === 10 || octets[0] === 127 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168)
}

function validateProductionBaseUrl(value: string): string {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new ApiConfigurationError('Production SideShift API URL must be a public HTTPS URL.') }
  if (parsed.protocol !== 'https:') throw new ApiConfigurationError('Production SideShift API URL must use HTTPS.')
  if (isPrivateOrLoopbackHost(parsed.hostname)) throw new ApiConfigurationError('Production SideShift API URL cannot use localhost or a private LAN address.')
  return trimBaseUrl(parsed.toString())
}

export function resolveApiBaseUrl(input: ApiConfigInput = {}): string {
  const mode = input.mode || 'development'
  const platform = input.platform || 'web'
  const configured = input.apiBaseUrl ? trimBaseUrl(input.apiBaseUrl) : ''

  if (mode === 'production') {
    if (!configured) throw new ApiConfigurationError('Production SideShift API URL is missing. Set VITE_API_BASE_URL to an HTTPS API origin.')
    return validateProductionBaseUrl(configured)
  }

  if (platform === 'android' || platform === 'native') {
    if (configured) return configured
    if (platform === 'android' && input.androidTarget === 'emulator') return emulatorBaseUrl
    throw new ApiConfigurationError('SideShift server is not configured for this Android build. Set VITE_API_BASE_URL to the hosted HTTPS Worker, or explicitly provide a local development API URL.')
  }

  // Browser development always uses the Vite /api proxy, even when a device-only
  // VITE_API_BASE_URL is present in .env.local for Android physical-device testing.
  if (mode === 'development' && platform === 'web') return ''

  return configured
}

export function buildApiUrl(path: string, input: ApiConfigInput = {}): string {
  if (!path.startsWith('/')) throw new Error('SideShift API paths must start with /.')
  return `${resolveApiBaseUrl(input)}${path}`
}
