import type { ChatResponseChunk, Puter } from '@heyputer/puter.js'
import { makeUuid } from '../../domain'
import { AiProviderError, normalizeAiError } from './errors'
import { normalizeModels } from './modelResolver'
import type { AiEvaluation, AiMessage, AiProvider, AiStream, AiUsage } from './types'

type PuterRuntime = Pick<Puter, 'auth' | 'ai'>
let puterPromise: Promise<PuterRuntime> | null = null

async function loadPuter(): Promise<PuterRuntime> {
  if (typeof window === 'undefined') throw new AiProviderError('unsupported_browser', 'Puter AI is available in the browser only.')
  puterPromise ||= import('@heyputer/puter.js').then(module => module.puter as PuterRuntime)
  return puterPromise
}

function textFromResponse(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  const message = record.message && typeof record.message === 'object' ? record.message as Record<string, unknown> : null
  if (typeof message?.content === 'string') return message.content
  const choices = Array.isArray(record.choices) ? record.choices : []
  const first = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : null
  const choiceMessage = first?.message && typeof first.message === 'object' ? first.message as Record<string, unknown> : null
  return typeof choiceMessage?.content === 'string' ? choiceMessage.content : ''
}

function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) throw new AiProviderError('invalid_response', 'The AI review did not return valid JSON.')
  try { return JSON.parse(trimmed.slice(start, end + 1)) as T } catch { throw new AiProviderError('invalid_response', 'The AI review did not return valid JSON.') }
}

function boundedScore(value: unknown): number {
  const score = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(score) ? Math.max(0, Math.min(20, Math.round(score))) : 0
}

function validateEvaluation(value: unknown): AiEvaluation {
  if (!value || typeof value !== 'object') throw new AiProviderError('invalid_response', 'The AI review was incomplete.')
  const row = value as Record<string, unknown>
  const stringValue = (key: string) => typeof row[key] === 'string' ? String(row[key]).trim().slice(0, 800) : ''
  const concession: NonNullable<AiEvaluation['concession']> = row.concession === 'user' || row.concession === 'opponent' || row.concession === 'both' || row.concession === 'none' ? row.concession : 'none'
  const evaluation = { clarity: boundedScore(row.clarity), relevance: boundedScore(row.relevance), reasoning: boundedScore(row.reasoning), rebuttal: boundedScore(row.rebuttal), fairness: boundedScore(row.fairness), strongestPoint: stringValue('strongestPoint'), weakestAssumption: stringValue('weakestAssumption'), missedCounterargument: stringValue('missedCounterargument'), unansweredOpponentPoint: stringValue('unansweredOpponentPoint'), improvedExampleResponse: stringValue('improvedExampleResponse'), argumentDna: stringValue('argumentDna'), concession }
  if (Object.values(evaluation).some(value => typeof value === 'string' && !value)) throw new AiProviderError('invalid_response', 'The AI review was incomplete.')
  return evaluation
}

export class PuterAiProvider implements AiProvider {
  private status: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected'
  private models: ReturnType<typeof normalizeModels> | null = null

  async getStatus() {
    try { const puter = await loadPuter(); this.status = puter.auth.isSignedIn() ? 'connected' : 'disconnected' } catch { /* status remains disconnected */ }
    return this.status
  }

  async connect(): Promise<void> {
    this.status = 'connecting'
    try { const puter = await loadPuter(); await puter.auth.signIn(); this.status = 'connected'; this.models = null } catch (error) { this.status = 'failed'; throw normalizeAiError(error) }
  }

  async listModels(forceRefresh = false) {
    if (!forceRefresh && this.models) return this.models
    const puter = await loadPuter()
    if (!puter.auth.isSignedIn()) throw new AiProviderError('connection_required', 'Connect Puter before discovering AI models.')
    try { this.models = normalizeModels(await puter.ai.listModels()); return this.models } catch (error) { throw normalizeAiError(error) }
  }

  async getUsage(): Promise<AiUsage | null> {
    try {
      const puter = await loadPuter()
      if (!puter.auth.isSignedIn()) return null
      const usage = await puter.auth.getMonthlyUsage()
      return { remaining: usage.allowanceInfo?.remaining ?? null, allowance: usage.allowanceInfo?.monthUsageAllowance ?? null, units: 'microcents' }
    } catch { return null }
  }

  async streamChat(request: { modelId: string; messages: AiMessage[]; maxTokens: number; temperature?: number }): Promise<AiStream> {
    const puter = await loadPuter()
    if (!puter.auth.isSignedIn()) throw new AiProviderError('connection_required', 'Connect Puter before starting an AI debate.')
    let stopped = false
    const requestId = makeUuid()
    const chunks = (async function* () {
      try {
        const stream = await Promise.resolve(puter.ai.chat(request.messages.map(message => ({ role: message.role, content: message.content, images: [] })), { model: request.modelId, stream: true, max_tokens: request.maxTokens, temperature: request.temperature ?? .35 }))
        for await (const chunk of stream as AsyncIterable<ChatResponseChunk>) {
          if (stopped) return
          if (chunk.type === 'error') throw normalizeAiError(chunk)
          if (typeof chunk.text === 'string' && chunk.text) yield chunk.text
        }
      } catch (error) { if (!stopped) throw normalizeAiError(error) }
    })()
    return { requestId, chunks, stop: () => { stopped = true } }
  }

  async evaluate(messages: AiMessage[], modelId: string): Promise<AiEvaluation> {
    const puter = await loadPuter()
    if (!puter.auth.isSignedIn()) throw new AiProviderError('connection_required', 'Connect Puter before evaluating the debate.')
    try {
      const response = await puter.ai.chat(messages.map(message => ({ role: message.role, content: message.content, images: [] })), { model: modelId, max_tokens: 350, temperature: .15 })
      try {
        return validateEvaluation(parseJson<unknown>(textFromResponse(response)))
      } catch (firstError) {
        // One bounded repair is allowed. A second invalid answer is a real review failure.
        const repairMessages = [...messages, { role: 'user' as const, content: 'Your previous output was not valid for the requested schema. Return only one complete JSON object with every required key, no markdown and no commentary.' }]
        const repaired = await puter.ai.chat(repairMessages.map(message => ({ role: message.role, content: message.content, images: [] })), { model: modelId, max_tokens: 350, temperature: .1 })
        try { return validateEvaluation(parseJson<unknown>(textFromResponse(repaired))) } catch { throw firstError }
      }
    } catch (error) { if (error instanceof AiProviderError) throw error; throw normalizeAiError(error) }
  }
}

export function createPuterProvider(): AiProvider { return new PuterAiProvider() }
