import { validateAvatarInput } from './privateSocial'

type ImageSource = ImageBitmap | HTMLImageElement

async function loadImageSource(file: File): Promise<{ source: ImageSource; objectUrl: string | null }> {
  if (typeof createImageBitmap === 'function') {
    try { return { source: await createImageBitmap(file), objectUrl: null } } catch { /* Fall through to the WebView image decoder. */ }
  }
  if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') throw new Error('Image processing is unavailable in this browser.')
  let objectUrl: string | null = null
  try {
    objectUrl = URL.createObjectURL(file)
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The image could not be decoded.'))
      element.src = objectUrl as string
    })
    return { source: image, objectUrl }
  } catch (caught) {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    throw caught
  }
}

export async function processAvatarFile(file: File): Promise<Blob> {
  const validation = validateAvatarInput({ mime: file.type, size: file.size })
  if (!validation.ok) throw new Error(validation.reason === 'size' ? 'This image is too large.' : 'Choose a JPEG, PNG, or WebP image.')
  if (typeof document === 'undefined') throw new Error('Image processing is unavailable in this environment.')
  const decoded = await loadImageSource(file)
  try {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable in this browser.')
    const imageElement = typeof HTMLImageElement !== 'undefined' && decoded.source instanceof HTMLImageElement ? decoded.source : null
    const width = imageElement ? imageElement.naturalWidth || imageElement.width : decoded.source.width
    const height = imageElement ? imageElement.naturalHeight || imageElement.height : decoded.source.height
    if (!width || !height) throw new Error('The image could not be decoded.')
    const scale = Math.max(size / width, size / height)
    const scaledWidth = width * scale
    const scaledHeight = height * scale
    context.drawImage(decoded.source, (size - scaledWidth) / 2, (size - scaledHeight) / 2, scaledWidth, scaledHeight)
    const output = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!output) throw new Error('The image could not be processed.')
    const outputValidation = validateAvatarInput({ mime: 'image/webp', size: output.size })
    if (!outputValidation.ok) throw new Error('The processed image is too large. Choose a smaller image.')
    if (output.type !== 'image/webp') throw new Error('This device could not create a WebP profile photo.')
    return output
  } finally {
    if ('close' in decoded.source && typeof decoded.source.close === 'function') decoded.source.close()
    if (decoded.objectUrl) URL.revokeObjectURL(decoded.objectUrl)
  }
}
