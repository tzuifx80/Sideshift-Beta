import { makeUuid } from '../../domain'
import { normalizeAiError, AiProviderError } from './errors'
import { normalizeModels } from './modelResolver'
import type { AiEvaluation, AiMessage, AiModel, AiProvider, AiStream, AiUsage } from './types'

export function createMockAiProvider(options: { models?: unknown[]; response?: string; evaluation?: AiEvaluation; connectError?: unknown; streamDelayMs?: number } = {}): AiProvider {
  let connected = false
  const models = normalizeModels(options.models || [{ id: 'gpt-5-mini', provider: 'openai', name: 'GPT 5 mini', max_tokens: 1024, cost: { input: 1, output: 2 } }])
  const response = options.response || 'I can see why that point matters. The strongest counterpoint is the trade-off you accept when the same rule affects people differently. What evidence would make you revise your position?'
  const evaluation = options.evaluation || { clarity: 15, relevance: 14, reasoning: 15, rebuttal: 13, fairness: 16, strongestPoint: 'You made a clear, specific claim.', weakestAssumption: 'The main assumption could be stated more explicitly.', missedCounterargument: 'The strongest trade-off deserved one direct response.', unansweredOpponentPoint: 'The opponent’s latest trade-off still needed a direct answer.', improvedExampleResponse: 'A stronger version would name the trade-off and the evidence that would change your mind.', argumentDna: 'Clear trade-offs with room for sharper assumptions.', concession: 'none' as const }
  return {
    async getStatus() { return connected ? 'connected' : 'disconnected' },
    async connect() { if (options.connectError) throw normalizeAiError(options.connectError); connected = true },
    async listModels() { if (!connected) throw new AiProviderError('connection_required', 'Connect Puter before discovering AI models.'); return models },
    async getUsage(): Promise<AiUsage | null> { if (!connected) return null; return { remaining: 100, allowance: 100, units: 'mock units' } },
    async streamChat(): Promise<AiStream> {
      if (!connected) throw new AiProviderError('connection_required', 'Connect Puter before starting an AI debate.')
      let stopped = false
      const requestId = makeUuid()
      const chunks = (async function* () {
        for (const chunk of response.match(/.{1,24}(?:\s|$)/g) || [response]) {
          if (stopped) return
          if (options.streamDelayMs) await new Promise(resolve => setTimeout(resolve, options.streamDelayMs))
          yield chunk
        }
      })()
      return { requestId, chunks, stop: () => { stopped = true } }
    },
    async evaluate(): Promise<AiEvaluation> { if (!connected) throw new AiProviderError('connection_required', 'Connect Puter before evaluating the debate.'); return evaluation },
  }
}

export { normalizeAiError }
