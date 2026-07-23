import type { Language } from '../domain'
import type { AiEvaluation } from '../lib/ai/types'
import { analyzeArgument } from './argumentAnalysis'
import { seededIndex } from './seed'

const DISCLAIMERS: Record<Language, string> = {
  en: 'This is an automated coaching estimate based on observable writing signals, not a judgment of moral or political correctness.',
  de: 'Dies ist eine automatisierte Coaching-Schätzung anhand beobachtbarer Schreibsignale, kein moralisches oder politisches Urteil.',
  fr: 'Il s’agit d’une estimation de coaching automatisée basée sur des signaux d’écriture observables, pas d’un jugement moral ou politique.',
  es: 'Esta es una estimación de coaching automatizada basada en señales de escritura observables, no un juicio moral o político.',
  it: 'Questa è una stima di coaching automatizzata basata su segnali di scrittura osservabili, non un giudizio morale o politico.',
}

const STRONGEST: Record<Language, Record<string, string>> = {
  en: { relevance: 'You kept the motion in view.', structure: 'Your reasoning had a visible structure.', engagement: 'You engaged with the opposing side.', clarity: 'Your wording stayed readable.', civility: 'Your tone stayed constructive.' },
  de: { relevance: 'Du hast die These im Blick behalten.', structure: 'Dein Argument hatte eine erkennbare Struktur.', engagement: 'Du bist auf die Gegenseite eingegangen.', clarity: 'Deine Formulierung blieb lesbar.', civility: 'Dein Ton blieb konstruktiv.' },
  fr: { relevance: 'Vous avez gardé la motion en vue.', structure: 'Votre raisonnement avait une structure visible.', engagement: 'Vous avez répondu au camp opposé.', clarity: 'Votre formulation restait lisible.', civility: 'Votre ton est resté constructif.' },
  es: { relevance: 'Mantuviste la moción a la vista.', structure: 'Tu razonamiento tuvo una estructura visible.', engagement: 'Respondiste al lado contrario.', clarity: 'Tu redacción se mantuvo legible.', civility: 'Tu tono se mantuvo constructivo.' },
  it: { relevance: 'Hai mantenuto la mozione in vista.', structure: 'Il tuo ragionamento aveva una struttura visibile.', engagement: 'Hai risposto al lato opposto.', clarity: 'La formulazione è rimasta leggibile.', civility: 'Il tono è rimasto costruttivo.' },
}

const IMPROVEMENT: Record<Language, Record<string, string>> = {
  en: { relevance: 'Tie each point more directly to the motion.', structure: 'Make the logical steps explicit.', engagement: 'Answer the opponent’s last challenge directly.', evidence: 'Separate claims from supporting evidence.', repetition: 'Avoid repeating the same point across rounds.', brevity: 'Develop the argument with more than a slogan.' },
  de: { relevance: 'Verknüpfe jeden Punkt direkter mit der These.', structure: 'Mache die logischen Schritte explizit.', engagement: 'Beantworte die letzte Gegenfrage direkt.', evidence: 'Trenne Behauptungen von Belegen.', repetition: 'Wiederhole denselben Punkt nicht in jeder Runde.', brevity: 'Entwickle das Argument über eine Schlagzeile hinaus.' },
  fr: { relevance: 'Reliez chaque point plus directement à la motion.', structure: 'Rendez les étapes logiques explicites.', engagement: 'Répondez directement au dernier défi adverse.', evidence: 'Séparez affirmations et preuves.', repetition: 'Évitez de répéter le même point à chaque tour.', brevity: 'Développez l’argument au-delà d’un slogan.' },
  es: { relevance: 'Vincula cada punto más directamente con la moción.', structure: 'Haz explícitos los pasos lógicos.', engagement: 'Responde directamente al último desafío del oponente.', evidence: 'Separa afirmaciones de evidencia de apoyo.', repetition: 'Evita repetir el mismo punto en cada ronda.', brevity: 'Desarrolla el argumento más allá de un eslogan.' },
  it: { relevance: 'Collega ogni punto più direttamente alla mozione.', structure: 'Rendi espliciti i passaggi logici.', engagement: 'Rispondi direttamente all’ultima sfida avversaria.', evidence: 'Separa affermazioni da prove di supporto.', repetition: 'Evita di ripetere lo stesso punto in ogni round.', brevity: 'Sviluppa l’argomento oltre uno slogan.' },
}

function clampScore(value: number): number {
  return Math.max(2, Math.min(18, Math.round(value)))
}

