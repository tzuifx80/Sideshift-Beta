export type AiConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed'
export type AiProviderKind = 'mock' | 'basic' | 'puter'
export type AiRuntimeStatus = 'mock' | 'basic_checking' | 'basic_available' | 'basic_unavailable' | 'basic_rate_limited' | 'basic_quota_exhausted' | 'puter_disconnected' | 'puter_connecting' | 'puter_connected' | 'puter_error'
export type AiRuntimeSnapshot = { primary: AiRuntimeStatus; puter: AiRuntimeStatus; basicServer: 'basic_available' | 'basic_unavailable' }
export type AiFamily = 'Gemini' | 'Claude' | 'GPT' | 'DeepSeek'
export type AiDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type AiRoundLength = 'quick' | 'standard' | 'deep'
export type AiQuality = 'fast' | 'balanced' | 'maximum'
export type AiResponseLength = 'concise' | 'standard' | 'detailed'
export type AiModelSelection = 'automatic' | 'exact'
export type PreferredOpponentType = 'ask' | 'ai' | 'person'
export type AiFeedbackType = 'helpful' | 'not_helpful' | 'incorrect' | 'too_long' | 'missed_point'

export type AiModel = {
  id: string
  provider: string
  name: string
  aliases: string[]
  context: number | null
  maxTokens: number | null
  inputCost: number | null
  outputCost: number | null
  supportsText: boolean
  supportsChat: boolean
  supportsStreaming: boolean
  isLegacy: boolean
  raw: Record<string, unknown>
}

export type AiOpponent = {
  id: string
  displayName: string
  family: AiFamily
  description: string
  icon: string
  stylePrompt: string
  approvedModelRules: string
  maxResponseTokens: number
}

export type ResolvedOpponent = AiOpponent & {
  available: boolean
  model: AiModel | null
  models: AiModel[]
  selection: AiModelSelection
}

export type AiUsage = {
  remaining: number | null
  allowance: number | null
  units: string | null
  allowed?: boolean
  debatesRemaining?: number
  turnsRemaining?: number
  evaluationsRemaining?: number
  resetsAt?: string
  reason?: 'quota_exhausted' | 'rate_limited' | 'provider_unavailable' | 'invalid_request'
}

export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type AiChatRequest = {
  modelId: string
  messages: AiMessage[]
  maxTokens: number
  temperature?: number
  debateId?: string
  round?: number
  requestId?: string
}

export type AiStream = {
  requestId: string
  chunks: AsyncIterable<string>
  stop: () => void
}

export type AiEvaluation = {
  clarity: number
  relevance: number
  reasoning: number
  rebuttal: number
  fairness: number
  strongestPoint: string
  weakestAssumption: string
  missedCounterargument: string
  improvedExampleResponse: string
  argumentDna: string
  unansweredOpponentPoint?: string
  concession?: 'user' | 'opponent' | 'both' | 'none'
}

export type AiProvider = {
  readonly kind: AiProviderKind
  getStatus: () => Promise<AiConnectionStatus>
  connect: () => Promise<void>
  listModels: (forceRefresh?: boolean) => Promise<AiModel[]>
  getUsage: () => Promise<AiUsage | null>
  streamChat: (request: AiChatRequest) => Promise<AiStream>
  evaluate: (messages: AiMessage[], modelId: string, context?: { debateId?: string; requestId?: string }) => Promise<AiEvaluation>
}

export type AiStartConfig = {
  opponent: ResolvedOpponent
  difficulty: AiDifficulty
  roundLength: AiRoundLength
  quality: AiQuality
  responseLength: AiResponseLength
  modelSelection: AiModelSelection
  userSide: string
  aiSide: string
  customMotion: string | null
}
