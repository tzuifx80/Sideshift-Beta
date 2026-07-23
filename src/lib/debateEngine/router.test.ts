import { describe, expect, it, vi } from 'vitest'
import { takes } from '../../domain'
import { createDebateEngineRouter } from './router'
import { createMockAiProvider } from '../ai/provider'

describe('debate engine router', () => {
  it('falls back to reliable core when hosted enhancement fails', async () => {
    const failing = createMockAiProvider({ connectError: new Error('down') })
    const router = createDebateEngineRouter({
      online: () => true,
      enhancedProvider: failing,
      deadlineMs: 50,
    })
    const result = await router.generateTurn({
      debateId: 'router-1',
      takeId: 'society-media-age',
      motion: 'Social media does more harm than good for teenagers',
      userSide: 'Pro',
      aiSide: 'Con',
      language: 'en',
      round: 1,
      roundLimit: 3,
      userArgument: 'Teenagers need supportive communities that social platforms can provide.',
      previousTactics: [],
      transcript: [],
      requestId: 'router-1-turn-1',
    })
    expect(result.engineMode).toBe('reliable')
    expect(result.text.trim().length).toBeGreaterThan(10)
    expect(result.fallbackReason).toBeTruthy()
  })

  it('uses reliable core immediately when offline', async () => {
    const router = createDebateEngineRouter({
      online: () => false,
      enhancedProvider: createMockAiProvider(),
    })
    const result = await router.generateTurn({
      debateId: 'router-offline',
      takeId: 'society-media-age',
      motion: 'Social media does more harm than good for teenagers',
      userSide: 'Pro',
      aiSide: 'Con',
      language: 'en',
      round: 1,
      roundLimit: 3,
      userArgument: 'Platforms can connect isolated students to mentors.',
      previousTactics: [],
      transcript: [],
      requestId: 'router-offline-1',
    })
    expect(result.engineMode).toBe('reliable')
    expect(result.fallbackReason).toBe('offline')
  })

  it('does not call hosted evaluation when offline', async () => {
    const evaluate = vi.fn()
    const enhanced = {
      ...createMockAiProvider(),
      evaluate,
    }
    const router = createDebateEngineRouter({
      online: () => false,
      enhancedProvider: enhanced,
    })
    const result = await router.evaluate({
      debateId: 'router-eval',
      takeId: 'society-media-age',
      motion: 'Social media does more harm than good for teenagers',
      userSide: 'Pro',
      aiSide: 'Con',
      language: 'en',
      transcript: [{ role: 'user', round: 1, content: 'A structured argument with trade-offs and scope.' }],
      requestId: 'router-eval-1',
    })
    expect(evaluate).not.toHaveBeenCalled()
    expect(result.engineMode).toBe('reliable')
  })

  it('returns cached turn for the same request id', async () => {
    const router = createDebateEngineRouter({
      online: () => false,
      enhancedProvider: createMockAiProvider(),
    })
    const input = {
      debateId: 'router-cache',
      takeId: takes[0].id,
      motion: takes[0].statement,
      userSide: takes[0].supportLabel,
      aiSide: takes[0].opposeLabel,
      language: 'en' as const,
      round: 1,
      roundLimit: 3,
      userArgument: 'A clear argument with trade-offs and scope.',
      previousTactics: [] as string[],
      transcript: [] as Array<{ role: 'user' | 'opponent'; round: number; content: string }>,
      requestId: 'router-cache-req',
    }
    const first = await router.generateTurn(input)
    const second = await router.generateTurn(input)
    expect(second.text).toBe(first.text)
    expect(second.tactic).toBe('cached')
  })
})
