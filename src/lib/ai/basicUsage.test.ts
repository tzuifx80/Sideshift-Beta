import { describe, expect, it } from 'vitest'
import { basicUsageResponse, freeEntitlements, requestScope, utcDateKey } from './basicUsage'

describe('SideShift Basic usage contract', () => {
  it('resets by UTC date and exposes free entitlements only', () => {
    expect(utcDateKey('2026-07-19T23:59:59.000Z')).toBe('2026-07-19')
    expect(utcDateKey('2026-07-20T00:00:00.000Z')).toBe('2026-07-20')
    expect(freeEntitlements({ BASIC_AI_DAILY_DEBATES: '3', BASIC_AI_MAX_ROUNDS: '3' })).toMatchObject({ plan: 'free', basicDebatesPerDay: 3, basicMaxRounds: 3, advancedReplayEnabled: false })
  })

  it('reports remaining usage without trusting client plan values', () => {
    expect(basicUsageResponse({ debatesStarted: 2, turnsGenerated: 1, entitlements: freeEntitlements(), now: new Date('2026-07-19T12:00:00.000Z') })).toMatchObject({ allowed: true, debatesRemaining: 1, turnsRemaining: 2, resetsAt: '2026-07-20T00:00:00.000Z' })
    expect(basicUsageResponse({ debatesStarted: 3, turnsGenerated: 3, entitlements: freeEntitlements() })).toMatchObject({ allowed: false, debatesRemaining: 0 })
  })

  it('builds an idempotent server request scope', () => {
    expect(requestScope('user-1', 'debate-1', 'turn', 1)).toBe('user-1:debate-1:turn:1')
    expect(requestScope('user-1', 'debate-1', 'turn', 1)).toBe(requestScope('user-1', 'debate-1', 'turn', 1))
  })
})
