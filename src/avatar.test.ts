import { afterEach, describe, expect, it, vi } from 'vitest'
import { processAvatarFile } from './avatar'

describe('avatar processing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('center-crops accepted images to a 512x512 WebP before upload', async () => {
    const drawImage = vi.fn()
    const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(['webp'], { type: 'image/webp' })))
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob }
    const bitmap = { width: 1600, height: 900, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    vi.stubGlobal('document', { createElement: () => canvas })
    const input = new Blob(['jpeg'], { type: 'image/jpeg' }) as File

    const output = await processAvatarFile(input)

    expect(output.type).toBe('image/webp')
    expect(canvas.width).toBe(512)
    expect(canvas.height).toBe(512)
    expect(drawImage).toHaveBeenCalledWith(bitmap, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('falls back to the WebView image decoder for picker blobs', async () => {
    const drawImage = vi.fn()
    const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(['webp'], { type: 'image/webp' })))
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob }
    const revokeObjectURL = vi.fn()
    const image = class {
      width = 1200
      height = 800
      naturalWidth = 1200
      naturalHeight = 800
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    }
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')))
    vi.stubGlobal('Image', image)
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:avatar'), revokeObjectURL })
    vi.stubGlobal('document', { createElement: () => canvas })

    const output = await processAvatarFile(new Blob(['jpeg'], { type: 'image/jpeg' }) as File)

    expect(output.type).toBe('image/webp')
    expect(drawImage).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar')
  })
})
