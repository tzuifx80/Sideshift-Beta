import { describe, expect, it, vi } from 'vitest'
import { createBasicAiProvider } from './basicProvider'

describe('SideShift Basic provider', () => {
  it('uses the server capability and returns a streamed response without Puter', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ available: true, provider: 'basic', usage: { allowed: true, debatesRemaining: 3, turnsRemaining: 3 }, entitlements: { plan: 'free', basicDebatesPerDay: 3, basicMaxRounds: 3 } }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: 'A bounded counterpoint.', round: 1, language: 'en' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const provider = createBasicAiProvider({ fetcher: fetcher as typeof fetch, userId: 'user-1', apiConfig: { mode: 'development', platform: 'android', apiBaseUrl: 'http://192.0.2.10:8787' } })
    expect(await provider.getStatus()).toBe('connected')
    const stream = await provider.streamChat({ modelId: 'sideshift-basic', messages: [{ role: 'user', content: 'Make the case.' }], maxTokens: 120, debateId: 'debate-1', round: 1, requestId: 'request-1' })
    let text = ''
    for await (const chunk of stream.chunks) text += chunk
    expect(text).toBe('A bounded counterpoint.')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][0]).toBe('http://192.0.2.10:8787/api/ai/basic/capability')
    expect(fetcher.mock.calls[1][0]).toBe('http://192.0.2.10:8787/api/ai/basic/opponent')
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ 'x-sideshift-user-id': 'user-1', 'x-request-id': 'request-1' })
  })

  it('routes evaluation through the same configured API base', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ available: true, usage: { allowed: true, debatesRemaining: 3, turnsRemaining: 3 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ evaluation: { clarity: 14, relevance: 14, reasoning: 13, rebuttal: 12, fairness: 15, strongestPoint: 'Specific.', weakestAssumption: 'The example could be broader.', missedCounterargument: 'A cost trade-off.', unansweredOpponentPoint: 'The long-term effect.', improvedExampleResponse: 'A clearer response.', argumentDna: 'Balanced and concrete.', concession: 'none' } }), { status: 200 }))
    const provider = createBasicAiProvider({ fetcher: fetcher as typeof fetch, userId: 'user-1', apiConfig: { mode: 'development', platform: 'android', apiBaseUrl: 'http://192.0.2.10:8787' } })
    await provider.evaluate([{ role: 'user', content: 'A careful argument.' }], 'sideshift-basic', { debateId: 'debate-1', requestId: 'evaluation-1' })
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      'http://192.0.2.10:8787/api/ai/basic/capability',
      'http://192.0.2.10:8787/api/ai/basic/evaluate',
    ])
  })

  it('does not report Basic as available when the server says unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ available: false, state: 'basic_unavailable' }), { status: 200 }))
    const provider = createBasicAiProvider({ fetcher: fetcher as typeof fetch, userId: 'user-1' })
    await expect(provider.getStatus()).resolves.toBe('failed')
  })
})
