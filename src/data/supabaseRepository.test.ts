import { describe, expect, it } from 'vitest'
import { getTake } from '../domain'
import { hashChallengeToken } from './challengeToken'
import { mapChallengeRow, mapResultRow, mapSupabaseError } from './supabaseRepository'

describe('Supabase repository boundaries', () => {
  it('maps a stored result JSON row back to a domain result', () => {
    const take = getTake('society-media-age')
    const payload = { id: 'f5d9a2f3-9c6f-47a0-bb1b-9a1d2c8f9e10', debateId: '9f0d9c5f-2f2d-40e9-8ad7-6fd0cf6bb8e1', score: 72, movement: 1, understanding: 'yes', mode: 'sideswitch', take, assignedSide: take.opposeLabel, transcript: [{ role: 'user', round: 1, content: 'A sufficiently long opening argument.' }], scores: [{ label: 'Clarity', score: 15, explanation: 'Clear.' }], coaching: 'Keep your claim specific.', completedAt: new Date().toISOString() }
    expect(mapResultRow({ id: payload.id, argument_dna: payload })).toMatchObject({ id: payload.id, debateId: payload.debateId, score: 72, take: { id: take.id } })
  })

  it('maps challenge RPC data without exposing creator identity', () => {
    const mapped = mapChallengeRow({ id: 'challenge-1', token: 'raw-token', expiresAt: new Date(Date.now() + 60_000).toISOString(), takeId: 'society-media-age', argument: 'A valid challenge argument with a trade-off.', mode: 'classic', creatorSide: 'Support the statement', status: 'open', response: null, result: null })
    expect(mapped).toMatchObject({ token: 'raw-token', takeId: 'society-media-age', status: 'open' })
    expect(mapped).not.toHaveProperty('creatorId')
  })

  it('accepts token-redacted challenge history rows', () => {
    expect(mapChallengeRow({ id: 'challenge-2', token: '', url: '', expiresAt: new Date(Date.now() + 60_000).toISOString(), takeId: 'society-media-age', argument: 'A valid challenge argument with a trade-off.', mode: 'classic', creatorSide: 'Support the statement', status: 'completed', response: 'A valid counterpoint.', result: { total: 64 } })).toMatchObject({ token: '', status: 'completed', response: 'A valid counterpoint.' })
  })

  it('maps database errors to explicit UI-safe repository errors', () => {
    expect(mapSupabaseError('loading data', { code: '42501', message: 'private detail' })).toMatchObject({ name: 'RepositoryError', code: 'forbidden', message: 'You do not have permission to access this data.' })
    expect(mapSupabaseError('saving data', { code: '23505' }).code).toBe('conflict')
  })

  it('hashes challenge tokens deterministically as lowercase SHA-256 hex', async () => {
    const first = await hashChallengeToken('token-for-test')
    const second = await hashChallengeToken('token-for-test')
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
  })
})
