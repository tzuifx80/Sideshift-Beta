const DRAFT_PREFIX = 'sideshift-draft-v1:'
const AI_SETUP_KEY = 'sideshift-ai-setup-v1'

import type { DebateLanguageMode } from './domain'

export type AiSetupDraft = {
  takeId: string
  selectedId: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  roundLength: 'quick' | 'standard' | 'deep'
  quality: 'fast' | 'balanced' | 'maximum'
  responseLength: 'concise' | 'standard' | 'detailed'
  modelSelection: 'automatic' | 'exact'
  exactModelId: string | null
  userSide: string
  customMotion: string
  debateLanguageMode?: DebateLanguageMode
  debateLanguageCode?: string
}

function keyFor(key: string): string {
  return `${DRAFT_PREFIX}${key}`
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function loadArgumentDraft(key: string): string {
  if (!canUseStorage()) return ''
  try {
    return window.localStorage.getItem(keyFor(key)) || ''
  } catch {
    return ''
  }
}

export function saveArgumentDraft(key: string, value: string): void {
  if (!canUseStorage()) return
  try {
    if (value.trim()) window.localStorage.setItem(keyFor(key), value)
    else window.localStorage.removeItem(keyFor(key))
  } catch {
    // Draft recovery is best effort and never blocks the debate.
  }
}

export function clearArgumentDraft(key: string): void {
  if (!canUseStorage()) return
  try { window.localStorage.removeItem(keyFor(key)) } catch { /* best effort */ }
}

export function hasArgumentDraft(key: string): boolean {
  return Boolean(loadArgumentDraft(key).trim())
}

export function loadAiSetupDraft(takeId?: string): Partial<AiSetupDraft> | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(AI_SETUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AiSetupDraft>
    return !takeId || parsed.takeId === takeId ? parsed : null
  } catch {
    return null
  }
}

export function saveAiSetupDraft(draft: AiSetupDraft): void {
  if (!canUseStorage()) return
  try { window.localStorage.setItem(AI_SETUP_KEY, JSON.stringify(draft)) } catch { /* best effort */ }
}

export function clearAiSetupDraft(): void {
  if (!canUseStorage()) return
  try { window.localStorage.removeItem(AI_SETUP_KEY) } catch { /* best effort */ }
}
