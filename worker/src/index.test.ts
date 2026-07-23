import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetCircuitBreakers } from './providers/circuitBreaker'
import { handleRequest, type WorkerEnv } from './index'

const userId = '11111111-1111-4111-8111-111111111111'
const token = 'test-access-token'
const debateId = '22222222-2222-4222-8222-222222222222'

function opponentPayload() {
  return JSON.stringify({ response: 'A concise opposing argument with a concrete trade-off.', question: 'Which trade-off changes your view?', language: 'en' })
}

function evaluationPayload() {
  return JSON.stringify({
    overallScore: 72,
    reasoningScore: 13,
    evidenceScore: 12,
    responsivenessScore: 15,
    clarityScore: 14,
    strongestPoint: 'The claim stayed specific.',
    improvementArea: 'The scope was not tested.',
    conciseSummary: 'Specific claim with a trade-off that needed a direct reply.',
    confidence: 0.78,
    disclaimer: 'This evaluation is AI-generated and may be imperfect.',
    concession: 'both',
  })
}

function makeEnv(options: {
  reservation?: Record<string, unknown>
  ai?: boolean
  groqKey?: string
  primaryProvider?: string
} = {}): WorkerEnv {
  const rpc = vi.fn(async (url: string) => {
    if (url.endsWith('/get_basic_ai_usage')) return new Response(JSON.stringify({ debatesStarted: 0, turnsGenerated: 0 }))
    if (url.endsWith('/reserve_basic_ai_request')) return new Response(JSON.stringify(options.reservation || { allowed: true, replayed: false }))
    return new Response('{}')
  })
  vi.stubGlobal('fetch', rpc)
  const groqFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes('api.groq.com')) {
      const body = JSON.parse(String(init?.body || '{}')) as { messages?: Array<{ content?: string }> }
      const isEval = body.messages?.some(message => /overallScore/i.test(message.content || '')) ?? false
      const content = isEval ? evaluationPayload() : opponentPayload()
      return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), { status: 200 })
    }
    return rpc(url, init)
  })
  vi.stubGlobal('fetch', groqFetch)
  return {
    AI: options.ai === false ? undefined : { run: vi.fn(async (_model, input) => ({ response: input.messages.some((message: { content: string }) => /overallScore/i.test(message.content)) ? evaluationPayload() : opponentPayload() })) },
    GROQ_API_KEY: options.groqKey ?? 'groq-test-key',
    AI_PRIMARY_PROVIDER: options.primaryProvider || 'groq',
    AI_FALLBACK_PROVIDER: 'cloudflare',
    AI_PRIMARY_MODEL: 'openai/gpt-oss-120b',
    AI_FALLBACK_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8',
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

afterEach(() => {
  vi.unstubAllGlobals()
  resetCircuitBreakers()
})

describe('hosted SideShift AI Worker boundary', () => {
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

  it('reports sideshift-ai health with provider routing metadata', async () => {
    const env = makeEnv()
    const response = await handleRequest(new Request('https://worker.example.dev/api/health'), env)
    const health = await response.json() as { aiMode?: string; ai?: { provider?: string; fallbackProvider?: string } }
    expect(health.aiMode).toBe('sideshift-ai')
    expect(health.ai?.provider).toBe('groq')
    expect(health.ai?.fallbackProvider).toBe('cloudflare')
  })

  it('accepts three authenticated turns and evaluation through the same quota RPC boundary', async () => {
    const env = makeEnv()
    const providerFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith('/auth/v1/user')) return authResponse()
      return providerFetch(url, init)
    }))
    const messages = [{ role: 'system', content: 'Debate in English.' }, { role: 'user', content: 'My argument is specific and testable.' }] as const
    for (const round of [1, 2, 3]) {
      const response = await handleRequest(request('/api/ai/basic/opponent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': `turn-${round}` }, body: JSON.stringify({ modelId: 'sideshift-basic', messages, maxTokens: 120, debateId, round }) }), env)
      expect(response.status).toBe(200)
      const body = await response.json() as { response: string; metadata?: { provider?: string } }
      expect(body.response).toContain('opposing')
      expect(body.metadata?.provider).toBe('groq')
    }
    const evaluation = await handleRequest(request('/api/ai/basic/evaluate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'evaluation-1' }, body: JSON.stringify({ modelId: 'sideshift-basic', messages, debateId }) }), env)
    expect(evaluation.status).toBe(200)
    const evalBody = await evaluation.json() as { evaluation: { clarity: number; metadata?: { provider?: string } } }
    expect(evalBody.evaluation.clarity).toBe(14)
    expect(evalBody.evaluation.metadata?.provider).toBe('groq')
  })

  it('returns an idempotent replay without invoking providers again', async () => {
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

  it('falls back to Workers AI when Groq fails with a retryable error', async () => {
    const env = makeEnv()
    const providerFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith('/auth/v1/user')) return authResponse()
      if (String(url).includes('api.groq.com')) return new Response('rate limited', { status: 429 })
      return providerFetch(url, init)
    }))
    const response = await handleRequest(request('/api/ai/basic/opponent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'fallback-turn' }, body: JSON.stringify({ modelId: 'sideshift-basic', messages: [{ role: 'system', content: 'Debate.' }, { role: 'user', content: 'Argument.' }], maxTokens: 120, debateId, round: 1 }) }), env)
    expect(response.status).toBe(200)
    const body = await response.json() as { metadata?: { fallbackUsed?: boolean; provider?: string } }
    expect(body.metadata?.fallbackUsed).toBe(true)
    expect(body.metadata?.provider).toBe('cloudflare')
  })
})
