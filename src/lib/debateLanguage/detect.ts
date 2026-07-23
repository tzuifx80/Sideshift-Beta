import type { DebateLanguageCode } from './types'

const SCRIPT_RANGES: Array<{ script: RegExp; codes: DebateLanguageCode[] }> = [
  { script: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u, codes: ['ar', 'fa', 'ur'] },
  { script: /[\u0900-\u097F]/u, codes: ['hi'] },
  { script: /[\u0980-\u09FF]/u, codes: ['bn'] },
  { script: /[\u0400-\u04FF]/u, codes: ['ru', 'uk'] },
  { script: /[\u4E00-\u9FFF\u3400-\u4DBF]/u, codes: ['zh'] },
  { script: /[\u3040-\u30FF]/u, codes: ['ja'] },
  { script: /[\uAC00-\uD7AF]/u, codes: ['ko'] },
]

const LATIN_HINTS: Array<{ pattern: RegExp; code: DebateLanguageCode }> = [
  { pattern: /\b(der|die|das|und|nicht|aber|weil|dass)\b/i, code: 'de' },
  { pattern: /\b(le|la|les|des|une|mais|parce|donc|avec)\b/i, code: 'fr' },
  { pattern: /\b(el|la|los|las|pero|porque|como|muy)\b/i, code: 'es' },
  { pattern: /\b(il|lo|gli|che|perché|quindi|molto)\b/i, code: 'it' },
  { pattern: /\b(o|a|os|as|mas|porque|muito|não)\b/i, code: 'pt' },
  { pattern: /\b(de|het|een|niet|maar|omdat)\b/i, code: 'nl' },
  { pattern: /\b(i|nie|ale|ponieważ|bardzo)\b/i, code: 'pl' },
  { pattern: /\b(ve|bir|ama|çünkü|çok)\b/i, code: 'tr' },
  { pattern: /\b(și|dar|pentru|foarte)\b/i, code: 'ro' },
  { pattern: /\b(yang|dan|tidak|karena|sangat)\b/i, code: 'id' },
]

const TRANSLITERATION_HINTS: Array<{ pattern: RegExp; code: DebateLanguageCode }> = [
  { pattern: /\b(kya|nahin|kyun|magar|urdu)\b/i, code: 'ur' },
  { pattern: /\b(kya|hai|nahi|kyunki|lekin|aur)\b/i, code: 'hi' },
]

function stripNoise(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Lightweight heuristic detection — not academic language ID. */
export function detectDebateLanguageFromText(text: string, fallback: DebateLanguageCode = 'en'): DebateLanguageCode {
  const sample = stripNoise(text)
  if (!sample) return fallback
  if (/^[\p{L}]+$/u.test(sample) && sample.length <= 3) return fallback

  for (const { script, codes } of SCRIPT_RANGES) {
    if (script.test(sample)) return codes[0]
  }

  for (const { pattern, code } of TRANSLITERATION_HINTS) {
    if (pattern.test(sample)) return code
  }

  let best: { code: DebateLanguageCode; score: number } | null = null
  for (const { pattern, code } of LATIN_HINTS) {
    const matches = sample.match(pattern)
    const score = matches?.length || 0
    if (score > 0 && (!best || score > best.score)) best = { code, score }
  }
  if (best) return best.code

  const asciiRatio = (sample.match(/[A-Za-z]/g)?.length || 0) / Math.max(sample.length, 1)
  if (asciiRatio > 0.85) return 'en'
  return fallback
}

export function isSubstantiveArgument(text: string): boolean {
  const trimmed = stripNoise(text)
  return trimmed.length >= 12
}
