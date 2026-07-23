import type { DebateLanguageCode } from '../../domain'
import type { AiEvaluation } from '../ai/types'

export type DebateEngineMode = 'enhanced' | 'reliable'

export type DebateFallbackReason =
  | 'offline'
  | 'timeout'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'invalid_response'
  | 'circuit_open'
  | 'worker_unreachable'

export type DebateTurnInput = {
  debateId: string
  takeId: string
  motion: string
  userSide: string
  aiSide: string
  language: DebateLanguageCode
  languageName?: string
  round: number
  roundLimit: number
  userArgument: string
  previousTactics: string[]
  transcript: Array<{ role: 'user' | 'opponent'; round: number; content: string }>
  requestId: string
  signal?: AbortSignal
  enhancedMessages?: import('../ai/types').AiMessage[]
  maxTokens?: number
  temperature?: number
  modelId?: string
  repairHint?: string
}

export type DebateTurnResult = {
  text: string
  engineMode: DebateEngineMode
  engineVersion: string
  tactic: string
  requestId: string
  fallbackReason?: DebateFallbackReason
  latencyMs: number
  generatedAt: string
}

export type DebateEvaluationInput = {
  debateId: string
  takeId: string
  motion: string
  userSide: string
  aiSide: string
  language: DebateLanguageCode
  languageName?: string
  transcript: Array<{ role: 'user' | 'opponent'; round: number; content: string }>
  requestId: string
  signal?: AbortSignal
  enhancedMessages?: import('../ai/types').AiMessage[]
  modelId?: string
  repairHint?: string
  skipQuota?: boolean
}

export type DebateEvaluationResult = {
  evaluation: AiEvaluation
  overallScore: number
  reasoning: string
  evidence: string
  responsiveness: string
  clarity: string
  strongestPoint: string
  improvementArea: string
  conciseSummary: string
  disclaimer: string
  engineMode: DebateEngineMode
  engineVersion: string
  fallbackReason?: DebateFallbackReason
  latencyMs: number
}

export type DebateEngineStatus = {
  reliableAvailable: true
  enhancementAvailable: boolean
  enhancementReason?: string
}
