export type ProviderKind = 'groq' | 'cloudflare' | 'gemini'

export type TaskKind = 'opponent' | 'evaluation'

export type AiRole = 'system' | 'user' | 'assistant'

export type AiMessage = { role: AiRole; content: string }

export type ProviderErrorCode =
  | 'provider_unavailable'
  | 'ai_unavailable'
  | 'rate_limited'
  | 'auth_failed'
  | 'safety_rejected'
  | 'timeout'
  | 'invalid_response'

export type ProviderError = Error & { code: ProviderErrorCode; status?: number; retryable: boolean }

export type ProviderRequest = {
  messages: AiMessage[]
  maxTokens: number
  temperature: number
  task: TaskKind
  signal?: AbortSignal
}

export type ProviderRawResult = {
  content: string
  provider: ProviderKind
  model: string
  finishReason?: string
  latencyMs: number
}

export type RoutedResult = ProviderRawResult & {
  fallbackUsed: boolean
  attemptCount: number
  primaryProvider: ProviderKind
  selectedProvider: ProviderKind
}

export type ResponseMetadata = {
  provider: string
  model: string
  requestId: string
  finishReason?: string
  latencyMs: number
  fallbackUsed: boolean
  attemptCount: number
}
