import { seededIndex } from './seed'
import { tacticForSignals, TACTIC_IDS, type TacticId } from './tactics'
import type { ArgumentSignals } from './argumentAnalysis'

export function selectTactic(input: {
  debateId: string
  round: number
  aiSide: string
  signals: ArgumentSignals
  previousTactics: string[]
  roundLimit: number
}): TacticId {
  const candidates = tacticForSignals(input.signals, input.round, input.roundLimit)
  const unused = candidates.filter(id => !input.previousTactics.includes(id))
  const pool = unused.length ? unused : TACTIC_IDS.filter(id => !input.previousTactics.includes(id))
  const finalPool = pool.length ? pool : [...TACTIC_IDS]
  const seed = `${input.debateId}:${input.round}:${input.aiSide}`
  return finalPool[seededIndex(seed, finalPool.length)]
}
