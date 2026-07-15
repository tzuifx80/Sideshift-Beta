export const ACTIVE_COMPONENT_TREE = Object.freeze({
  shell: 'AppShellV2',
  screens: ['PersonalHome', 'PersonalExplore', 'PersonalProfile', 'SettingsScreen', 'DebateTypeChoiceExpanded', 'Groups', 'TeamDebate', 'AiSetup', 'AiDebate', 'AiResults'] as const,
  legacyCompatibility: ['AppShell', 'Home', 'Profile', 'LegacySettingsScreen', 'DebateTypeChoice'] as const,
})
