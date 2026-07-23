import { takeText, type AiDebateData, type DebateSnapshot, type Language, type ResultData, type Take } from './domain'
import type { AppRepository } from './data/repository'
import type { AiEvaluation, AiStartConfig } from './lib/ai/types'

export function createAiDebateCompletionGuard() {
  const active = new Set<string>()
  return {
    tryBegin(debateId: string): boolean {
      if (active.has(debateId)) return false
      active.add(debateId)
      return true
    },
    release(debateId: string) {
      active.delete(debateId)
    },
    clear() {
      active.clear()
    },
    isActive(debateId: string) {
      return active.has(debateId)
    },
  }
}

export function createInFlightGuard() {
  let inFlight = false
  return {
    tryBegin(): boolean {
      if (inFlight) return false
      inFlight = true
      return true
    },
    end() {
      inFlight = false
    },
    get active() {
      return inFlight
    },
  }
}

export function buildAiDebateCompletionPayload(input: {
  debateId: string
  transcript: AiDebateData['transcript']
  evaluation: AiEvaluation
  aiTake: Take
  aiConfig: AiStartConfig
  aiSnapshot: AiDebateData
  language: Language
  makeId: () => string
  now?: string
}): { completedDebate: DebateSnapshot; result: ResultData; completedSnapshot: AiDebateData } {
  const now = input.now || new Date().toISOString()
  const scoreRows = [
    { label: 'Clarity', score: input.evaluation.clarity, explanation: input.evaluation.strongestPoint },
    { label: 'Relevance', score: input.evaluation.relevance, explanation: input.evaluation.missedCounterargument },
    { label: 'Reasoning', score: input.evaluation.reasoning, explanation: input.evaluation.weakestAssumption },
    { label: 'Rebuttal', score: input.evaluation.rebuttal, explanation: input.evaluation.missedCounterargument },
    { label: 'Fairness', score: input.evaluation.fairness, explanation: input.evaluation.argumentDna },
  ]
  const completedSnapshot: AiDebateData = {
    ...input.aiSnapshot,
    transcript: input.transcript,
    partialResponse: '',
    interrupted: false,
    completionReason: 'completed',
  }
  const result: ResultData = {
    id: input.makeId(),
    debateId: input.debateId,
    score: scoreRows.reduce((sum, item) => sum + item.score, 0),
    movement: 0,
    understanding: 'yes',
    mode: 'classic',
    take: input.aiTake,
    assignedSide: input.aiConfig.userSide,
    transcript: input.transcript.map(turn => ({ role: turn.role, round: turn.round, content: turn.content })),
    scores: scoreRows,
    coaching: input.evaluation.argumentDna,
    completedAt: now,
    ai: {
      opponentId: input.aiConfig.opponent.id,
      family: input.aiConfig.opponent.family,
      modelId: input.aiSnapshot.modelId,
      difficulty: input.aiConfig.difficulty,
      roundLength: input.aiConfig.roundLength,
      quality: input.aiConfig.quality,
      responseLength: input.aiConfig.responseLength,
      modelSelection: input.aiConfig.modelSelection,
      roundLimit: input.aiSnapshot.roundLimit,
      customMotion: input.aiSnapshot.customMotion,
      evaluationAvailable: true,
      evaluation: input.evaluation,
    },
  }
  const completedDebate: DebateSnapshot = {
    id: input.debateId,
    takeId: input.aiTake.id,
    mode: 'classic',
    step: input.aiSnapshot.roundLimit,
    stance: 1,
    postStance: 1,
    confidence: 4,
    understanding: 'yes',
    responses: {},
    opponentMessages: {},
    assignedSide: input.aiConfig.userSide,
    language: input.language,
    status: 'completed',
    updatedAt: now,
    ai: completedSnapshot,
  }
  return { completedDebate, result, completedSnapshot }
}

export type RunAiDebateCompletionInput = {
  debateId: string
  transcript: AiDebateData['transcript']
  aiTake: Take
  aiConfig: AiStartConfig
  aiSnapshot: AiDebateData
  language: Language
  repository: AppRepository
  userId: string
  guard: ReturnType<typeof createAiDebateCompletionGuard>
  evaluate: () => Promise<AiEvaluation>
  makeId: () => string
}

export type RunAiDebateCompletionResult =
  | { status: 'aborted' }
  | { status: 'success'; result: ResultData; completedDebate: DebateSnapshot; completedSnapshot: AiDebateData }

export async function runAiDebateCompletion(input: RunAiDebateCompletionInput): Promise<RunAiDebateCompletionResult> {
  if (!input.guard.tryBegin(input.debateId)) return { status: 'aborted' }
  try {
    const evaluation = await input.evaluate()
    const payload = buildAiDebateCompletionPayload({
      debateId: input.debateId,
      transcript: input.transcript,
      evaluation,
      aiTake: input.aiTake,
      aiConfig: input.aiConfig,
      aiSnapshot: input.aiSnapshot,
      language: input.language,
      makeId: input.makeId,
    })
    await input.repository.saveDebateWithResult(input.userId, payload.completedDebate, payload.result)
    return { status: 'success', ...payload }
  } catch (error) {
    input.guard.release(input.debateId)
    throw error
  }
}

export function aiDebateMotion(aiTake: Take, language: Language, customMotion: string | null | undefined) {
  return customMotion || takeText(aiTake, language).statement
}
