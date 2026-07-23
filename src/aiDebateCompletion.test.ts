import { beforeEach, describe, expect, it } from 'vitest'
import { getTake } from './domain'
import { createLocalRepository } from './data/localRepository'
import { STORAGE_KEY } from './storage'
import { createAiDebateCompletionGuard, createInFlightGuard, runAiDebateCompletion, type RunAiDebateCompletionInput } from './aiDebateCompletion'
import type { AiEvaluation, AiStartConfig } from './lib/ai/types'
import { basicOpponent } from './lib/ai/opponents'
import type { AiDebateData } from './domain'
import type { AppRepository } from './data/repository'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } } })

const userId = 'local-user'
const debateId = '11111111-1111-4111-8111-111111111111'
const aiTake = getTake('society-media-age')
const evaluation: AiEvaluation = {
  clarity: 14,
  relevance: 14,
  reasoning: 13,
  rebuttal: 12,
  fairness: 15,
  strongestPoint: 'Specific claim.',
  weakestAssumption: 'Could be broader.',
  missedCounterargument: 'A cost trade-off.',
  unansweredOpponentPoint: 'Long-term effect.',
  improvedExampleResponse: 'A clearer response.',
  argumentDna: 'Balanced and concrete.',
  concession: 'none',
}
const aiConfig = {
  opponent: { ...basicOpponent, available: true, model: { id: 'sideshift-basic', provider: 'basic', name: 'Basic', aliases: [], context: null, maxTokens: null, inputCost: null, outputCost: null, supportsText: true, supportsChat: true, supportsStreaming: true, isLegacy: false, raw: {} }, models: [], selection: 'automatic' as const },
  difficulty: 'intermediate' as const,
  roundLength: 'quick' as const,
  quality: 'balanced' as const,
  responseLength: 'standard' as const,
  modelSelection: 'automatic' as const,
  userSide: aiTake.supportLabel,
  aiSide: aiTake.opposeLabel,
  customMotion: null,
} satisfies AiStartConfig
const aiSnapshot: AiDebateData = {
  opponentId: 'sideshift-basic',
  family: 'GPT',
  modelId: 'sideshift-basic',
  difficulty: 'intermediate',
  roundLength: 'quick',
  quality: 'balanced',
  responseLength: 'standard',
  modelSelection: 'automatic',
  roundLimit: 3,
  userSide: aiTake.supportLabel,
  aiSide: aiTake.opposeLabel,
  customMotion: null,
  transcript: [
    { role: 'user', round: 1, content: 'A first argument with enough detail to submit.' },
    { role: 'opponent', round: 1, content: 'A counterpoint with enough detail to respond.' },
  ],
  partialResponse: '',
  interrupted: false,
  completionReason: null,
}
const transcript = aiSnapshot.transcript

function buildInput(overrides: Partial<RunAiDebateCompletionInput> = {}): RunAiDebateCompletionInput {
  const guard = createAiDebateCompletionGuard()
  return {
    debateId,
    transcript,
    aiTake,
    aiConfig,
    aiSnapshot,
    language: 'en',
    repository: createLocalRepository(),
    userId,
    guard,
    makeId: () => '22222222-2222-4222-8222-222222222222',
    evaluate: async () => evaluation,
    ...overrides,
  }
}

function trackingRepository(base: AppRepository, handlers: { onSave?: () => void | Promise<void> } = {}) {
  let saveCount = 0
  const repository: AppRepository = {
    ...base,
    async saveDebateWithResult(userIdArg, debate, result) {
      saveCount += 1
      await handlers.onSave?.()
      return base.saveDebateWithResult(userIdArg, debate, result)
    },
  }
  return { repository, saveCount: () => saveCount }
}

