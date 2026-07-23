import type { ProviderKind } from './types'

type BreakerState = { failures: number; openUntil: number }

const breakers = new Map<ProviderKind, BreakerState>()

const FAILURE_THRESHOLD = 3
const COOLDOWN_MS = 60_000

export function isCircuitOpen(provider: ProviderKind, now = Date.now()): boolean {
  const state = breakers.get(provider)
  if (!state) return false
  if (state.openUntil > now) return true
  if (state.openUntil > 0 && state.openUntil <= now) {
    breakers.set(provider, { failures: 0, openUntil: 0 })
  }
  return false
}

export function recordProviderSuccess(provider: ProviderKind) {
  breakers.set(provider, { failures: 0, openUntil: 0 })
}

export function recordProviderFailure(provider: ProviderKind, now = Date.now()) {
  const current = breakers.get(provider) || { failures: 0, openUntil: 0 }
  const failures = current.failures + 1
  const openUntil = failures >= FAILURE_THRESHOLD ? now + COOLDOWN_MS : 0
  breakers.set(provider, { failures, openUntil })
}

export function resetCircuitBreakers() {
  breakers.clear()
}
