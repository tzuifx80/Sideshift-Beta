import { describe, expect, it } from 'vitest'
import { ACTIVE_COMPONENT_TREE } from './activeTree'

describe('active component tree', () => {
  it('characterizes the rendered shell and screen implementations', () => {
    expect(ACTIVE_COMPONENT_TREE.shell).toBe('AppShellV2')
    expect(ACTIVE_COMPONENT_TREE.screens).toEqual(expect.arrayContaining(['PersonalHome', 'SettingsScreen', 'Groups', 'TeamDebate']))
    expect(ACTIVE_COMPONENT_TREE.legacyCompatibility).toContain('LegacySettingsScreen')
  })
})
