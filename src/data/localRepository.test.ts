import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalRepository } from './localRepository'
import { STORAGE_KEY } from '../storage'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } } })

describe('local development repository', () => {
  beforeEach(() => values.clear())

  it('deduplicates identical report submissions', async () => {
    const repository = createLocalRepository()
    const first = await repository.submitReport('local-user', { debateId: 'debate-1', challengeId: null, reportedContentType: 'debate', reason: 'spam', details: null })
    const second = await repository.submitReport('local-user', { debateId: 'debate-1', challengeId: null, reportedContentType: 'debate', reason: 'spam', details: 'clicked twice' })
    expect(second.id).toBe(first.id)
  })

  it('rejects a duplicate local challenge response and marks expiry', async () => {
    const repository = createLocalRepository()
    const created = await repository.createChallenge('local-user', { takeId: 'take-1', argument: 'A valid local challenge argument.', mode: 'classic', creatorSide: 'Support' })
    const stored = JSON.parse(values.get(STORAGE_KEY) || '{}')
    stored.challenges[created.token].expiresAt = new Date(Date.now() - 1_000).toISOString()
    values.set(STORAGE_KEY, JSON.stringify(stored))
    await expect(repository.loadChallenge(created.token)).resolves.toMatchObject({ status: 'expired', canRespond: false })
    const fresh = await repository.createChallenge('local-user', { takeId: 'take-1', argument: 'A second valid local challenge argument.', mode: 'classic', creatorSide: 'Support' })
    await repository.respondToChallenge(fresh.token, 'A valid response with a counterpoint.')
    await expect(repository.respondToChallenge(fresh.token, 'A duplicate response with a counterpoint.')).rejects.toThrow('already been answered')
  })
})
