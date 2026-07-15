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
  return {
    primary: input.mock ? 'mock' : puter,
    puter,
    basicServer: input.basicServerAvailable ? 'basic_server_available' : 'basic_server_unavailable',
  }
}

export function aiRuntimeLabel(status: AiRuntimeStatus): string {
  switch (status) {
    case 'mock': return 'Development mock AI'
    case 'basic_server_available': return 'Server AI available'
    case 'basic_server_unavailable': return 'Server AI unavailable'
    case 'puter_disconnected': return 'Puter disconnected'
    case 'puter_connecting': return 'Puter connecting'
    case 'puter_connected': return 'Puter connected'
    case 'puter_error': return 'Puter connection error'
  }
}