import { describe, expect, it } from 'vitest'
import { clearPrivateClientState } from './logout'

function storageFixture(values: Record<string, string>): Storage {
  const map = new Map(Object.entries(values))
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: key => map.get(key) || null,
    key: index => Array.from(map.keys())[index] || null,
    removeItem: key => { map.delete(key) },
    setItem: (key, value) => { map.set(key, value) },
    get values() { return map },
  } as Storage & { values: Map<string, string> }
}

describe('private logout cleanup', () => {
  it('clears private state and drafts while retaining language and appearance preferences', () => {
    const storage = storageFixture({
      'sideshift-state-v2': '{}',
      'sideshift-draft-v1:ai:debate-1': 'private argument',
      'sideshift-onboarding-progress:user-1': '{}',
      'sideshift-ai-setup-v1': '{}',
      'sideshift-supabase-session': '{}',
      'sideshift-locale-v1': 'de',
      'sideshift-install-dismissed-v1': '1',
    }) as Storage & { values: Map<string, string> }

    clearPrivateClientState(storage)

    expect(Array.from(storage.values.keys()).sort()).toEqual(['sideshift-install-dismissed-v1', 'sideshift-locale-v1'])
  })
})
