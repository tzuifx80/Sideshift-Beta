import { describe, expect, it, vi } from 'vitest'
import { ApiRequestError, createApiClient } from './api'

describe('SideShift API client', () => {
  it('classifies an unreachable configured server without exposing request details', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createApiClient({ mode: 'development', platform: 'android', apiBaseUrl: 'http://192.0.2.10:8787', fetcher: fetcher as typeof fetch, timeoutMs: 25 })
    await expect(client.request('/api/ai/basic/capability')).rejects.toMatchObject({ code: 'server_unreachable', message: 'The SideShift server could not be reached.' })
    expect(fetcher.mock.calls[0][0]).toBe('http://192.0.2.10:8787/api/ai/basic/capability')
  })

  it('classifies an abort caused by the client timeout separately', async () => {
    const fetcher = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true })
    }))
    const client = createApiClient({ mode: 'development', platform: 'android', apiBaseUrl: 'http://192.0.2.10:8787', fetcher: fetcher as typeof fetch, timeoutMs: 1 })
    await expect(client.request('/api/ai/basic/capability')).rejects.toMatchObject({ code: 'timeout' })
    expect(fetcher.mock.calls[0][0]).toContain('/api/ai/basic/capability')
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({ 'content-type': 'application/json' })
    expect(new ApiRequestError('http_error', 'safe', 500).message).toBe('safe')
  })
})
