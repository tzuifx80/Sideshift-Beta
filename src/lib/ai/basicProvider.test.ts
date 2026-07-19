import { describe, expect, it, vi } from 'vitest'
import { createBasicAiProvider } from './basicProvider'

describe('SideShift Basic provider', () => {
  it('uses the server capability and returns a streamed response without Puter', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ available: true, provider: 'basic', usage: { allowed: true, debatesRemaining: 3, turnsRemaining: 3 }, entitlements: { plan: 'free', basicDebatesPerDay: 3, basicMaxRounds: 3 } }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: 'A bounded counterpoint.', round: 1, language: 'en' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const provider = createBasicAiProvider({ fetcher: fetcher as typeof fetch, userId: 'user-1' })
    expect(await provider.getStatus()).toBe('connected')
    const stream = await provider.streamChat({ modelId: 'sideshift-basic', messages: [{ role: 'user', content: 'Make the case.' }], maxTokens: 120, debateId: 'debate-1', round: 1, requestId: 'request-1' })
    let text = ''
    for await (const chunk of stream.chunks) text += chunk
    expect(text).toBe('A bounded counterpoint.')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ 'x-sideshift-user-id': 'user-1', 'x-request-id': 'request-1' })
  })

  it('does not report Basic as available when the server says unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ available: false, state: 'basic_unavailable' }), { status: 200 }))
    const provider = createBasicAiProvider({ fetcher: fetcher as typeof fetch, userId: 'user-1' })
    await expect(provider.getStatus()).resolves.toBe('failed')
  })
})
