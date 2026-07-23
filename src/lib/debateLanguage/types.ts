import type { Language } from '../../domain'

/** BCP-47 or internal debate language code. */
export type DebateLanguageCode = string

export type DebateLanguageMode = 'auto' | 'explicit'

export const RELIABLE_CORE_LANGUAGE_CODES = ['en', 'de', 'fr', 'es', 'it'] as const
export type ReliableCoreLanguage = (typeof RELIABLE_CORE_LANGUAGE_CODES)[number]

export const RTL_LANGUAGE_CODES = new Set(['ar', 'ur', 'fa', 'he', 'ps', 'sd'])

export type DebateLanguageState = {
  mode: DebateLanguageMode
  /** Locked BCP-47 code once debate begins or first substantive argument arrives. */
  code: DebateLanguageCode
  locked: boolean
  /** Human-readable label for prompts and UI. */
  displayName: string
}

export type DebateLanguagePreference = {
  mode: DebateLanguageMode
  explicitCode?: DebateLanguageCode
}

export function isReliableCoreLanguage(code: DebateLanguageCode): code is ReliableCoreLanguage {
  return (RELIABLE_CORE_LANGUAGE_CODES as readonly string[]).includes(code)
}

export function isUiLanguage(code: DebateLanguageCode): code is Language {
  return (['en', 'de', 'fr', 'es', 'it'] as const).includes(code as Language)
}

export function isRtlLanguage(code: DebateLanguageCode): boolean {
  const base = code.split('-')[0]?.toLowerCase() || code.toLowerCase()
  return RTL_LANGUAGE_CODES.has(base)
}
