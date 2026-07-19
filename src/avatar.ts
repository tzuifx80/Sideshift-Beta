import { validateAvatarInput } from './privateSocial'

export async function processAvatarFile(file: File): Promise<Blob> {
  const validation = validateAvatarInput({ mime: file.type, size: file.size })
  if (!validation.ok) throw new Error(validation.reason === 'size' ? 'This image is too large.' : 'Choose a JPEG, PNG, or WebP image.')
  if (typeof document === 'undefined') throw new Error('Image processing is unavailable in this environment.')
  const bitmap = await createImageBitmap(file)
  try {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable in this browser.')
    const scale = Math.max(size / bitmap.width, size / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height)
    const output = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!output) throw new Error('The image could not be processed.')
    const outputValidation = validateAvatarInput({ mime: 'image/webp', size: output.size })
    if (!outputValidation.ok) throw new Error('The processed image is too large. Choose a smaller image.')
    return output
  } finally {
    bitmap.close()
  }
}
