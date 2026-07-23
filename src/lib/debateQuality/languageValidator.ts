import type { DebateLanguageCode } from '../debateLanguage'
import { isReliableCoreLanguage } from '../debateLanguage'

const LATIN_WORD = /[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/g
const CYRILLIC = /[\u0400-\u04FF]/u
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u
const DEVANAGARI = /[\u0900-\u097F]/u
const BENGALI = /[\u0980-\u09FF]/u
const HAN = /[\u4E00-\u9FFF]/u
const HIRAGANA_KATAKANA = /[\u3040-\u30FF]/u
const HANGUL = /[\uAC00-\uD7AF]/u

const GERMAN_MARKERS = /\b(der|die|das|und|nicht|aber|weil|dass|eine|einer)\b/gi
const ENGLISH_MARKERS = /\b(the|and|not|but|because|that|with|your|this)\b/gi
const FRENCH_MARKERS = /\b(le|la|les|des|une|mais|parce|donc|avec|votre)\b/gi
const SPANISH_MARKERS = /\b(el|la|los|las|pero|porque|como|muy|usted)\b/gi
const ITALIAN_MARKERS = /\b(il|lo|gli|che|perché|quindi|molto|vostro)\b/gi

const LOCALE_KEY = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/i

export type LanguageValidationResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'locale_key' | 'wrong_language' | 'excessive_mixed' }

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length
}

function dominantLatinLanguage(text: string): DebateLanguageCode | 'mixed' | 'unknown' {
  const scores: Array<[DebateLanguageCode, number]> = [
    ['de', countMatches(text, GERMAN_MARKERS)],
    ['en', countMatches(text, ENGLISH_MARKERS)],
    ['fr', countMatches(text, FRENCH_MARKERS)],
    ['es', countMatches(text, SPANISH_MARKERS)],
    ['it', countMatches(text, ITALIAN_MARKERS)],
  ]
  scores.sort((a, b) => b[1] - a[1])
  const [top, second] = scores
  if (!top || top[1] < 2) return 'unknown'
  if (second && second[1] >= top[1] - 1 && top[1] < 4) return 'mixed'
  return top[0]
}

function scriptForLanguage(code: DebateLanguageCode): 'latin' | 'cyrillic' | 'arabic' | 'devanagari' | 'bengali' | 'han' | 'japanese' | 'korean' | 'any' {
  const base = code.split('-')[0]?.toLowerCase() || code
  if (base === 'ru' || base === 'uk') return 'cyrillic'
  if (base === 'ar' || base === 'fa' || base === 'ur') return 'arabic'
  if (base === 'hi') return 'devanagari'
  if (base === 'bn') return 'bengali'
  if (base === 'zh') return 'han'
  if (base === 'ja') return 'japanese'
  if (base === 'ko') return 'korean'
  if (isReliableCoreLanguage(base as never) || ['pt', 'nl', 'pl', 'tr', 'ro', 'id'].includes(base)) return 'latin'
  return 'any'
}

function scriptRatio(text: string, script: RegExp): number {
  const chars = [...text.replace(/\s/g, '')]
  if (!chars.length) return 0
  return chars.filter(char => script.test(char)).length / chars.length
}

export function validateResponseLanguage(text: string, expected: DebateLanguageCode): LanguageValidationResult {
  const trimmed = text.trim()
  if (!trimmed || /^[\p{P}\p{S}\d\s]+$/u.test(trimmed)) return { ok: false, reason: 'empty' }
  if (LOCALE_KEY.test(trimmed.slice(0, 80))) return { ok: false, reason: 'locale_key' }

  const base = expected.split('-')[0]?.toLowerCase() || expected
  const script = scriptForLanguage(expected)

  if (script === 'cyrillic' && scriptRatio(trimmed, CYRILLIC) < 0.35) return { ok: false, reason: 'wrong_language' }
  if (script === 'arabic' && scriptRatio(trimmed, ARABIC) < 0.35) return { ok: false, reason: 'wrong_language' }
  if (script === 'devanagari' && scriptRatio(trimmed, DEVANAGARI) < 0.25) return { ok: false, reason: 'wrong_language' }
  if (script === 'bengali' && scriptRatio(trimmed, BENGALI) < 0.25) return { ok: false, reason: 'wrong_language' }
  if (script === 'han' && scriptRatio(trimmed, HAN) < 0.2) return { ok: false, reason: 'wrong_language' }
  if (script === 'japanese' && scriptRatio(trimmed, HIRAGANA_KATAKANA) < 0.15 && scriptRatio(trimmed, HAN) < 0.1) {
    return { ok: false, reason: 'wrong_language' }
  }
  if (script === 'korean' && scriptRatio(trimmed, HANGUL) < 0.25) return { ok: false, reason: 'wrong_language' }

  if (script === 'latin' || isReliableCoreLanguage(base as never)) {
    const latinWords = trimmed.match(LATIN_WORD) || []
    if (latinWords.length >= 6) {
      const dominant = dominantLatinLanguage(trimmed)
      if (dominant === 'mixed') return { ok: false, reason: 'excessive_mixed' }
      if (dominant !== 'unknown' && dominant !== base && dominant !== expected) {
        if (base === 'en' && dominant === 'en') return { ok: true }
        if (dominant !== base) return { ok: false, reason: 'wrong_language' }
      }
    }
  }

  return { ok: true }
}

export function languageRepairInstruction(expectedName: string, expectedCode: string, failure: string): string {
  return `Rewrite your previous opponent reply entirely in ${expectedName} (${expectedCode}). Keep the same assigned position and meaning. Fix this issue: ${failure}. Return only the rewritten natural-language reply.`
}
