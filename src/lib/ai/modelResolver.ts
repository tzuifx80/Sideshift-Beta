import { opponents } from './opponents'
import type { AiFamily, AiModel, AiQuality, ResolvedOpponent } from './types'

const familyTokens: Record<AiFamily, string[]> = {
  Gemini: ['gemini', 'google'],
  Claude: ['claude', 'anthropic'],
  GPT: ['gpt', 'openai'],
  DeepSeek: ['deepseek'],
}

function numberOrNull(...values: unknown[]): number | null {
  const value = values.find(item => typeof item === 'number' && Number.isFinite(item))
  return typeof value === 'number' ? value : null
}

function booleanOrNull(...values: unknown[]): boolean | null {
  const value = values.find(item => typeof item === 'boolean')
  return typeof value === 'boolean' ? value : null
}

function capabilityText(raw: Record<string, unknown>): string {
  const values = [raw.capabilities, raw.modalities, raw.type, raw.input_modalities, raw.output_modalities]
  return values.flatMap(value => Array.isArray(value) ? value : [value]).filter(value => typeof value === 'string').join(' ').toLowerCase()
}

export function normalizeModels(value: unknown): AiModel[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    const id = typeof raw.id === 'string' ? raw.id.trim() : typeof raw.model === 'string' ? raw.model.trim() : ''
    if (!id) return []
    const aliases = Array.isArray(raw.aliases) ? raw.aliases.filter((alias): alias is string => typeof alias === 'string') : []
    const cost = raw.cost && typeof raw.cost === 'object' ? raw.cost as Record<string, unknown> : {}
    const capabilities = capabilityText(raw)
    const explicitCapabilities = Boolean(capabilities)
    const blocked = /embedding|image-only|audio-only|speech-only|video-only/.test(capabilities)
    const supportsText = booleanOrNull(raw.supports_text, raw.text) ?? (!blocked && (!explicitCapabilities || /text|chat|completion|language|conversation/.test(capabilities)))
    const supportsChat = booleanOrNull(raw.supports_chat, raw.chat) ?? (!blocked && (!explicitCapabilities || /chat|conversation|completion|text/.test(capabilities)))
    const supportsStreaming = booleanOrNull(raw.supports_streaming, raw.streaming, raw.stream) ?? !/non-stream|batch-only/.test(capabilities)
    const isLegacy = raw.legacy === true || raw.deprecated === true || raw.status === 'deprecated' || /legacy|deprecated/.test(`${id} ${String(raw.name || '')}`.toLowerCase())
    return [{
      id,
      provider: typeof raw.provider === 'string' ? raw.provider : '',
      name: typeof raw.name === 'string' ? raw.name : id,
      aliases,
      context: numberOrNull(raw.context, raw.context_window, raw.contextWindow),
      maxTokens: numberOrNull(raw.max_tokens, raw.maxTokens, raw.max_output_tokens),
      inputCost: numberOrNull(cost.input, raw.input_cost, raw.inputCost),
      outputCost: numberOrNull(cost.output, raw.output_cost, raw.outputCost),
      supportsText,
      supportsChat,
      supportsStreaming,
      isLegacy,
      raw,
    }]
  })
}

function modelText(model: AiModel): string {
  return [model.id, model.name, model.provider, ...model.aliases].join(' ').toLowerCase()
}

export function familyMatches(model: AiModel, family: AiFamily): boolean {
  const text = modelText(model)
  return familyTokens[family].some(token => text.includes(token))
}

export function isTextCapable(model: AiModel): boolean {
  return model.supportsText && model.supportsChat && model.supportsStreaming && (model.maxTokens === null || model.maxTokens > 0)
}

function versionScore(model: AiModel): number {
  const versions = modelText(model).match(/\d+(?:\.\d+)?/g) || []
  return versions.reduce((sum, value) => sum + Number(value), 0)
}

function costScore(model: AiModel): number {
  const input = model.inputCost ?? 1
  const output = model.outputCost ?? input
  return Math.min(500, input + output)
}

function qualityScore(model: AiModel, quality: AiQuality): number {
  const text = modelText(model)
  const fastSignal = /(?:^|[-_\s])(flash|haiku|mini|nano|lite|small|instant|chat)(?:[-_\s]|$)/.test(text) ? 1 : 0
  const maximumSignal = /(?:^|[-_\s])(opus|sonnet|pro|ultra|reason|thinking|large|o[13])(?:[-_\s]|$)/.test(text) ? 1 : 0
  const currentScore = model.isLegacy ? -10000 : 0
  const version = versionScore(model)
  const cost = costScore(model)
  const capacity = Math.min(120, (model.context || 0) / 1000 + (model.maxTokens || 0) / 100)
  if (quality === 'fast') return currentScore + fastSignal * 500 - maximumSignal * 160 + capacity * .2 - cost * 2 + version
  if (quality === 'maximum') return currentScore + maximumSignal * 700 - fastSignal * 80 + capacity * 2 + version * 8 - cost * .05
  return currentScore + fastSignal * 260 + maximumSignal * 80 + capacity + version * 4 - cost
}

function modelForFamily(family: AiFamily, models: AiModel[], quality: AiQuality, exactModelId?: string | null): { model: AiModel | null; models: AiModel[] } {
  const compatible = models.filter(model => familyMatches(model, family) && isTextCapable(model))
  const sorted = [...compatible].sort((left, right) => qualityScore(right, quality) - qualityScore(left, quality) || left.id.localeCompare(right.id))
  const exact = exactModelId ? compatible.find(model => model.id === exactModelId || model.aliases.includes(exactModelId)) : undefined
  return { model: exact || sorted[0] || null, models: sorted }
}

export function resolveOpponents(models: AiModel[], options: { quality?: AiQuality; exactModelIds?: Partial<Record<AiFamily, string | null>> } = {}): ResolvedOpponent[] {
  const quality = options.quality || 'balanced'
  return opponents.map(opponent => {
    const selected = modelForFamily(opponent.family, models, quality, options.exactModelIds?.[opponent.family])
    const exactRequested = Boolean(options.exactModelIds?.[opponent.family])
    return { ...opponent, available: Boolean(selected.model), model: selected.model, models: selected.models, selection: exactRequested && Boolean(selected.model && selected.model.id === options.exactModelIds?.[opponent.family]) ? 'exact' : 'automatic' }
  })
}

export { modelForFamily }
