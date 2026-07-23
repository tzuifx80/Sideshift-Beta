import type { Language } from '../../domain'
import type { DebateLanguageCode, DebateLanguageMode, DebateLanguageState } from './types'
import { debateLanguageDisplayName } from './catalog'
import { detectDebateLanguageFromText, isSubstantiveArgument } from './detect'

export type ResolveDebateLanguageInput = {
  mode: DebateLanguageMode
  explicitCode?: DebateLanguageCode | null
  profilePreference?: DebateLanguageCode | null
  interfaceLocale: Language
  lockedCode?: DebateLanguageCode | null
  locked?: boolean
  firstSubstantiveArgument?: string | null
}

export function resolveDebateLanguage(input: ResolveDebateLanguageInput): DebateLanguageState {
  if (input.locked && input.lockedCode) {
    return {
      mode: input.mode,
      code: input.lockedCode,
      locked: true,
      displayName: debateLanguageDisplayName(input.lockedCode, input.interfaceLocale),
    }
  }

  if (input.mode === 'explicit' && input.explicitCode) {
    return {
      mode: 'explicit',
      code: input.explicitCode,
      locked: Boolean(input.locked),
      displayName: debateLanguageDisplayName(input.explicitCode, input.interfaceLocale),
    }
  }

  if (input.firstSubstantiveArgument && isSubstantiveArgument(input.firstSubstantiveArgument)) {
    const detected = detectDebateLanguageFromText(
      input.firstSubstantiveArgument,
      input.profilePreference || input.interfaceLocale || 'en',
    )
    return {
      mode: 'auto',
      code: detected,
      locked: true,
      displayName: debateLanguageDisplayName(detected, input.interfaceLocale),
    }
  }

  const code = input.explicitCode || input.profilePreference || input.interfaceLocale || 'en'
  return {
    mode: input.mode,
    code,
    locked: false,
    displayName: debateLanguageDisplayName(code, input.interfaceLocale),
  }
}

export function lockDebateLanguage(state: DebateLanguageState, argument?: string): DebateLanguageState {
  if (state.locked) return state
  if (state.mode === 'explicit') {
    return { ...state, locked: true }
  }
  if (argument && isSubstantiveArgument(argument)) {
    const detected = detectDebateLanguageFromText(argument, state.code)
    return {
      mode: 'auto',
      code: detected,
      locked: true,
      displayName: debateLanguageDisplayName(detected),
    }
  }
  return state
}

export function normalizeDebateLanguageCode(value: unknown, fallback: DebateLanguageCode = 'en'): DebateLanguageCode {
  if (typeof value !== 'string' || !value.trim()) return fallback
  return value.trim().toLowerCase().split('_').join('-')
}
