import { z } from 'zod'
import { basicUsageResponse, freeEntitlements } from '../../src/lib/ai/basicUsage'
import { languageRepairInstruction, validateResponseLanguage } from '../../src/lib/debateQuality/languageValidator'
import type { WorkerAiBinding } from './providers/cloudflare'
import { buildEvaluationPolicy, buildOpponentPolicy, jsonRetryMessage } from './providers/prompts'
import {
  legacyEvaluationSchema,
  mapNormalizedToLegacyEvaluation,
  normalizedEvaluationSchema,
  opponentOutputSchema,
  parseModelJson,
} from './providers/schemas'
import {
  aiServiceAvailable,
  resolveFallbackModel,
  resolveFallbackProvider,
  resolvePrimaryModel,
  resolvePrimaryProvider,
  routeProviderRequest,
  type RouterEnv,
} from './providers/router'

export interface WorkerEnv extends RouterEnv {
  AI?: WorkerAiBinding
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  BASIC_AI_MODEL?: string
  BASIC_AI_DAILY_DEBATES?: string
  BASIC_AI_MAX_ROUNDS?: string
  BASIC_AI_MAX_INPUT_CHARS?: string
  BASIC_AI_MAX_OUTPUT_TOKENS?: string
  BASIC_AI_ENABLED?: string
  ALLOWED_ORIGINS?: string
  APP_ENV?: string
}

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().trim().min(1).max(1800),
})
const basicInputSchema = z.object({
  modelId: z.literal('sideshift-basic'),
  messages: z.array(messageSchema).min(2).max(8),
  maxTokens: z.number().int().min(40).max(180),
  temperature: z.number().min(0).max(1).optional(),
  debateId: z.string().uuid(),
  round: z.number().int().min(1).max(6),
})
const evaluationInputSchema = z.object({
  modelId: z.literal('sideshift-basic'),
  messages: z.array(messageSchema).min(1).max(3),
  debateId: z.string().uuid(),
})

type BasicInput = z.infer<typeof basicInputSchema>
type EvaluationInput = z.infer<typeof evaluationInputSchema>
type BasicAction = 'turn' | 'evaluation'
type AuthenticatedUser = { id: string; token: string; isAnonymous: boolean }

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...headers } })
}

function error(status: number, code: string, message: string, headers: HeadersInit = {}) {
  return json({ error: { code, message } }, status, headers)
}

function allowedOrigins(env: WorkerEnv): Set<string> {
  return new Set((env.ALLOWED_ORIGINS || 'https://localhost').split(',').map(value => value.trim()).filter(Boolean))
}

function corsHeaders(request: Request, env: WorkerEnv): Headers {
  const headers = new Headers()
  const origin = request.headers.get('origin')
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('access-control-allow-origin', origin)
    headers.set('vary', 'Origin')
  }
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS')
  headers.set('access-control-allow-headers', 'Authorization, Content-Type, X-Request-Id, X-Sideshift-User-Id')
  headers.set('access-control-max-age', '600')
  return headers
}

function withCors(response: Response, request: Request, env: WorkerEnv) {
  const headers = new Headers(response.headers)
  corsHeaders(request, env).forEach((value, key) => headers.set(key, value))
  return new Response(response.body, { status: response.status, headers })
}

