import { describe, expect, it } from 'vitest'
import { getTake, takes, type AiDebateData, type DebateSnapshot, type ResultData } from '../domain'
import { basicOpponent } from './ai/opponents'
import type { AiStartConfig } from './ai/types'
import {
  assessDebateRecovery,
  buildStablePrivateTake,
  debateOwnedTakeId,
  resolveDebateTake,
  selectedTakeWouldMutateDebate,
} from './debateRecovery'

const takeA = getTake('society-media-age')
const takeB = getTake('society-smartphones')

function activeAiDebate(takeId: string, customMotion: string | null = null): DebateSnapshot {
  const ai: AiDebateData = {
    opponentId: 'sideshift-basic',
    family: 'GPT',
    modelId: 'sideshift-basic',
    difficulty: 'intermediate',
    roundLength: 'quick',
    quality: 'balanced',
    responseLength: 'standard',
    modelSelection: 'automatic',
    roundLimit: 3,
    userSide: takeA.supportLabel,
    aiSide: takeA.opposeLabel,
    customMotion,
    transcript: [{ role: 'user', round: 1, content: 'A detailed opening argument for round one.' }],
    partialResponse: '',
    interrupted: false,
    completionReason: null,
  }
  return {
    id: 'debate-1',
    takeId,
    mode: 'classic',
    step: 1,
    stance: 1,
    postStance: 1,
    confidence: 4,
    understanding: 'yes',
    responses: {},
    opponentMessages: {},
    assignedSide: takeA.supportLabel,
    language: 'en',
    status: 'active',
    updatedAt: '2026-07-23T00:00:00.000Z',
    ai,
  }
}

const completedResult: ResultData = {
  id: 'result-1',
  debateId: 'old-debate',
  score: 70,
  movement: 0,
  understanding: 'yes',
  mode: 'classic',
  take: takeB,
  assignedSide: takeB.supportLabel,
  transcript: [],
  scores: [],
  coaching: 'Solid.',
  completedAt: '2026-07-22T00:00:00.000Z',
}

const validAiConfig = {
  opponent: { ...basicOpponent, available: true, model: { id: 'sideshift-basic', provider: 'basic', name: 'Basic', aliases: [], context: null, maxTokens: null, inputCost: null, outputCost: null, supportsText: true, supportsChat: true, supportsStreaming: true, isLegacy: false, raw: {} }, models: [], selection: 'automatic' as const },
  difficulty: 'intermediate' as const,
  roundLength: 'quick' as const,
  quality: 'balanced' as const,
  responseLength: 'standard' as const,
  modelSelection: 'automatic' as const,
  userSide: takeA.supportLabel,
  aiSide: takeA.opposeLabel,
  customMotion: null,
  debateLanguageMode: 'explicit',
  debateLanguageCode: 'en',
} satisfies AiStartConfig

describe('debateRecovery', () => {
  it('restores the active debate take instead of a previous result take', () => {
    const debate = activeAiDebate(takeA.id)
    const restored = resolveDebateTake({ debate, result: completedResult })
    expect(restored.id).toBe(takeA.id)
    expect(restored.id).not.toBe(takeB.id)
  })

  it('keeps a stable private take id across restore', () => {
    const debate = activeAiDebate('private-stable-1', 'Should cities ban cars downtown?')
    const first = resolveDebateTake({ debate, result: null })
    const second = resolveDebateTake({ debate, result: null })
    expect(first.id).toBe('private-stable-1')
    expect(second.id).toBe(first.id)
    expect(first.statement).toBe('Should cities ban cars downtown?')
  })

  it('does not let a newer selected take mutate an active debate-owned id', () => {
    const debate = activeAiDebate(takeA.id)
    expect(selectedTakeWouldMutateDebate(debate, takeB.id)).toBe(true)
    expect(selectedTakeWouldMutateDebate(debate, takeA.id)).toBe(false)
  })

  it('uses debate-owned take id for autosave', () => {
    const debate = activeAiDebate(takeA.id)
    expect(debateOwnedTakeId(debate, takeB, takeB)).toBe(takeA.id)
  })

  it('reports missing ai config as a recovery issue', () => {
    const debate = activeAiDebate(takeA.id)
    expect(assessDebateRecovery(debate, null)).toBe('missing_ai_config')
    expect(assessDebateRecovery(debate, validAiConfig)).toBeNull()
  })

  it('falls back to result take only when no active debate exists', () => {
    const restored = resolveDebateTake({ debate: null, result: completedResult })
    expect(restored.id).toBe(takeB.id)
  })

  it('buildStablePrivateTake preserves the persisted take id', () => {
    const built = buildStablePrivateTake('Custom motion', takes[0], 'private-abc')
    expect(built.id).toBe('private-abc')
    expect(built.statement).toBe('Custom motion')
  })
})
