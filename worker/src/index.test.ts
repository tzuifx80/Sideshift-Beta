import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleRequest, type WorkerEnv } from './index'

const userId = '11111111-1111-4111-8111-111111111111'
const token = 'test-access-token'
const debateId = '22222222-2222-4222-8222-222222222222'

function opponentPayload() {
  return JSON.stringify({ response: 'A concise opposing argument with a concrete trade-off.', question: 'Which trade-off changes your view?', language: 'en' })
}

function evaluationPayload() {
  return JSON.stringify({ clarity: 14, relevance: 15, reasoning: 13, rebuttal: 14, fairness: 16, strongestPoint: 'The claim stayed specific.', weakestAssumption: 'The scope was not tested.', missedCounterargument: 'A cost trade-off needed a direct reply.', unansweredOpponentPoint: 'The final objection needed evidence.', improvedExampleResponse: 'I would answer with one bounded example.', argumentDna: 'Specific claim, trade-off, and response.', concession: 'both' })
}

function makeEnv(options: { reservation?: Record<string, unknown>; ai?: boolean } = {}): WorkerEnv {
  const rpc = vi.fn(async (url: string) => {
    if (url.endsWith('/get_basic_ai_usage')) return new Response(JSON.stringify({ debatesStarted: 0, turnsGenerated: 0 }))
    if (url.endsWith('/reserve_basic_ai_request')) return new Response(JSON.stringify(options.reservation || { allowed: true, replayed: false }))
    return new Response('{}')
  })
  vi.stubGlobal('fetch', rpc)
  return {
    AI: options.ai === false ? undefined : { run: vi.fn(async (_model, input) => ({ response: input.messages.some((message: { content: string }) => message.content.includes('evaluating debate')) ? evaluationPayload() : opponentPayload() })) },
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    ALLOWED_ORIGINS: 'https://app.example.com,https://localhost',
  }
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  headers.set('origin', 'https://app.example.com')
  return new Request(`https://worker.example.dev${path}`, { ...init, headers })
}

function authResponse() {
  return new Response(JSON.stringify({ id: userId, is_anonymous: false }), { status: 200 })
}

afterEach(() => vi.unstubAllGlobals())

describe('hosted Basic Worker boundary', () => {
  it('denies unauthenticated capability requests and sends scoped CORS', async () => {
    const env = makeEnv()
    const response = await handleRequest(new Request('https://worker.example.dev/api/ai/basic/capability', { headers: { origin: 'https://app.example.com' } }), env)
    expect(response.status).toBe(401)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
  })

  it('rejects a forged mismatched user header after validating the bearer token', async () => {
    const env = makeEnv()
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith('/auth/v1/user')) return authResponse()
      return originalFetch(url, init)
    }))
    const headers = new Headers({ authorization: `Bearer ${token}`, origin: 'https://app.example.com', 'x-sideshift-user-id': 'forged-user' })
    const response = await handleRequest(new Request('https://worker.example.dev/api/ai/basic/capability', { headers }), env)
    expect(response.status).toBe(401)
  })

  it('accepts three authenticated turns and evaluation through the same quota RPC boundary', async () => {
    const env = makeEnv()
    const rpc = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith('/auth/v1/user')) return authResponse()
      return rpc(url, init)
    }))
    const messages = [{ role: 'system', content: 'Debate in English.' }, { role: 'user', content: 'My argument is specific and testable.' }] as const
    for (const round of [1, 2, 3]) {
      const response = await handleRequest(request('/api/ai/basic/opponent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': `turn-${round}` }, body: JSON.stringify({ modelId: 'sideshift-basic', messages, maxTokens: 120, debateId, round }) }), env)
      expect(response.status).toBe(200)
      expect((await response.json() as { response: string }).response).toContain('opposing')
    }
    const evaluation = await handleRequest(request('/api/ai/basic/evaluate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'evaluation-1' }, body: JSON.stringify({ modelId: 'sideshift-basic', messages, debateId }) }), env)
    expect(evaluation.status).toBe(200)
    expect((await evaluation.json() as { evaluation: { clarity: number } }).evaluation.clarity).toBe(14)
  })

  it('returns an idempotent replay without invoking Workers AI again', async () => {
    const env = makeEnv({ reservation: { allowed: true, replayed: true, response: { response: 'Saved response.' } } })
    const rpc = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith('/auth/v1/user')) return authResponse()
      return rpc(url, init)
    }))
    const response = await handleRequest(request('/api/ai/basic/opponent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modelId: 'sideshift-basic', messages: [{ role: 'system', content: 'Debate.' }, { role: 'user', content: 'Argument.' }], maxTokens: 120, debateId, round: 2 }) }), env)
    expect(response.status).toBe(200)
    expect((await response.json() as { response: string }).response).toBe('Saved response.')
    expect((env.AI?.run as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })
})