describe('AI debate completion flow', () => {
  beforeEach(() => values.clear())

  it('persists evaluation and navigates contract exactly once on success', async () => {
    const { repository, saveCount } = trackingRepository(createLocalRepository())
    let evaluateCount = 0
    const input = buildInput({
      repository,
      evaluate: async () => { evaluateCount += 1; return evaluation },
    })
    const outcome = await runAiDebateCompletion(input)
    expect(outcome.status).toBe('success')
    expect(evaluateCount).toBe(1)
    expect(saveCount()).toBe(1)
    const debate = await repository.loadDebate(userId)
    const result = await repository.loadResult(userId)
    expect(debate?.status).toBe('completed')
    expect(result?.debateId).toBe(debateId)
    expect(input.guard.isActive(debateId)).toBe(true)
  })

  it('does not persist when evaluation fails and releases the completion guard', async () => {
    const { repository, saveCount } = trackingRepository(createLocalRepository())
    const input = buildInput({ evaluate: async () => { throw new Error('Evaluation unavailable.') } })
    await expect(runAiDebateCompletion(input)).rejects.toThrow('Evaluation unavailable.')
    expect(saveCount()).toBe(0)
    expect(await repository.loadDebate(userId)).toBeNull()
    expect(input.guard.isActive(debateId)).toBe(false)
  })

  it('allows retry after evaluation failure and completes successfully', async () => {
    const { repository } = trackingRepository(createLocalRepository())
    const guard = createAiDebateCompletionGuard()
    let attempts = 0
    const shared = {
      debateId,
      transcript,
      aiTake,
      aiConfig,
      aiSnapshot,
      language: 'en' as const,
      repository,
      userId,
      guard,
      makeId: () => '33333333-3333-4333-8333-333333333333',
      evaluate: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('Evaluation unavailable.')
        return evaluation
      },
    }
    await expect(runAiDebateCompletion(shared)).rejects.toThrow('Evaluation unavailable.')
    const outcome = await runAiDebateCompletion(shared)
    expect(outcome.status).toBe('success')
    expect(attempts).toBe(2)
  })

  it('does not treat save failure as completion and releases the guard for retry', async () => {
    const base = createLocalRepository()
    let saveAttempts = 0
    const repository: AppRepository = {
      ...base,
      async saveDebateWithResult() {
        saveAttempts += 1
        throw new Error('Result persistence failed.')
      },
    }
    const guard = createAiDebateCompletionGuard()
    const shared = buildInput({ repository, guard })
    await expect(runAiDebateCompletion(shared)).rejects.toThrow('Result persistence failed.')
    expect(saveAttempts).toBe(1)
    expect(guard.isActive(debateId)).toBe(false)
    const retryRepository = trackingRepository(createLocalRepository())
    const retry = await runAiDebateCompletion({ ...shared, repository: retryRepository.repository })
    expect(retry.status).toBe('success')
    expect(retryRepository.saveCount()).toBe(1)
  })

  it('blocks rapid duplicate completion so evaluation runs only once', async () => {
    const { repository } = trackingRepository(createLocalRepository())
    const guard = createAiDebateCompletionGuard()
    let evaluateCount = 0
    const shared = {
      debateId,
      transcript,
      aiTake,
      aiConfig,
      aiSnapshot,
      language: 'en' as const,
      repository,
      userId,
      guard,
      makeId: () => '44444444-4444-4444-8444-444444444444',
      evaluate: async () => {
        evaluateCount += 1
        await new Promise(resolve => setTimeout(resolve, 20))
        return evaluation
      },
    }
    const [first, second] = await Promise.all([runAiDebateCompletion(shared), runAiDebateCompletion(shared)])
    expect(evaluateCount).toBe(1)
    expect([first.status, second.status].sort()).toEqual(['aborted', 'success'])
  })

  it('does not duplicate result persistence on successful retry after save failure', async () => {
    const base = createLocalRepository()
    let saveAttempts = 0
    const repository: AppRepository = {
      ...base,
      async saveDebateWithResult(userIdArg, debate, result) {
        saveAttempts += 1
        if (saveAttempts === 1) throw new Error('Result persistence failed.')
        return base.saveDebateWithResult(userIdArg, debate, result)
      },
    }
    const guard = createAiDebateCompletionGuard()
    const shared = buildInput({ repository, guard, makeId: () => '55555555-5555-4555-8555-555555555555' })
    await expect(runAiDebateCompletion(shared)).rejects.toThrow('Result persistence failed.')
    const outcome = await runAiDebateCompletion(shared)
    expect(outcome.status).toBe('success')
    expect(saveAttempts).toBe(2)
    const stored = JSON.parse(values.get(STORAGE_KEY) || '{}')
    expect(stored.result?.debateId).toBe(debateId)
    expect(stored.debate?.status).toBe('completed')
  })

  it('uses a synchronous in-flight guard for duplicate finish attempts', async () => {
    const guard = createInFlightGuard()
    let runs = 0
    async function finish() {
      if (!guard.tryBegin()) return
      try {
        runs += 1
        await new Promise(resolve => setTimeout(resolve, 15))
      } finally {
        guard.end()
      }
    }
    await Promise.all([finish(), finish()])
    expect(runs).toBe(1)
    expect(guard.active).toBe(false)
  })
})

describe('saveDebateWithResult repository contract', () => {
  beforeEach(() => values.clear())

  it('keeps local debate completion and result atomic', async () => {
    const repository = createLocalRepository()
    const activeDebate = {
      id: debateId,
      takeId: aiTake.id,
      mode: 'classic' as const,
      step: 3,
      stance: 1 as const,
      postStance: 1 as const,
      confidence: 4 as const,
      understanding: 'yes' as const,
      responses: {},
      opponentMessages: {},
      assignedSide: aiConfig.userSide,
      language: 'en' as const,
      status: 'active' as const,
      updatedAt: new Date().toISOString(),
      ai: aiSnapshot,
    }
    await repository.saveDebate(userId, activeDebate)
    const payload = buildInput()
    const outcome = await runAiDebateCompletion(payload)
    if (outcome.status !== 'success') throw new Error('expected success')
    const stored = JSON.parse(values.get(STORAGE_KEY) || '{}')
    expect(stored.debate?.status).toBe('completed')
    expect(stored.result?.debateId).toBe(debateId)
  })

  it('never leaves a completed debate without a matching result in local persistence', async () => {
    const repository = createLocalRepository()
    const failingRepository: AppRepository = {
      ...repository,
      async saveDebateWithResult(userIdArg, debate, result) {
        await repository.saveResult(userIdArg, result)
        throw new Error('debate save failed')
      },
    }
    const input = buildInput({ repository: failingRepository })
    await expect(runAiDebateCompletion(input)).rejects.toThrow('debate save failed')
    const stored = JSON.parse(values.get(STORAGE_KEY) || '{}')
    expect(stored.debate?.status).not.toBe('completed')
    expect(stored.result?.debateId).toBe(debateId)
    expect(input.guard.isActive(debateId)).toBe(false)
  })
})
