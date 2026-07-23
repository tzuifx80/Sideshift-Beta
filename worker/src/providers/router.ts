import type { WorkerAiBinding } from './cloudflare'
import { callCloudflare } from './cloudflare'
import { callGroq } from './groq'
import { isCircuitOpen, recordProviderFailure, recordProviderSuccess } from './circuitBreaker'
import type { ProviderError, ProviderKind, ProviderRequest, RoutedResult } from './types'

export type RouterEnv = {
  AI?: WorkerAiBinding
  GROQ_API_KEY?: string
  GEMINI_API_KEY?: string
  AI_PRIMARY_PROVIDER?: string
  AI_PRIMARY_MODEL?: string
  AI_FALLBACK_PROVIDER?: string
  AI_FALLBACK_MODEL?: string
  BASIC_AI_MODEL?: string
  BASIC_AI_ENABLED?: string
}

const RETRY_DELAY_MS = 350

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      }, { once: true })
    }
  })
}

function jitteredDelay(base: number) {
  return base + Math.floor(Math.random() * 120)
}

export function resolvePrimaryProvider(env: RouterEnv): ProviderKind {
  const value = (env.AI_PRIMARY_PROVIDER || 'groq').toLowerCase()
  if (value === 'cloudflare' || value === 'workers-ai' || value === 'workers_ai') return 'cloudflare'
  if (value === 'gemini') return 'gemini'
  return 'groq'
}

export function resolveFallbackProvider(env: RouterEnv): ProviderKind {
  const value = (env.AI_FALLBACK_PROVIDER || 'cloudflare').toLowerCase()
  if (value === 'groq') return 'groq'
  if (value === 'gemini') return 'gemini'
  return 'cloudflare'
}

export function resolvePrimaryModel(env: RouterEnv): string {
  return env.AI_PRIMARY_MODEL || 'openai/gpt-oss-120b'
}

export function resolveFallbackModel(env: RouterEnv): string {
  return env.AI_FALLBACK_MODEL || env.BASIC_AI_MODEL || '@cf/qwen/qwen3-30b-a3b-fp8'
}

export function aiServiceAvailable(env: RouterEnv): boolean {
  if (env.BASIC_AI_ENABLED === 'false') return false
  const primary = resolvePrimaryProvider(env)
  const fallback = resolveFallbackProvider(env)
  const ready = (provider: ProviderKind) => {
    if (provider === 'groq') return Boolean(env.GROQ_API_KEY)
    if (provider === 'cloudflare') return Boolean(env.AI)
    return Boolean(env.GEMINI_API_KEY)
  }
  return ready(primary) || (fallback !== primary && ready(fallback))
}

async function invokeProvider(
  env: RouterEnv,
  provider: ProviderKind,
  model: string,
  request: ProviderRequest,
): Promise<RoutedResult> {
  if (isCircuitOpen(provider)) {
    throw Object.assign(new Error(`${provider} circuit is open.`), {
      code: 'provider_unavailable',
      retryable: true,
    }) as ProviderError
  }
  try {
    let raw
    if (provider === 'groq') {
      raw = await callGroq(env.GROQ_API_KEY || '', model, request)
    } else if (provider === 'cloudflare') {
      if (!env.AI) throw Object.assign(new Error('Workers AI binding missing.'), { code: 'provider_unavailable', retryable: false })
      raw = await callCloudflare(env.AI, model, request)
    } else {
      throw Object.assign(new Error('Gemini is not enabled for production routing.'), { code: 'provider_unavailable', retryable: false })
    }
    recordProviderSuccess(provider)
    return {
      ...raw,
      fallbackUsed: false,
      attemptCount: 1,
      primaryProvider: provider,
      selectedProvider: provider,
    }
  } catch (caught) {
    recordProviderFailure(provider)
    throw caught
  }
}

function shouldFallback(error: ProviderError): boolean {
  if (!error.retryable) return false
  return error.code === 'timeout'
    || error.code === 'rate_limited'
    || error.code === 'provider_unavailable'
    || error.code === 'invalid_response'
    || error.code === 'ai_unavailable'
}

export async function routeProviderRequest(env: RouterEnv, request: ProviderRequest): Promise<RoutedResult> {
  const primary = resolvePrimaryProvider(env)
  const fallback = resolveFallbackProvider(env)
  const primaryModel = resolvePrimaryModel(env)
  const fallbackModel = resolveFallbackModel(env)
  let attemptCount = 0
  let lastError: ProviderError | null = null

  for (let retry = 0; retry < 2; retry += 1) {
    attemptCount += 1
    try {
      const result = await invokeProvider(env, primary, primaryModel, request)
      return { ...result, attemptCount, primaryProvider: primary, selectedProvider: primary, fallbackUsed: false }
    } catch (caught) {
      lastError = caught as ProviderError
      if (!lastError.retryable || retry === 1) break
      await sleep(jitteredDelay(RETRY_DELAY_MS), request.signal)
    }
  }

  if (fallback !== primary && shouldFallback(lastError!)) {
    for (let retry = 0; retry < 2; retry += 1) {
      attemptCount += 1
      try {
        const result = await invokeProvider(env, fallback, fallbackModel, request)
        return {
          ...result,
          attemptCount,
          primaryProvider: primary,
          selectedProvider: fallback,
          fallbackUsed: true,
        }
      } catch (caught) {
        lastError = caught as ProviderError
        if (!lastError.retryable || retry === 1) break
        await sleep(jitteredDelay(RETRY_DELAY_MS), request.signal)
      }
    }
  }

  throw lastError || Object.assign(new Error('SideShift AI could not complete the request.'), { code: 'ai_unavailable', retryable: false })
}