export function evaluateLocally(input: {
  debateId: string
  motion: string
  language: Language
  transcript: Array<{ role: 'user' | 'opponent'; round: number; content: string }>
}): {
  evaluation: AiEvaluation
  overallScore: number
  reasoning: string
  evidence: string
  responsiveness: string
  clarity: string
  strongestPoint: string
  improvementArea: string
  conciseSummary: string
  disclaimer: string
} {
  const userTurns = input.transcript.filter(turn => turn.role === 'user')
  const opponentTurns = input.transcript.filter(turn => turn.role === 'opponent')
  if (!userTurns.length) {
    const empty = {
      clarity: 4, relevance: 3, reasoning: 3, rebuttal: 3, fairness: 5,
      strongestPoint: 'No user argument was submitted.',
      weakestAssumption: 'Submit at least one developed argument.',
      missedCounterargument: 'Respond to the opponent directly.',
      unansweredOpponentPoint: 'Answer the latest challenge.',
      improvedExampleResponse: 'State one claim, one reason, and one response to the other side.',
      argumentDna: 'Too little material for a full coaching review.',
      concession: 'none' as const,
    }
    return {
      evaluation: empty,
      overallScore: 18,
      reasoning: '3', evidence: '3', responsiveness: '3', clarity: '4',
      strongestPoint: empty.strongestPoint,
      improvementArea: empty.weakestAssumption,
      conciseSummary: empty.argumentDna,
      disclaimer: DISCLAIMERS[input.language],
    }
  }

  const priorUserArgs: string[] = []
  const signals = userTurns.map((turn, index) => {
    const priorOpponent = opponentTurns.find(item => item.round === turn.round - 1)?.content || ''
    const analysis = analyzeArgument({ argument: turn.content, motion: input.motion, priorArguments: priorUserArgs })
    priorUserArgs.push(turn.content)
    const responsiveness = priorOpponent ? Math.min(1, analysis.motionOverlap * 0.5 + (turn.content.toLowerCase().includes(tokenize(priorOpponent).slice(0, 2).join(' ')) ? 0.35 : 0.15)) : analysis.relevanceScore
    return { ...analysis, responsiveness, index }
  })

  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
  const relevance = clampScore(avg(signals.map(item => item.relevanceScore)) * 16 + 4)
  const clarity = clampScore(avg(signals.map(item => item.structureScore)) * 14 + avg(signals.map(item => item.hasCompleteSentence ? 1 : 0)) * 4 + 3)
  const reasoning = clampScore(avg(signals.map(item => item.hasCausalLanguage || item.hasComparison ? 1 : 0.35)) * 14 + 4)
  const evidence = clampScore(avg(signals.map(item => item.hasEvidenceMarker && !item.hasUnsupportedCertainty ? 0.8 : item.hasNumberOrSource ? 0.45 : 0.2)) * 14 + 4)
  const rebuttal = clampScore(avg(signals.map(item => item.responsiveness)) * 15 + (signals.some(item => item.hasCounterargument) ? 2 : 0) + 3)
  const fairness = clampScore(avg(signals.map(item => item.civilityScore)) * 12 + (signals.some(item => item.hasConcession) ? 3 : 0) + 4)

  const repeated = signals.some(item => item.isRepeated)
  const tooShort = signals.every(item => item.wordCount < 8)
  const penalty = repeated ? 3 : tooShort ? 4 : signals.some(item => item.relevanceScore < 0.15) ? 2 : 0
  const scores = [clarity, relevance, reasoning, evidence, rebuttal, fairness].map(score => clampScore(score - (penalty > 0 ? Math.ceil(penalty / 2) : 0)))
  const [clarityScore, relevanceScore, reasoningScore, evidenceScore, rebuttalScore, fairnessScore] = scores

  const strongestKey = relevanceScore >= reasoningScore ? 'relevance' : 'structure'
  const improvementKey = repeated ? 'repetition' : tooShort ? 'brevity' : evidenceScore < rebuttalScore ? 'evidence' : 'engagement'
  const strongestPoint = STRONGEST[input.language][strongestKey] || STRONGEST.en.relevance
  const improvementArea = IMPROVEMENT[input.language][improvementKey] || IMPROVEMENT.en.engagement
  const conciseSummary = `${strongestPoint} ${improvementArea}`
  const evaluation: AiEvaluation = {
    clarity: clarityScore,
    relevance: relevanceScore,
    reasoning: reasoningScore,
    rebuttal: rebuttalScore,
    fairness: fairnessScore,
    strongestPoint,
    weakestAssumption: improvementArea,
    missedCounterargument: improvementArea,
    unansweredOpponentPoint: improvementArea,
    improvedExampleResponse: conciseSummary,
    argumentDna: conciseSummary,
    concession: 'none',
  }

  return {
    evaluation,
    overallScore: clarityScore + relevanceScore + reasoningScore + rebuttalScore + fairnessScore,
    reasoning: String(reasoningScore),
    evidence: String(evidenceScore),
    responsiveness: String(rebuttalScore),
    clarity: String(clarityScore),
    strongestPoint,
    improvementArea,
    conciseSummary,
    disclaimer: DISCLAIMERS[input.language],
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
}

export function evaluationSeed(debateId: string): number {
  return seededIndex(`${debateId}:evaluation`, 1000)
}
