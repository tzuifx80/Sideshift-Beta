export type ArgumentSignals = {
  charCount: number
  wordCount: number
  sentenceCount: number
  hasCompleteSentence: boolean
  motionOverlap: number
  priorRoundOverlap: number
  hasCausalLanguage: boolean
  hasExample: boolean
  hasEvidenceMarker: boolean
  hasNumberOrSource: boolean
  hasComparison: boolean
  hasConcession: boolean
  hasCounterargument: boolean
  isQuestion: boolean
  hasAbsolutistLanguage: boolean
  hasUnsupportedCertainty: boolean
  isRepeated: boolean
  civilityScore: number
  relevanceScore: number
  structureScore: number
}

const CAUSAL = /\b(because|since|therefore|thus|hence|so that|as a result|leads to|causes?|drives?)\b/i
const EXAMPLE = /\b(for example|for instance|such as|like when|consider)\b/i
const EVIDENCE = /\b(evidence|data|research|study|studies|report|source|according to|shows? that)\b/i
const NUMBER = /\b\d+(\.\d+)?%?|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i
const COMPARISON = /\b(compared to|versus|vs\.?|more than|less than|better than|worse than|unlike)\b/i
const CONCESSION = /\b(admittedly|fair point|i agree that|while it is true|granted|even if)\b/i
const COUNTER = /\b(however|but|yet|on the other hand|nevertheless|still|although|whereas)\b/i
const ABSOLUTE = /\b(always|never|everyone|no one|nobody|everybody|all|none|impossible|guaranteed|definitely|certainly|obviously)\b/i
const CERTAINTY = /\b(clearly|undeniably|without doubt|proves?|proven|fact that|must be true)\b/i
const HOSTILE = /\b(stupid|idiot|moron|shut up|hate you|pathetic|worthless)\b/i

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
}

function overlapRatio(a: string, b: string): number {
  const aTokens = new Set(tokenize(a))
  const bTokens = tokenize(b)
  if (!aTokens.size || !bTokens.length) return 0
  const shared = bTokens.filter(token => aTokens.has(token)).length
  return shared / Math.max(aTokens.size, bTokens.length)
}

function countSentences(text: string): number {
  const parts = text.split(/[.!?]+/).map(part => part.trim()).filter(part => part.length > 3)
  return parts.length
}

export function analyzeArgument(input: {
  argument: string
  motion: string
  priorArguments: string[]
}): ArgumentSignals {
  const argument = input.argument.trim()
  const words = tokenize(argument)
  const charCount = argument.length
  const wordCount = words.length
  const sentenceCount = countSentences(argument)
  const hasCompleteSentence = sentenceCount >= 1 && /[.!?]$/.test(argument)
  const motionOverlap = overlapRatio(input.motion, argument)
  const priorRoundOverlap = input.priorArguments.length
    ? Math.max(...input.priorArguments.map(prior => overlapRatio(prior, argument)))
    : 0
  const isRepeated = priorRoundOverlap > 0.72 && wordCount > 8
  const hostile = HOSTILE.test(argument)
  const civilityScore = hostile ? 0.2 : 1
  const relevanceScore = Math.min(1, motionOverlap * 1.4 + (wordCount >= 6 ? 0.15 : 0))
  const structureScore = Math.min(1, (hasCompleteSentence ? 0.35 : 0) + (COUNTER.test(argument) ? 0.2 : 0) + (CAUSAL.test(argument) ? 0.25 : 0) + (sentenceCount >= 2 ? 0.2 : 0))

  return {
    charCount,
    wordCount,
    sentenceCount,
    hasCompleteSentence,
    motionOverlap,
    priorRoundOverlap,
    hasCausalLanguage: CAUSAL.test(argument),
    hasExample: EXAMPLE.test(argument),
    hasEvidenceMarker: EVIDENCE.test(argument),
    hasNumberOrSource: NUMBER.test(argument),
    hasComparison: COMPARISON.test(argument),
    hasConcession: CONCESSION.test(argument),
    hasCounterargument: COUNTER.test(argument),
    isQuestion: /\?\s*$/.test(argument.trim()),
    hasAbsolutistLanguage: ABSOLUTE.test(argument),
    hasUnsupportedCertainty: CERTAINTY.test(argument) && !EVIDENCE.test(argument),
    isRepeated,
    civilityScore,
    relevanceScore,
    structureScore,
  }
}
