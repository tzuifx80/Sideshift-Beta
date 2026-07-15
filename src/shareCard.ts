import type { ResultData, Language } from './domain'
import { takeText } from './domain'

function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export async function createShareCardBlob(result: ResultData, language: Language): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 900
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Share card export is not supported in this browser.')
  const text = takeText(result.take, language)
  const gradient = context.createLinearGradient(0, 0, 1200, 900)
  gradient.addColorStop(0, '#242c4d')
  gradient.addColorStop(1, '#514c91')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#f6d0c9'
  context.beginPath()
  context.arc(1040, 110, 190, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#fffef9'
  context.font = '700 34px Arial'
  context.fillText('SideShift', 76, 92)
  context.fillStyle = '#cfc7fb'
  context.font = '700 22px Arial'
  context.fillText('MY SHIFT', 76, 145)
  context.fillStyle = '#fffef9'
  context.font = '700 48px Arial'
  const statementLines = wrapText(context, `“${text.statement}”`, 980)
  statementLines.slice(0, 4).forEach((line, index) => context.fillText(line, 76, 250 + index * 62))
  context.fillStyle = '#f6d0c9'
  context.font = '700 22px Arial'
  context.fillText('ARGUMENT SCORE', 76, 580)
  context.fillStyle = '#fffef9'
  context.font = '700 118px Arial'
  context.fillText(result.score === null ? '—' : String(result.score), 76, 700)
  context.font = '700 34px Arial'
  context.fillText('/ 100', 300, 700)
  context.fillStyle = '#cfc7fb'
  context.font = '700 22px Arial'
  context.fillText(result.understanding === 'yes' ? 'UNDERSTANDING IS A WIN' : 'REFLECTION IS A WIN', 76, 790)
  context.fillText('CAN YOU MOVE A MIND?', 830, 820)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Share card export failed.')), 'image/png'))
}

export async function downloadShareCard(result: ResultData, language: Language): Promise<void> {
  const blob = await createShareCardBlob(result, language)
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = 'sideshift-shift-card.png'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}

export async function shareCardFile(result: ResultData, language: Language): Promise<boolean> {
  if (!navigator.share || typeof File === 'undefined') return false
  const blob = await createShareCardBlob(result, language)
  const file = new File([blob], 'sideshift-shift-card.png', { type: 'image/png' })
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return false
  await navigator.share({ title: 'My SideShift result', files: [file] })
  return true
}
