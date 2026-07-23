import type { DebateEvaluationInput, DebateEvaluationResult, DebateTurnInput, DebateTurnResult } from '../lib/debateEngine/types'
import { isReliableCoreLanguage } from '../lib/debateLanguage'
import type { Language } from '../domain'
import { analyzeArgument } from './argumentAnalysis'
import { extractClaimFragment } from './claimExtraction'
import { resolveDebatePack } from './debatePacks'
import { evaluateLocally } from './evaluation'
import { composeResponse } from './responseComposer'
import { selectTactic } from './tacticSelector'
import { RELIABLE_CORE_VERSION } from './version'

export function generateDebateTurn(input: DebateTurnInput): DebateTurnResult {
  if (!isReliableCoreLanguage(input.language)) {
    throw Object.assign(new Error('Reliable Core does not support this debate language.'), { code: 'language_unsupported' })
  }
  const language = input.language as Language
  const started = Date.now()
  const pack = resolveDebatePack(input.takeId, input.motion)
  const priorUserArgs = input.transcript.filter(turn => turn.role === 'user').map(turn => turn.content)
  const signals = analyzeArgument({ argument: input.userArgument, motion: input.motion, priorArguments: priorUserArgs })
  const tactic = selectTactic({
    debateId: input.debateId,
    round: input.round,
    aiSide: input.aiSide,
    signals,
    previousTactics: input.previousTactics,
    roundLimit: input.roundLimit,
  })
  const priorOpponent = [...input.transcript].reverse().find(turn => turn.role === 'opponent')?.content
  const claimFragment = extractClaimFragment(input.userArgument)
  const text = composeResponse({
    language,
    motion: input.motion,
    aiSide: input.aiSide,
    tactic,
    claimFragment,
    debateId: input.debateId,
    round: input.round,
    priorOpponentText: priorOpponent,
  })
  void pack
  return {
    text: text || composeResponse({
      language,
      motion: input.motion,
      aiSide: input.aiSide,
      tactic: 'trade-off',
      claimFragment: null,
      debateId: input.debateId,
      round: input.round,
    }),
    engineMode: 'reliable',
    engineVersion: RELIABLE_CORE_VERSION,
    tactic,
    requestId: input.requestId,
    latencyMs: Math.round(Date.now() - started),
    generatedAt: new Date().toISOString(),
  }
}

export function evaluateDebate(input: DebateEvaluationInput): DebateEvaluationResult {
  if (!isReliableCoreLanguage(input.language)) {
    throw Object.assign(new Error('Reliable Core evaluation does not support this debate language.'), { code: 'language_unsupported' })
  }
  const language = input.language as Language
  const started = performance.now()
  const local = evaluateLocally({
    debateId: input.debateId,
    motion: input.motion,
    language,
    transcript: input.transcript,
  })
  return {
    ...local,
    engineMode: 'reliable',
    engineVersion: RELIABLE_CORE_VERSION,
    latencyMs: Math.round(Date.now() - started),
  }
}