function bearerToken(request: Request): string {
  const value = request.headers.get('authorization') || ''
  return value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

async function authenticate(request: Request, env: WorkerEnv): Promise<AuthenticatedUser | null> {
  const token = bearerToken(request)
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  const user = await response.json() as { id?: unknown; is_anonymous?: unknown }
  if (typeof user.id !== 'string' || !z.string().uuid().safeParse(user.id).success) return null
  const submittedId = request.headers.get('x-sideshift-user-id')
  if (submittedId && submittedId !== user.id) return null
  return { id: user.id, token, isAnonymous: user.is_anonymous === true }
}

async function supabaseRequest<T>(env: WorkerEnv, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY)
  headers.set('authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`)
  headers.set('content-type', 'application/json')
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}${path}`, { ...init, headers })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error('Supabase operation failed.')
  return body as T
}

function requestId(request: Request): string {
  const value = request.headers.get('x-request-id') || ''
  return /^[A-Za-z0-9._-]{1,80}$/.test(value) ? value : crypto.randomUUID()
}

function entitlements(env: WorkerEnv) {
  return freeEntitlements({
    BASIC_AI_DAILY_DEBATES: env.BASIC_AI_DAILY_DEBATES,
    BASIC_AI_MAX_ROUNDS: env.BASIC_AI_MAX_ROUNDS,
  })
}

async function usage(env: WorkerEnv, userId: string) {
  const raw = await supabaseRequest<{ debatesStarted?: number; turnsGenerated?: number }>(env, '/rest/v1/rpc/get_basic_ai_usage', {
    method: 'POST', body: JSON.stringify({ p_user_id: userId }),
  })
  const limits = entitlements(env)
  return basicUsageResponse({ debatesStarted: Number(raw?.debatesStarted || 0), turnsGenerated: Number(raw?.turnsGenerated || 0), entitlements: limits })
}

async function reserve(env: WorkerEnv, userId: string, input: BasicInput | EvaluationInput, id: string, action: BasicAction) {
  const limits = entitlements(env)
  return supabaseRequest<{ allowed?: boolean; replayed?: boolean; response?: unknown; reason?: string }>(env, '/rest/v1/rpc/reserve_basic_ai_request', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: userId,
      p_debate_id: input.debateId,
      p_request_id: id,
      p_action: action,
      p_round_number: action === 'turn' ? (input as BasicInput).round : 0,
      p_daily_debates: limits.basicDebatesPerDay,
      p_max_rounds: limits.basicMaxRounds,
    }),
  })
}

async function complete(env: WorkerEnv, userId: string, id: string, response: unknown) {
  await supabaseRequest(env, '/rest/v1/rpc/complete_basic_ai_request', {
    method: 'POST', body: JSON.stringify({ p_user_id: userId, p_request_id: id, p_response: response }),
  })
}

async function fail(env: WorkerEnv, userId: string, id: string) {
  try { await supabaseRequest(env, '/rest/v1/rpc/fail_basic_ai_request', { method: 'POST', body: JSON.stringify({ p_user_id: userId, p_request_id: id }) }) } catch { /* preserve provider error */ }
}

function maxInputChars(env: WorkerEnv) {
  const value = Number(env.BASIC_AI_MAX_INPUT_CHARS || 8000)
  return Math.max(4000, Math.min(12_000, Number.isFinite(value) ? value : 8000))
}

function maxOutputTokens(env: WorkerEnv) {
  const value = Number(env.BASIC_AI_MAX_OUTPUT_TOKENS || 180)
  return Math.max(40, Math.min(180, Number.isFinite(value) ? value : 180))
}

function fallbackModel(env: WorkerEnv) { return resolveFallbackModel(env) }

function basicMessages(input: BasicInput | EvaluationInput, kind: 'opponent' | 'evaluation', env: WorkerEnv) {
  const qwen3 = /qwen3/i.test(fallbackModel(env))
  const supplied = input.messages.map(message => ({ role: message.role, content: message.content.slice(0, 1800) }))
  const system = supplied.find(message => message.role === 'system')?.content || ''
  const policy = kind === 'opponent'
    ? buildOpponentPolicy(system, qwen3, maxInputChars(env))
    : buildEvaluationPolicy(system, qwen3, maxInputChars(env))
  let remaining = Math.max(1000, maxInputChars(env) - policy.length)
  const recent = supplied.filter(message => message.role !== 'system').map(message => {
    const content = message.content.slice(0, Math.min(1800, remaining))
    remaining -= content.length
    return { role: message.role, content }
  }).filter(message => message.content.length > 0)
  return [{ role: 'system' as const, content: policy }, ...recent]
}

function attachMetadata<T extends Record<string, unknown>>(payload: T, routed: { provider: string; model: string; latencyMs: number; fallbackUsed: boolean; attemptCount: number; finishReason?: string }, id: string) {
  return {
    ...payload,
    metadata: {
      provider: routed.provider,
      model: routed.model,
      requestId: id,
      finishReason: routed.finishReason,
      latencyMs: routed.latencyMs,
      fallbackUsed: routed.fallbackUsed,
      attemptCount: routed.attemptCount,
    },
  }
}

function extractDebateLanguage(messages: Array<{ role: string; content: string }>): { code: string; name: string } | null {
  const system = messages.find(message => message.role === 'system')?.content || ''
  const match = system.match(/Respond entirely in ([^(]+) \(([a-z]{2}(?:-[a-z]{2})?)\)/i)
  if (!match) return null
  return { name: match[1].trim(), code: match[2].toLowerCase() }
}

async function generate(env: WorkerEnv, input: BasicInput | EvaluationInput, kind: 'opponent' | 'evaluation', id: string) {
  if (!aiServiceAvailable(env)) {
    throw Object.assign(new Error('SideShift AI is temporarily unavailable.'), { code: 'provider_unavailable' })
  }
  let messages = basicMessages(input, kind, env)
  let lastError: unknown
  let languageRepairUsed = false
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const routed = await routeProviderRequest(env, {
        messages,
        temperature: kind === 'evaluation' ? 0.15 : 0.35,
        maxTokens: kind === 'evaluation' ? Math.min(500, maxOutputTokens(env) * 3) : Math.min(maxOutputTokens(env), (input as BasicInput).maxTokens),
        task: kind === 'evaluation' ? 'evaluation' : 'opponent',
      })
      const parsed = parseModelJson(routed.content)
      if (kind === 'opponent') {
        const opponent = opponentOutputSchema.parse({ ...parsed as object, round: (input as BasicInput).round })
        const target = extractDebateLanguage(messages)
        if (target) {
          const languageCheck = validateResponseLanguage(opponent.response, target.code)
          if (!languageCheck.ok && !languageRepairUsed) {
            languageRepairUsed = true
            messages = [...messages, { role: 'user' as const, content: languageRepairInstruction(target.name, target.code, languageCheck.reason) }]
            continue
          }
        }
        return attachMetadata(opponent, routed, id)
      }
      const normalized = normalizedEvaluationSchema.parse(parsed)
      const legacy = mapNormalizedToLegacyEvaluation(normalized)
      const evaluation = legacyEvaluationSchema.parse(legacy)
      return attachMetadata(evaluation, routed, id)
    } catch (caught) {
      lastError = caught
      if (attempt === 0) messages = [...messages, { role: 'user' as const, content: jsonRetryMessage() }]
    }
  }
  throw Object.assign(new Error('SideShift AI could not complete the request.'), { code: (lastError as { code?: string })?.code || 'ai_unavailable' })
}

function parseInput<T>(schema: z.ZodType<T>, body: unknown): T | null { const result = schema.safeParse(body); return result.success ? result.data : null }

function healthPayload(env: WorkerEnv) {
  const primary = resolvePrimaryProvider(env)
  const fallback = resolveFallbackProvider(env)
  return {
    ok: true,
    status: 'ok',
    environment: env.APP_ENV || 'production',
    backend: 'supabase',
    persistence: 'supabase',
    aiMode: 'sideshift-ai',
    ai: {
      provider: primary,
      fallbackProvider: fallback,
      primaryModel: resolvePrimaryModel(env),
      fallbackModel: resolveFallbackModel(env),
      basicServerAvailable: aiServiceAvailable(env),
      groqConfigured: Boolean(env.GROQ_API_KEY),
      workersAiBound: Boolean(env.AI),
    },
  }
}

async function handle(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) })
  const url = new URL(request.url)
  if (url.pathname === '/api/health' && request.method === 'GET') return json(healthPayload(env))
  if (!['/api/ai/basic/capability', '/api/ai/basic/opponent', '/api/ai/basic/evaluate'].includes(url.pathname)) {
    return error(404, 'not_found', 'SideShift API route not found.')
  }
  const user = await authenticate(request, env)
  if (!user) return error(401, 'auth_required', 'An authenticated SideShift session is required for SideShift AI.')
  if (url.pathname === '/api/ai/basic/capability' && request.method === 'GET') {
    const currentUsage = await usage(env, user.id)
    const limits = entitlements(env)
    const available = aiServiceAvailable(env)
    const reason = currentUsage.allowed ? undefined : 'quota_exhausted'
    const state = !available
      ? 'basic_unavailable'
      : reason
        ? 'basic_quota_exhausted'
        : 'basic_available'
    return json({
      provider: 'sideshift-ai',
      available,
      state,
      primaryProvider: resolvePrimaryProvider(env),
      fallbackProvider: resolveFallbackProvider(env),
      usage: { ...currentUsage, ...(reason ? { reason } : {}) },
      entitlements: limits,
    })
  }
  if (request.method !== 'POST') return error(405, 'method_not_allowed', 'This SideShift API route does not support that method.')
  const body = await request.json().catch(() => null)
  const isEvaluation = url.pathname.endsWith('/evaluate')
  const input = parseInput(isEvaluation ? evaluationInputSchema : basicInputSchema, body)
  if (!input) {
    return error(400, 'invalid_request', isEvaluation ? 'The SideShift AI evaluation request is invalid.' : 'The SideShift AI request is invalid.')
  }
  const id = requestId(request)
  const action: BasicAction = isEvaluation ? 'evaluation' : 'turn'
  const reservation = await reserve(env, user.id, input, id, action)
  if (!reservation.allowed) {
    return error(
      reservation.reason === 'quota_exhausted' ? 429 : 409,
      reservation.reason === 'quota_exhausted' ? 'quota_exhausted' : 'rate_limited',
      reservation.reason === 'quota_exhausted' ? 'Your SideShift AI allowance is used for today.' : 'That SideShift AI request is already being handled. Retry shortly.',
    )
  }
  if (reservation.replayed) return json(isEvaluation ? { evaluation: reservation.response } : reservation.response)
  try {
    const result = await generate(env, input, isEvaluation ? 'evaluation' : 'opponent', id)
    await complete(env, user.id, id, result)
    return json(isEvaluation ? { evaluation: result } : result)
  } catch (caught) {
    await fail(env, user.id, id)
    const code = (caught as { code?: string })?.code
    const mapped = code === 'provider_unavailable'
      ? 'provider_unavailable'
      : code === 'rate_limited'
        ? 'rate_limited'
        : code === 'quota_exhausted'
          ? 'quota_exhausted'
          : 'ai_unavailable'
    const status = mapped === 'rate_limited' || mapped === 'quota_exhausted' ? 429 : 502
    return error(
      status,
      mapped,
      mapped === 'provider_unavailable'
        ? 'SideShift AI is temporarily unavailable. You can retry shortly or use Connect Puter.'
        : 'SideShift AI could not answer this request. Retry once shortly.',
    )
  }
}

export async function handleRequest(request: Request, env: WorkerEnv) {
  try {
    return withCors(await handle(request, env), request, env)
  } catch {
    return withCors(error(503, 'provider_unavailable', 'SideShift AI is temporarily unavailable. Retry shortly.'), request, env)
  }
}

export default { fetch: handleRequest }
