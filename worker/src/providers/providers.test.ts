import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetCircuitBreakers } from './circuitBreaker'
import { mapNormalizedToLegacyEvaluation, normalizedEvaluationSchema, opponentOutputSchema } from './schemas'
import { aiServiceAvailable, resolveFallbackModel, resolvePrimaryModel, routeProviderRequest } from './router'
import type { WorkerAiBinding } from './cloudflare'

afterEach(() => {
  vi.unstubAllGlobals()
  resetCircuitBreakers()
})

describe('evaluation schema', () => {
  it('validates normalized evaluation and maps to legacy API contract', () => {
    const normalized = normalizedEvaluationSchema.parse({
      overallScore: 80,
      reasoningScore: 16,
      evidenceScore: 14,
      responsivenessScore: 15,
      clarityScore: 17,
      strongestPoint: 'Clear structure.',
      improvementArea: 'Needs evidence.',
      conciseSummary: 'Good clarity with weak evidence.',
      confidence: 0.82,
      disclaimer: 'This evaluation is AI-generated and may be imperfect.',
      concession: 'both',
    })
    const legacy = mapNormalizedToLegacyEvaluation(normalized)
    expect(legacy.clarity).toBe(17)
    expect(legacy.reasoning).toBe(16)
    expect(legacy.strongestPoint).toBe('Clear structure.')
  })

  it('rejects malformed evaluation JSON fields', () => {
    expect(() => normalizedEvaluationSchema.parse({ overallScore: 10 })).toThrow()
  })
})

describe('opponent schema', () => {
  it('rejects empty opponent responses', () => {
    expect(() => opponentOutputSchema.parse({ response: '' })).toThrow()
  })
})

describe('provider router', () => {
  const ai: WorkerAiBinding = {
    run: vi.fn(async () => ({ response: JSON.stringify({ response: 'Fallback answer with trade-off.' }) })),
  }

  it('uses Groq as primary when configured', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      if (String(url).includes('api.groq.com')) {
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ response: 'Groq answer.' }) } }] }), { status: 200 })
      }
      throw new Error('unexpected fetch')
    }))
    const result = await routeProviderRequest(
      { GROQ_API_KEY: 'key', AI_PRIMARY_PROVIDER: 'groq', AI_FALLBACK_PROVIDER: 'cloudflare', AI: ai },
      { messages: [{ role: 'user', content: 'Argue.' }], maxTokens: 120, temperature: 0.3, task: 'opponent' },
    )
    expect(result.provider).toBe('groq')
    expect(result.fallbackUsed).toBe(false)
  })

  it('does not fall back on auth failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      if (String(url).includes('api.groq.com')) return new Response('unauthorized', { status: 401 })
      throw new Error('unexpected fetch')
    }))
    await expect(routeProviderRequest(
      { GROQ_API_KEY: 'bad', AI_PRIMARY_PROVIDER: 'groq', AI_FALLBACK_PROVIDER: 'cloudflare', AI: ai },
      { messages: [{ role: 'user', content: 'Argue.' }], maxTokens: 120, temperature: 0.3, task: 'opponent' },
    )).rejects.toMatchObject({ code: 'auth_failed' })
    expect((ai.run as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('reports availability when fallback provider is ready', () => {
    expect(aiServiceAvailable({ AI_PRIMARY_PROVIDER: 'groq', AI_FALLBACK_PROVIDER: 'cloudflare', AI: ai })).toBe(true)
    expect(resolvePrimaryModel({ AI_PRIMARY_MODEL: 'openai/gpt-oss-120b' })).toBe('openai/gpt-oss-120b')
    expect(resolveFallbackModel({ AI_FALLBACK_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8' })).toBe('@cf/qwen/qwen3-30b-a3b-fp8')
  })
})
