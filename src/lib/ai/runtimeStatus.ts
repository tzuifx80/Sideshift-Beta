import type { AiConnectionStatus, AiRuntimeSnapshot, AiRuntimeStatus } from './types'

export function createAiRuntimeSnapshot(input: { mock: boolean; puterStatus: AiConnectionStatus; basicServerAvailable: boolean }): AiRuntimeSnapshot {
  const puter: AiRuntimeStatus = input.mock
    ? 'mock'
    : input.puterStatus === 'connected'
      ? 'puter_connected'
      : input.puterStatus === 'connecting'
        ? 'puter_connecting'
        : input.puterStatus === 'failed'
          ? 'puter_error'
          : 'puter_disconnected'
  const basicServer = input.basicServerAvailable ? 'basic_available' : 'basic_unavailable'
  return {
    primary: input.mock ? 'mock' : input.basicServerAvailable && puter === 'puter_disconnected' ? 'basic_available' : puter,
    puter,
    basicServer,
  }
}

export function aiRuntimeLabel(status: AiRuntimeStatus): string {
  switch (status) {
    case 'mock': return 'Development mock AI'
    case 'basic_checking': return 'Checking Basic AI'
    case 'basic_available': return 'SideShift Basic available'
    case 'basic_unavailable': return 'SideShift Basic unavailable'
    case 'basic_rate_limited': return 'SideShift Basic rate limited'
    case 'basic_quota_exhausted': return 'SideShift Basic allowance used'
    case 'puter_disconnected': return 'Puter disconnected'
    case 'puter_connecting': return 'Puter connecting'
    case 'puter_connected': return 'Puter connected'
    case 'puter_error': return 'Puter connection error'
  }
}
