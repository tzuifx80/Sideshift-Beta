import { generateDebateTurn, evaluateDebate } from '../../reliableCore/engine'
import { isReliableCoreLanguage } from '../debateLanguage'
import { RELIABLE_CORE_VERSION } from '../../reliableCore/version'
import { validateDebateResponse, validateResponseLanguage } from '../debateQuality'
import type { AiEvaluation, AiMessage, AiProvider } from '../ai/types'
import type {
  DebateEngineStatus,
  DebateEvaluationInput,
  DebateEvaluationResult,
  DebateFallbackReason,
  DebateTurnInput,
  DebateTurnResult,
} from './types'

const ENHANCEMENT_DEADLINE_MS = 12_000

export type DebateEngineRouterOptions = {
  online: () => boolean
  enhancedProvider: AiProvider
  deadlineMs?: number
}

function mapFallbackReason(error: unknown): DebateFallbackReason {
  if (!navigator.onLine) return 'offline'
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : ''
  if (code === 'rate_limited') return 'rate_limited'
  if (code === 'allowance_exhausted' || code === 'quota_exhausted') return 'quota_exhausted'
  if (code === 'invalid_response') return 'invalid_response'
  if (code === 'language_unsupported') return 'invalid_response'
  if (code === 'timeout') return 'timeout'
  if (code === 'circuit_open') return 'circuit_open'
  return 'provider_unavailable'
}

async function withDeadline<T>(promise: Promise<T>, deadlineMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('Hosted enhancement timed out.'), { code: 'timeout' }))
    }, deadlineMs)
    const onAbort = () => {
      clearTimeout(timer)
      reject(Object.assign(new Error('Request aborted.'), { code: 'timeout' }))
    }
    if (signal?.aborted) return onAbort()
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      value => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); resolve(value) },
      error => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(error) },
    )
  })
}

function transcriptFromMessages(messages: AiMessage[]): Array<{ role: 'user' | 'opponent'; round: number; content: string }> {
  let round = 1
  const transcript: Array<{ role: 'user' | 'opponent'; round: number; content: string }> = []
  for (const message of messages) {
    if (message.role === 'system') continue
    const role = message.role === 'assistant' ? 'opponent' : 'user'
    if (role === 'user' && transcript.length && transcript[transcript.length - 1]?.role === 'user') round += 1
    transcript.push({ role, round, content: message.content })
  }
  return transcript
}

function previousOpponentTexts(transcript: DebateTurnInput['transcript']): string[] {
  return transcript.filter(turn => turn.role === 'opponent').map(turn => turn.content)
}

async function streamHostedText(
  provider: AiProvider,
  input: {
    messages: AiMessage[]
    modelId?: string
    maxTokens?: number
    temperature?: number
    debateId: string
    round: number
    requestId: string
    signal?: AbortSignal
  },
): Promise<string> {
  const stream = await provider.streamChat({
    modelId: input.modelId || 'sideshift-basic',
    messages: input.messages,
    maxTokens: input.maxTokens || 180,
    temperature: input.temperature,
    debateId: input.debateId,
    round: input.round,
    requestId: input.requestId,
  })
  let text = ''
  for await (const chunk of stream.chunks) text += chunk
  return text.trim()
}

