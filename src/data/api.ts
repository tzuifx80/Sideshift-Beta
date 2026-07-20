import { Capacitor } from '@capacitor/core'
import { ApiConfigurationError, buildApiUrl, resolveApiBaseUrl, type ApiConfigInput, type ApiPlatform } from './apiConfig'

export type ApiRequestErrorCode = 'server_unreachable' | 'timeout' | 'http_error'

export class ApiRequestError extends Error {
  constructor(public readonly code: ApiRequestErrorCode, message: string, public readonly status?: number) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

type ApiClientOptions = ApiConfigInput & { fetcher?: typeof fetch; timeoutMs?: number }

function runtimeConfig(): ApiConfigInput {
  const platform: ApiPlatform = Capacitor.isNativePlatform()
    ? (Capacitor.getPlatform() === 'android' ? 'android' : 'native')
    : 'web'
  return {
    mode: import.meta.env.MODE,
    platform,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL,
    androidTarget: import.meta.env.VITE_ANDROID_API_TARGET,
  }
}

function endpointDetails(url: string): { host: string; path: string } {
  try {
    const parsed = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
    return { host: parsed.host, path: parsed.pathname }
  } catch { return { host: 'invalid', path: 'invalid' } }
}

function diagnose(event: { url: string; outcome: string; status?: number }): void {
  if (!import.meta.env.DEV) return
  const details = endpointDetails(event.url)
  console.debug('[sideshift-api]', { host: details.host, path: details.path, outcome: event.outcome, ...(event.status === undefined ? {} : { status: event.status }) })
}

async function fetchWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const abortOriginal = () => controller.abort()
  init.signal?.addEventListener('abort', abortOriginal, { once: true })
  try {
    return await fetcher(url, { ...init, signal: controller.signal })
  } catch (caught) {
    const timedOut = controller.signal.aborted && !init.signal?.aborted
    diagnose({ url, outcome: timedOut ? 'timeout' : 'network_failure' })
    if (timedOut) throw new ApiRequestError('timeout', 'The SideShift server request timed out.')
    throw new ApiRequestError('server_unreachable', 'The SideShift server could not be reached.')
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abortOriginal)
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  const config = { ...runtimeConfig(), ...options }
  const fetcher = options.fetcher || fetch
  const timeoutMs = options.timeoutMs || 15_000

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    let url: string
    try { url = buildApiUrl(path, config) } catch (caught) {
      if (caught instanceof ApiConfigurationError) {
        diagnose({ url: path, outcome: 'configuration_missing' })
        throw new ApiRequestError('server_unreachable', caught.message)
      }
      throw caught
    }
    const response = await fetchWithTimeout(fetcher, url, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } }, timeoutMs)
    diagnose({ url, outcome: 'response', status: response.status })
    return response
  }

  async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await request(path, init)
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }
    if (!response.ok) throw new ApiRequestError('http_error', payload.error?.message || `Request failed (${response.status}).`, response.status)
    return payload as T
  }

  return { request, fetchJson }
}

const defaultClient = createApiClient()

export async function apiRequest(path: string, init?: RequestInit, options: { fetcher?: typeof fetch; apiConfig?: ApiConfigInput } = {}): Promise<Response> {
  return (options.fetcher || options.apiConfig ? createApiClient({ ...options.apiConfig, fetcher: options.fetcher }).request(path, init) : defaultClient.request(path, init))
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return defaultClient.fetchJson<T>(path, init)
}

export { buildApiUrl, resolveApiBaseUrl }
