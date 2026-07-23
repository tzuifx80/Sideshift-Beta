import { getTake, takes, type DebateSnapshot, type ResultData, type Take } from '../domain'
import type { AiStartConfig } from './ai/types'

export type DebateRecoveryIssue = 'missing_ai_config'

export function resolveCatalogueTake(takeId: string): Take | null {
  return takes.find(take => take.id === takeId) ?? null
}

export function buildStablePrivateTake(motion: string, baseTake: Take, takeId?: string): Take {
  const stableId = takeId?.startsWith('private-') ? takeId : `private-${takeId || 'draft'}`
  return {
    ...baseTake,
    id: stableId,
    statement: motion,
    statementDe: motion,
    context: 'Private motion created only for this debate.',
    contextDe: 'Private motion created only for this debate.',
  }
}

export function resolveDebateTake(input: {
  debate: DebateSnapshot | null
  result: ResultData | null
  fallbackTakeId?: string
}): Take {
  const activeDebate = input.debate?.status === 'active' ? input.debate : null
  if (activeDebate) {
    const takeId = activeDebate.takeId
    const catalogueBase = resolveCatalogueTake(takeId) || resolveCatalogueTake(input.fallbackTakeId || '') || takes[0]
    if (activeDebate.worldPulse) {
      return {
        ...catalogueBase,
        id: `world-pulse:${activeDebate.worldPulse.id}`,
        category: activeDebate.worldPulse.category,
        statement: activeDebate.worldPulse.debateStatement,
        context: activeDebate.worldPulse.neutralContext,
        supportLabel: activeDebate.worldPulse.sideALabel,
        opposeLabel: activeDebate.worldPulse.sideBLabel,
        worldPulse: activeDebate.worldPulse,
      }
    }
    if (activeDebate.ai?.customMotion) {
      return buildStablePrivateTake(activeDebate.ai.customMotion, catalogueBase, takeId)
    }
    if (takeId.startsWith('private-')) {
      return buildStablePrivateTake(catalogueBase.statement, catalogueBase, takeId)
    }
    return resolveCatalogueTake(takeId) || catalogueBase
  }
  if (input.result?.take) return input.result.take
  return getTake(input.fallbackTakeId || takes[0].id)
}

export function assessDebateRecovery(debate: DebateSnapshot | null, aiConfig: AiStartConfig | null): DebateRecoveryIssue | null {
  if (!debate || debate.status !== 'active') return null
  if (debate.ai && !aiConfig) return 'missing_ai_config'
  return null
}

export function debateOwnedTakeId(debate: DebateSnapshot | null, aiTake: Take, activeTake: Take): string {
  if (debate?.status === 'active') return debate.takeId
  return aiTake.id || activeTake.id
}

export function selectedTakeWouldMutateDebate(debate: DebateSnapshot | null, selectedTakeId: string): boolean {
  return Boolean(debate?.status === 'active' && debate.takeId !== selectedTakeId)
}
