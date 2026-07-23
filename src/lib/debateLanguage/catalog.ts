import type { Language } from '../../domain'
import type { DebateLanguageCode } from './types'

export type DebateLanguageOption = {
  code: DebateLanguageCode
  label: string
  nativeLabel: string
  hostedOnline: boolean
  reliableCore: boolean
  rtl: boolean
}

const CORE_UI: DebateLanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', hostedOnline: true, reliableCore: true, rtl: false },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', hostedOnline: true, reliableCore: true, rtl: false },
  { code: 'fr', label: 'French', nativeLabel: 'Français', hostedOnline: true, reliableCore: true, rtl: false },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', hostedOnline: true, reliableCore: true, rtl: false },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', hostedOnline: true, reliableCore: true, rtl: false },
]

const HOSTED_EXTRA: DebateLanguageOption[] = [
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'pl', label: 'Polish', nativeLabel: 'Polski', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'ro', label: 'Romanian', nativeLabel: 'Română', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'uk', label: 'Ukrainian', nativeLabel: 'Українська', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', hostedOnline: true, reliableCore: false, rtl: true },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', hostedOnline: true, reliableCore: false, rtl: true },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'fa', label: 'Persian', nativeLabel: 'فارسی', hostedOnline: true, reliableCore: false, rtl: true },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', hostedOnline: true, reliableCore: false, rtl: false },
  { code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', hostedOnline: true, reliableCore: false, rtl: false },
]

const BY_CODE = new Map<string, DebateLanguageOption>([...CORE_UI, ...HOSTED_EXTRA].map(item => [item.code, item]))

export function listCoreDebateLanguages(): DebateLanguageOption[] {
  return [...CORE_UI]
}

export function listHostedExtraLanguages(): DebateLanguageOption[] {
  return [...HOSTED_EXTRA]
}

export function listAllDebateLanguages(): DebateLanguageOption[] {
  return [...CORE_UI, ...HOSTED_EXTRA]
}

export function resolveDebateLanguageOption(code: DebateLanguageCode): DebateLanguageOption {
  const known = BY_CODE.get(code.split('-')[0]?.toLowerCase() || code.toLowerCase())
  if (known) return known
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code
    return { code, label: display, nativeLabel: display, hostedOnline: true, reliableCore: false, rtl: false }
  } catch {
    return { code, label: code, nativeLabel: code, hostedOnline: true, reliableCore: false, rtl: false }
  }
}

export function debateLanguageDisplayName(code: DebateLanguageCode, uiLocale: Language = 'en'): string {
  const option = resolveDebateLanguageOption(code)
  try {
    return new Intl.DisplayNames([uiLocale], { type: 'language' }).of(code) || option.nativeLabel
  } catch {
    return option.nativeLabel
  }
}
