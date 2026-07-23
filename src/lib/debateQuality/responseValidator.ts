import { containsGenericOpener, containsPromptLeakage } from '../debateContract'
import { validateResponseLanguage, type LanguageValidationResult } from './languageValidator'

export type QualityValidationInput = {
  text: string
  expectedLanguage: string
  motion: string
  newestArgument: string
  previousOpponentTexts: string[]
  minWords?: number
  maxWords?: number
}

export type QualityValidationFailure =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'wrong_language'
  | 'excessive_mixed'
  | 'locale_key'
  | 'repetition'
  | 'no_engagement'
  | 'prompt_leakage'
  | 'generic_opener'
  | 'refusal'

export type QualityValidationResult =
  | { ok: true }
  | { ok: false; failures: QualityValidationFailure[]; language?: LanguageValidationResult }

const REFUSAL_MARKERS = [
  'as an ai',
  'i cannot help',
  'i can\'t help',
  'i am unable to',
  'i\'m unable to',
  'against my guidelines',
]

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(token => token.length > 3))
}

function overlapRatio(a: string, b: string): number {
  const left = tokenize(a)
  const right = tokenize(b)
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / Math.max(left.size, right.size)
}

function meaningfulOverlap(text: string, target: string): boolean {
  if (!target.trim()) return true
  const ratio = overlapRatio(text, target)
  if (ratio >= 0.08) return true
  const shortTokens = target.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(token => token.length >= 5)
  return shortTokens.slice(0, 6).some(token => text.toLowerCase().includes(token))
}

export function validateDebateResponse(input: QualityValidationInput): QualityValidationResult {
  const failures: QualityValidationFailure[] = []
  const text = input.text.trim()
  const words = text.split(/\s+/).filter(Boolean)
  const minWords = input.minWords ?? 35
  const maxWords = input.maxWords ?? 220

  if (!text) failures.push('empty')
  if (words.length > 0 && words.length < Math.floor(minWords / 4)) failures.push('too_short')
  if (words.length > maxWords) failures.push('too_long')

  const language = validateResponseLanguage(text, input.expectedLanguage)
  if (!language.ok) {
    if (language.reason === 'locale_key') failures.push('locale_key')
    else if (language.reason === 'excessive_mixed') failures.push('excessive_mixed')
    else failures.push('wrong_language')
  }

  if (containsPromptLeakage(text)) failures.push('prompt_leakage')
  if (containsGenericOpener(text)) failures.push('generic_opener')
  if (REFUSAL_MARKERS.some(marker => text.toLowerCase().includes(marker))) failures.push('refusal')

  for (const previous of input.previousOpponentTexts) {
    if (overlapRatio(text, previous) > 0.72) {
      failures.push('repetition')
      break
    }
  }

  if (!meaningfulOverlap(text, input.newestArgument) && !meaningfulOverlap(text, input.motion)) {
    failures.push('no_engagement')
  }

  if (!failures.length) return { ok: true }
  return { ok: false, failures, language: language.ok ? undefined : language }
}

export function qualityRepairInstruction(failures: QualityValidationFailure[]): string {
  const parts = failures.map(failure => {
    if (failure === 'wrong_language') return 'use the locked debate language only'
    if (failure === 'repetition') return 'do not repeat a prior opponent point or structure'
    if (failure === 'no_engagement') return 'directly engage the newest user claim'
    if (failure === 'generic_opener') return 'avoid generic opening phrases'
    if (failure === 'prompt_leakage') return 'reply only as the debate opponent with no meta commentary'
    if (failure === 'too_short') return 'provide a fuller rebuttal within 80–140 words'
    if (failure === 'too_long') return 'stay within mobile-friendly length'
    return failure.replaceAll('_', ' ')
  })
  return `Regenerate one improved opponent reply. Fix: ${parts.join('; ')}. Keep the same side and locked language. Return only the natural-language reply.`
}
