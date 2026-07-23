import type { Language } from '../domain'
import { tacticLibrary, type TacticId } from './tactics'

const SIDE_INTROS: Record<Language, [string, string]> = {
  en: ['From the {side} side on this motion, ', 'Arguing for {side}, '],
  de: ['Aus der Sicht von {side} zu dieser These: ', 'Im Sinne von {side} '],
  fr: ['Du côté {side} sur cette motion, ', 'En défendant {side}, '],
  es: ['Desde el lado {side} en esta moción, ', 'Defendiendo {side}, '],
  it: ['Dal lato {side} su questa mozione, ', 'Sostenendo {side}, '],
}

const CLAIM_REFERENCES: Record<Language, string> = {
  en: 'You suggested that “{claim}”. ',
  de: 'Du hast angedeutet: „{claim}“. ',
  fr: 'Vous avez suggéré que « {claim} ». ',
  es: 'Sugeriste que «{claim}». ',
  it: 'Hai suggerito che «{claim}». ',
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value), template)
}

export function composeResponse(input: {
  language: Language
  motion: string
  aiSide: string
  tactic: TacticId
  claimFragment: string | null
  debateId: string
  round: number
  priorOpponentText?: string
}): string {
  const template = tacticLibrary[input.tactic][input.language]
  const introSeed = `${input.debateId}:intro:${input.round}`
  const introOptions = SIDE_INTROS[input.language]
  const intro = fill(introOptions[introSeed.charCodeAt(0) % introOptions.length], { side: input.aiSide })
  const body = fill(template.body, { motion: input.motion })
  const claim = input.claimFragment ? fill(CLAIM_REFERENCES[input.language], { claim: input.claimFragment }) : ''
  const challenge = fill(template.challenge, { motion: input.motion })
  let response = `${intro}${claim}${body} ${challenge}`.replace(/\s+/g, ' ').trim()
  if (input.priorOpponentText && response === input.priorOpponentText) {
    response = `${response} ${challenge}`.trim()
  }
  if (response.length > 680) response = `${response.slice(0, 677).trim()}…`
  return response
}
