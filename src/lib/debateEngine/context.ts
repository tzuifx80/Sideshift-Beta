import type { DebateLanguageCode } from '../../domain'

import type { DebateTurnResult } from './types'

export type ActiveDebateEngineContext = {
  debateId: string
  takeId: string
  motion: string
  userSide: string
  aiSide: string
  language: DebateLanguageCode
  languageName?: string
  roundLimit: number
  previousTactics: string[]
}

let active: ActiveDebateEngineContext | null = null
let lastTurnResult: DebateTurnResult | null = null
let lastEvaluationDisclaimer: string | null = null

export function setActiveDebateEngineContext(context: ActiveDebateEngineContext | null) {
  active = context
}

export function getActiveDebateEngineContext(): ActiveDebateEngineContext | null {
  return active
}

export function recordDebateTactic(tactic: string) {
  if (!active || active.previousTactics.includes(tactic)) return
  active = { ...active, previousTactics: [...active.previousTactics, tactic] }
}

export function setLastTurnResult(result: DebateTurnResult | null) {
  lastTurnResult = result
}

export function consumeLastTurnResult(): DebateTurnResult | null {
  const result = lastTurnResult
  lastTurnResult = null
  return result
}

export function setLastEvaluationDisclaimer(disclaimer: string | null) {
  lastEvaluationDisclaimer = disclaimer
}

export function consumeLastEvaluationDisclaimer(): string | null {
  const disclaimer = lastEvaluationDisclaimer
  lastEvaluationDisclaimer = null
  return disclaimer
}
