export type AvatarMediaSource = 'gallery' | 'camera'
export type AvatarPickerStatus = 'cancelled' | 'permission_denied' | 'unavailable'
export type AvatarPickerResult = { status: 'selected'; file: File } | { status: AvatarPickerStatus }

export function classifyAvatarPickerError(error: unknown): { status: AvatarPickerStatus } {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ''
  if (name === 'AbortError') return { status: 'cancelled' }
  if (name === 'NotAllowedError' || name === 'SecurityError') return { status: 'permission_denied' }
  return { status: 'unavailable' }
}

export function pickAvatarFile(source: AvatarMediaSource): Promise<AvatarPickerResult> {
  if (typeof document === 'undefined') return Promise.resolve({ status: 'unavailable' })
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    if (source === 'camera') input.setAttribute('capture', 'environment')
    document.body.appendChild(input)
    let settled = false
    const finish = (result: AvatarPickerResult) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(result)
    }
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      finish(file ? { status: 'selected', file } : { status: 'cancelled' })
    }, { once: true })
    input.addEventListener('cancel', () => finish({ status: 'cancelled' }), { once: true })
    input.addEventListener('error', () => finish({ status: 'unavailable' }), { once: true })
    try { input.click() } catch (error) { finish(classifyAvatarPickerError(error)) }
  })
}
