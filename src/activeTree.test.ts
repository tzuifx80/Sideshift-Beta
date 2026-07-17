import { describe, expect, it } from 'vitest'
import { ACTIVE_COMPONENT_TREE } from './activeTree'

describe('active component tree', () => {
  it('characterizes the rendered shell and screen implementations', () => {
    expect(ACTIVE_COMPONENT_TREE.shell).toBe('AppShellV2')
    expect(ACTIVE_COMPONENT_TREE.screens).toEqual(expect.arrayContaining([
      'PersonalHome',
      'SettingsScreen',
      'Groups',
      'TeamDebate',
      'ClassicDebateSetup',
      'ClassicDebateSession',
      'ClassicDebateResult',
      'ArgumentDnaResult',
      'FriendClashSetup',
      'FriendClashSession',
      'FriendClashResult',
      'ChallengeRecipient',
    ]))
    expect(ACTIVE_COMPONENT_TREE.legacyCompatibility).not.toEqual(expect.arrayContaining([
      'ClassicDebateSetup',
      'ClassicDebateSession',
      'ClassicDebateResult',
      'ArgumentDnaResult',
      'FriendClashSetup',
      'FriendClashSession',
      'FriendClashResult',
      'ChallengeRecipient',
    ]))
  })
})
