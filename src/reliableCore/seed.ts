export function seededIndex(seed: string, max: number): number {
  if (max <= 0) return 0
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % max
}

export function seededPick<T>(seed: string, items: readonly T[]): T {
  return items[seededIndex(seed, items.length)]
}
