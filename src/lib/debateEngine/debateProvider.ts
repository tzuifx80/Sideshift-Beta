import { makeUuid } from '../../domain'
import { normalizeModels } from '../ai/modelResolver'
import type { AiEvaluation, AiMessage, AiProvider, AiStream, AiUsage } from '../ai/types'
import { getActiveDebateEngineContext, recordDebateTactic, setLastEvaluationDisclaimer, setLastTurnResult } from './context'
import { createDebateEngineRouter, type DebateEngineRouter } from './router'
import type { DebateEngineStatus, DebateFallbackReason } from './types'

export type DebateEngineProviderOptions = {
  online: () => boolean
  enhancedProvider: AiProvider
  onEngineEvent?: (event: { kind: 'turn' | 'evaluation'; mode: 'enhanced' | 'reliable'; fallbackReason?: DebateFallbackReason }) => void
}

export class DebateEngineProvider implements AiProvider {
  readonly kind = 'basic' as const
  private readonly router: DebateEngineRouter
  private readonly enhancedProvider: AiProvider
  private readonly onEngineEvent?: DebateEngineProviderOptions['onEngineEvent']
  private status: DebateEngineStatus = { reliableAvailable: true, enhancementAvailable: false }

  constructor(options: DebateEngineProviderOptions) {
    this.enhancedProvider = options.enhancedProvider
    this.onEngineEvent = options.onEngineEvent
    this.router = createDebateEngineRouter({ online: options.online, enhancedProvider: options.enhancedProvider })
  }

  async refreshStatus(): Promise<DebateEngineStatus> {
    this.status = await this.router.getStatus()
    return this.status
  }

  async getStatus() {
    await this.refreshStatus()
    return 'connected' as const
  }

  async connect() {
    this.status = await this.router.getStatus()
  }

  async listModels() {
    return normalizeModels([{ id: 'sideshift-debate', provider: 'SideShift', name: 'SideShift Debate', max_tokens: 180, capabilities: ['text', 'chat', 'streaming'] }])
  }

  async getUsage(): Promise<AiUsage | null> {
    await this.refreshStatus()
    if (!this.status.enhancementAvailable) {
      return { remaining: null, allowance: null, units: 'enhanced debates', allowed: true }
    }
    try {
      return await this.enhancedProvider.getUsage()
    } catch {
      return { remaining: null, allowance: null, units: 'enhanced debates', allowed: true }
    }
  }

  async streamChat(request: {
    modelId: string
    messages: AiMessage[]
    maxTokens: number
    debateId?: string
    round?: number
    requestId?: string
  }): Promise<AiStream> {
    const context = getActiveDebateEngineContext()
    if (!context) throw new Error('Debate context is not ready.')
    const requestId = request.requestId || makeUuid()
    const transcript = this.router.transcriptFromMessages(request.messages)
    const userArgument = [...request.messages].reverse().find(message => message.role === 'user')?.content || ''
    const round = request.round || Math.max(1, ...transcript.filter(turn => turn.role === 'user').map(turn => turn.round), 1)

    let stopped = false
    const task = this.router.generateTurn({
      debateId: context.debateId,
      takeId: context.takeId,
      motion: context.motion,
      userSide: context.userSide,
      aiSide: context.aiSide,
      language: context.language,
      languageName: context.languageName,
      round,
      roundLimit: context.roundLimit,
      userArgument,
      previousTactics: context.previousTactics,
      transcript: transcript.slice(0, -1),
      requestId,
      enhancedMessages: request.messages,
      maxTokens: request.maxTokens,
      modelId: request.modelId,
    }).then(result => {
      setLastTurnResult(result)
      recordDebateTactic(result.tactic)
      this.onEngineEvent?.({ kind: 'turn', mode: result.engineMode, fallbackReason: result.fallbackReason })
      return result.text
    })

    const chunks = (async function* () {
      const text = await task
      if (!stopped && text) yield text
    })()

    return { requestId, chunks, stop: () => { stopped = true } }
  }

  async evaluate(messages: AiMessage[], modelId: string, context?: { debateId?: string; requestId?: string }): Promise<AiEvaluation> {
    const active = getActiveDebateEngineContext()
    if (!active) throw new Error('Debate context is not ready.')
    const transcript = this.router.transcriptFromMessages(messages)
    const result = await this.router.evaluate({
      debateId: context?.debateId || active.debateId,
      takeId: active.takeId,
      motion: active.motion,
      userSide: active.userSide,
      aiSide: active.aiSide,
      language: active.language,
      languageName: active.languageName,
      transcript,
      requestId: context?.requestId || makeUuid(),
      enhancedMessages: messages,
      modelId,
    })
    setLastEvaluationDisclaimer(result.disclaimer)
    this.onEngineEvent?.({ kind: 'evaluation', mode: result.engineMode, fallbackReason: result.fallbackReason })
    return result.evaluation
  }
}

export function createDebateEngineProvider(options: DebateEngineProviderOptions): AiProvider {
  return new DebateEngineProvider(options)
}
