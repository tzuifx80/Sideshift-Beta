import type { ProviderError, ProviderErrorCode } from './types'

export function providerError(
  code: ProviderErrorCode,
  message: string,
  retryable: boolean,
  status?: number,
): ProviderError {
  return Object.assign(new Error(message), { code, retryable, status })
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

export function mapHttpToProviderError(status: number, body?: string): ProviderError {
  if (status === 401 || status === 403) {
    return providerError('auth_failed', 'Upstream provider rejected credentials.', false, status)
  }
  if (status === 429) {
    return providerError('rate_limited', 'Upstream provider rate limited the request.', true, status)
  }
  if (status >= 500) {
    return providerError('provider_unavailable', 'Upstream provider is temporarily unavailable.', true, status)
  }
  if (status === 400 && /safety|policy|content/i.test(body || '')) {
    return providerError('safety_rejected', 'Request rejected by provider safety policy.', false, status)
  }
  return providerError('ai_unavailable', 'Upstream provider could not complete the request.', false, status)
}
