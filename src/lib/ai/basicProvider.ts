import { makeUuid } from '../../domain'
import { apiRequest } from '../../data/api'
import type { ApiConfigInput } from '../../data/apiConfig'
import { AiProviderError, normalizeAiError } from './errors'
import { normalizeModels } from './modelResolver'
import { validateEvaluation } from './puterProvider'
import type { AiEvaluation, AiMessage, AiModel, AiProvider, AiStream, AiUsage } from './types'

type BasicCapability = {
  available: boolean
  state?: string
  usage?: { allowed: boolean; debatesRemaining: number; turnsRemaining?: number; resetsAt?: string; reason?: AiUsage['reason'] }
  entitlements?: Record<string, unknown>
}

type BasicProviderOptions = { fetcher?: typeof fetch; accessToken?: string | null; userId?: string | null; apiConfig?: ApiConfigInput }

function headers(options: BasicProviderOptions, requestId?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
    ...(options.userId && !options.accessToken ? { 'x-sideshift-user-id': options.userId } : {}),
    ...(requestId ? { 'x-request-id': requestId } : {}),
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string; code?: string } }
  if (!response.ok) {
    const code = payload.error?.code
    throw new AiProviderError(code === 'rate_limited' ? 'rate_limited' : code === 'quota_exhausted' ? 'allowance_exhausted' : code === 'provider_unavailable' ? 'provider_unavailable' : 'request_failed', payload.error?.message || `SideShift Basic request failed (${response.status}).`, false, response.status)
  }
  return payload as T
}

function readOpponentResponse(payload: unknown): { response: string } {
  const response = payload && typeof payload === 'object' ? (payload as { response?: unknown }).response : undefined
  if (typeof response !== 'string' || !response.trim() || response.length > 700) throw new AiProviderError('invalid_response', 'SideShift Basic returned an invalid response.')
  return { response: response.trim() }
}

export class BasicAiProvider implements AiProvider {
  readonly kind = 'basic' as const
  private status: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected'
  private capability: BasicCapability | null = null
  private readonly fetcher: typeof fetch
  private readonly options: BasicProviderOptions

  constructor(options: BasicProviderOptions = {}) {
    this.fetcher = options.fetcher || fetch
    this.options = options
  }

  private async loadCapability(): Promise<BasicCapability> {
    const response = await this.request('/api/ai/basic/capability', { headers: headers(this.options) })
    const capability = await readJson<BasicCapability>(response)
    this.capability = capability
    return capability
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return apiRequest(path, init, { fetcher: this.fetcher, apiConfig: this.options.apiConfig })
  }

  async getStatus() {
    try {
      const capability = await this.loadCapability()
      this.status = capability.available ? 'connected' : 'failed'
    } catch { this.status = 'failed' }
    return this.status
  }

  async connect(): Promise<void> {
    this.status = 'connecting'
    try {
      const capability = await this.loadCapability()
      if (!capability.available) throw new AiProviderError('provider_unavailable', 'SideShift Basic is temporarily unavailable. Keep Connect Puter available.')
      this.status = 'connected'
    } catch (error) { this.status = 'failed'; throw normalizeAiError(error) }
  }

  async listModels(): Promise<AiModel[]> {
    if (this.status !== 'connected') await this.connect()
    return normalizeModels([{ id: 'sideshift-basic', provider: 'SideShift', name: 'SideShift Basic', max_tokens: 180, capabilities: ['text', 'chat', 'streaming'] }])
  }

  async getUsage(): Promise<AiUsage | null> {
    try {
      const capability = this.capability || await this.loadCapability()
      const usage = capability.usage
      if (!usage) return null
      const allowance = Number(capability.entitlements?.basicDebatesPerDay || usage.debatesRemaining)
      return { remaining: usage.debatesRemaining, allowance, units: 'debates per UTC day', ...usage }
    } catch { return null }
  }

  async streamChat(request: { modelId: string; messages: AiMessage[]; maxTokens: number; temperature?: number; debateId?: string; round?: number; requestId?: string }): Promise<AiStream> {
    if (this.status !== 'connected') await this.connect()
    const requestId = request.requestId || makeUuid()
    const response = await this.request('/api/ai/basic/opponent', {
      method: 'POST',
      headers: headers(this.options, requestId),
      body: JSON.stringify({ modelId: request.modelId, messages: request.messages, maxTokens: Math.min(180, request.maxTokens), temperature: request.temperature ?? .35, debateId: request.debateId, round: request.round }),
    })
    const output = readOpponentResponse(await readJson<unknown>(response))
    let stopped = false
    return { requestId, chunks: (async function* () { if (!stopped && output.response) yield output.response })(), stop: () => { stopped = true } }
  }

  async evaluate(messages: AiMessage[], modelId: string, request?: { debateId?: string; requestId?: string }): Promise<AiEvaluation> {
    if (this.status !== 'connected') await this.connect()
    const response = await this.request('/api/ai/basic/evaluate', {
      method: 'POST',
      headers: headers(this.options, request?.requestId || makeUuid()),
      body: JSON.stringify({ modelId, messages, debateId: request?.debateId }),
    })
    const output = await readJson<{ evaluation: unknown }>(response)
    return validateEvaluation(output.evaluation)
  }
}

export function createBasicAiProvider(options: BasicProviderOptions = {}): AiProvider { return new BasicAiProvider(options) }
