import { describe, expect, it } from 'vitest'
import { humanProfileKey, restoreProfileOrigin } from './profileNavigation'

describe('profile navigation guards', () => {
  it('opens only human targets with a stable profile key', () => {
    expect(humanProfileKey({ kind: 'human', profileKey: ' profile-key ' })).toBe('profile-key')
    expect(humanProfileKey({ kind: 'human', profileKey: ' ' })).toBeNull()
    expect(humanProfileKey({ kind: 'ai', profileKey: 'ai-opponent' })).toBeNull()
  })

  it('restores the originating Group, challenge, result, or history surface', () => {
    const origins = ['group:group-1', 'challenge:challenge-1', 'result:result-1', 'history:history-1']
    for (const origin of origins) expect(restoreProfileOrigin(origin)).toBe(origin)
  })
})