export function createDebateEngineRouter(options: DebateEngineRouterOptions) {
  const deadlineMs = options.deadlineMs ?? ENHANCEMENT_DEADLINE_MS
  const committedTurns = new Map<string, string>()
  const committedEvaluations = new Set<string>()

  async function getStatus(): Promise<DebateEngineStatus> {
    if (!options.online()) {
      return { reliableAvailable: true, enhancementAvailable: false, enhancementReason: 'offline' }
    }
    try {
      const status = await options.enhancedProvider.getStatus()
      return {
        reliableAvailable: true,
        enhancementAvailable: status === 'connected',
        enhancementReason: status === 'connected' ? undefined : 'enhancementUnavailable',
      }
    } catch {
      return { reliableAvailable: true, enhancementAvailable: false, enhancementReason: 'enhancementUnavailable' }
    }
  }

  async function generateTurn(input: DebateTurnInput): Promise<DebateTurnResult> {
    if (committedTurns.has(input.requestId)) {
      const cached = committedTurns.get(input.requestId)!
      return {
        text: cached,
        engineMode: 'reliable',
        engineVersion: RELIABLE_CORE_VERSION,
        tactic: 'cached',
        requestId: input.requestId,
        latencyMs: 0,
        generatedAt: new Date().toISOString(),
      }
    }

    const reliableSupported = isReliableCoreLanguage(input.language)

    if (!options.online()) {
      if (!reliableSupported) {
        throw Object.assign(new Error('This debate language requires online enhancement while offline.'), { code: 'language_unsupported' })
      }
      const local = generateDebateTurn(input)
      committedTurns.set(input.requestId, local.text)
      return { ...local, fallbackReason: 'offline' }
    }

    const started = Date.now()
    const messages: AiMessage[] = input.enhancedMessages || [
      { role: 'system', content: `Debate motion: ${input.motion}. You argue for ${input.aiSide}.` },
      ...input.transcript.map(turn => ({ role: turn.role === 'opponent' ? 'assistant' as const : 'user' as const, content: turn.content })),
      { role: 'user', content: input.userArgument },
    ]

    const previousTexts = previousOpponentTexts(input.transcript)

    async function tryHosted(repairHint?: string): Promise<string> {
      const attemptMessages = repairHint
        ? [...messages, { role: 'user' as const, content: repairHint }]
        : messages
      return withDeadline(
        streamHostedText(options.enhancedProvider, {
          messages: attemptMessages,
          modelId: input.modelId,
          maxTokens: input.maxTokens,
          debateId: input.debateId,
          round: input.round,
          requestId: input.requestId,
          signal: input.signal,
        }),
        deadlineMs,
        input.signal,
      )
    }

    try {
      const status = await options.enhancedProvider.getStatus()
      if (status !== 'connected') await options.enhancedProvider.connect()

      const text = await tryHosted(input.repairHint)
      if (!text) throw Object.assign(new Error('Empty hosted response.'), { code: 'invalid_response' })

      const languageCheck = validateResponseLanguage(text, input.language)
      const qualityCheck = validateDebateResponse({
        text,
        expectedLanguage: input.language,
        motion: input.motion,
        newestArgument: input.userArgument,
        previousOpponentTexts: previousTexts,
      })

      if ((!languageCheck.ok || !qualityCheck.ok) && reliableSupported) {
        const local = generateDebateTurn(input)
        committedTurns.set(input.requestId, local.text)
        return { ...local, fallbackReason: 'invalid_response' }
      }

      if (!languageCheck.ok) {
        throw Object.assign(new Error('Hosted AI replied in the wrong language.'), { code: 'language_unsupported' })
      }

      if (!qualityCheck.ok) {
        throw Object.assign(new Error('Hosted AI response failed quality validation.'), { code: 'invalid_response' })
      }

      const result: DebateTurnResult = {
        text,
        engineMode: 'enhanced',
        engineVersion: RELIABLE_CORE_VERSION,
        tactic: 'hosted',
        requestId: input.requestId,
        latencyMs: Math.round(Date.now() - started),
        generatedAt: new Date().toISOString(),
      }
      committedTurns.set(input.requestId, text)
      return result
    } catch (error) {
      if (committedTurns.has(input.requestId)) {
        const text = committedTurns.get(input.requestId)!
        return {
          text,
          engineMode: 'reliable',
          engineVersion: RELIABLE_CORE_VERSION,
          tactic: 'cached',
          requestId: input.requestId,
          fallbackReason: mapFallbackReason(error),
          latencyMs: Math.round(Date.now() - started),
          generatedAt: new Date().toISOString(),
        }
      }
      if (!reliableSupported) throw error
      const local = generateDebateTurn(input)
      committedTurns.set(input.requestId, local.text)
      return { ...local, fallbackReason: mapFallbackReason(error) }
    }
  }

  async function evaluate(input: DebateEvaluationInput): Promise<DebateEvaluationResult> {
    if (committedEvaluations.has(input.requestId)) {
      const local = evaluateDebate(input)
      return local
    }

    const reliableSupported = isReliableCoreLanguage(input.language)

    if (!options.online()) {
      if (!reliableSupported) {
        throw Object.assign(new Error('Evaluation for this language requires online enhancement while offline.'), { code: 'language_unsupported' })
      }
      const local = evaluateDebate(input)
      committedEvaluations.add(input.requestId)
      return { ...local, fallbackReason: 'offline' }
    }

    const started = Date.now()
    try {
      const status = await options.enhancedProvider.getStatus()
      if (status !== 'connected') await options.enhancedProvider.connect()
      const messages: AiMessage[] = input.enhancedMessages || [
        { role: 'system', content: `Evaluate debate on: ${input.motion}` },
        ...input.transcript.map(turn => ({ role: turn.role === 'opponent' ? 'assistant' as const : 'user' as const, content: turn.content })),
      ]
      const evaluation = await withDeadline(
        options.enhancedProvider.evaluate(messages, input.modelId || 'sideshift-basic', { debateId: input.debateId, requestId: input.requestId }),
        deadlineMs,
        input.signal,
      ) as AiEvaluation
      committedEvaluations.add(input.requestId)
      return {
        evaluation,
        overallScore: evaluation.clarity + evaluation.relevance + evaluation.reasoning + evaluation.rebuttal + evaluation.fairness,
        reasoning: String(evaluation.reasoning),
        evidence: String(evaluation.reasoning),
        responsiveness: String(evaluation.rebuttal),
        clarity: String(evaluation.clarity),
        strongestPoint: evaluation.strongestPoint,
        improvementArea: evaluation.weakestAssumption,
        conciseSummary: evaluation.argumentDna,
        disclaimer: 'Enhanced coaching review.',
        engineMode: 'enhanced',
        engineVersion: RELIABLE_CORE_VERSION,
        latencyMs: Math.round(Date.now() - started),
      }
    } catch (error) {
      if (!reliableSupported) throw error
      const local = evaluateDebate(input)
      committedEvaluations.add(input.requestId)
      return { ...local, fallbackReason: mapFallbackReason(error) }
    }
  }

  return {
    getStatus,
    generateTurn,
    evaluate,
    transcriptFromMessages,
  }
}

export type DebateEngineRouter = ReturnType<typeof createDebateEngineRouter>
