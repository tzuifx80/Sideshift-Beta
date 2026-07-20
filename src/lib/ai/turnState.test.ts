import { describe, expect, it } from 'vitest'
import type { AiDebateData } from '../../domain'
import { basicTurnRequestId, prepareBasicTurn, shouldAcceptBasicTurnResponse } from './turnState'

const snapshot = (transcript: AiDebateData['transcript'] = []): AiDebateData => ({
  opponentId: 'sideshift-basic', family: 'GPT', modelId: 'sideshift-basic', difficulty: 'intermediate',
  roundLength: 'quick', quality: 'balanced', responseLength: 'standard', modelSelection: 'automatic',
  roundLimit: 3, userSide: 'support', aiSide: 'challenge', customMotion: null,
  transcript, partialResponse: '', interrupted: false, completionReason: null,
})

describe('SideShift Basic turn state', () => {
  it('creates one stable, distinct id for each turn', () => {
    expect(basicTurnRequestId('debate-1', 1)).toBe('debate-1-turn-1')
    expect(basicTurnRequestId('debate-1', 2)).not.toBe(basicTurnRequestId('debate-1', 1))
    expect(basicTurnRequestId('debate-1', 3)).not.toBe(basicTurnRequestId('debate-1', 2))
  })

  it('keeps the idempotency identity valid for the Android request header', () => {
    const requestId = basicTurnRequestId('debate:with/unsafe-id', 2)
    expect(requestId).toMatch(/^[A-Za-z0-9._-]{1,80}$/)
  })

  it('prepares three turns and retries a pending user turn without duplicating it', () => {
    const first = prepareBasicTurn(snapshot(), 'debate-1', 'The first argument is long enough to submit.')
    expect(first).toMatchObject({ round: 1, requestId: 'debate-1-turn-1' })
    const afterFirst = snapshot([
      { role: 'user', round: 1, content: first!.argument },
      { role: 'opponent', round: 1, content: 'The first response.' },
    ])
    const second = prepareBasicTurn(afterFirst, 'debate-1', 'The second argument is also long enough.')
    expect(second).toMatchObject({ round: 2, requestId: 'debate-1-turn-2' })
    const pendingSecond = snapshot([...afterFirst.transcript, { role: 'user', round: 2, content: second!.argument }])
    const retry = prepareBasicTurn(pendingSecond, 'debate-1', '')
    expect(retry).toMatchObject({ round: 2, requestId: 'debate-1-turn-2' })
    expect(retry?.transcript).toHaveLength(3)
    const third = prepareBasicTurn(snapshot([...pendingSecond.transcript, { role: 'opponent', round: 2, content: 'The second response.' }]), 'debate-1', 'A third argument with enough detail.')
    expect(third).toMatchObject({ round: 3, requestId: 'debate-1-turn-3' })
  })

  it('rejects a response from another turn or debate', () => {
    expect(shouldAcceptBasicTurnResponse({ expectedRequestId: basicTurnRequestId('debate-1', 2), requestId: basicTurnRequestId('debate-1', 1) })).toBe(false)
    expect(shouldAcceptBasicTurnResponse({ expectedRequestId: basicTurnRequestId('debate-1', 2), requestId: basicTurnRequestId('debate-2', 2) })).toBe(false)
    expect(shouldAcceptBasicTurnResponse({ expectedRequestId: basicTurnRequestId('debate-1', 2), requestId: basicTurnRequestId('debate-1', 2) })).toBe(true)
  })
})
