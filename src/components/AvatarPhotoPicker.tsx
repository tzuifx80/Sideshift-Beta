import { useEffect, useState } from 'react'
import { Button } from './SideShiftUI'
import { processAvatarFile } from '../avatar'
import { pickAvatarFile, type AvatarMediaSource } from '../avatarMedia'
import { useTranslations } from '../i18n'
import type { Language } from '../domain'

type PendingAvatar = { blob: Blob; previewUrl: string }

export function AvatarPhotoPicker({ language, hasAvatar, busy, onUpload, onRemove, onNotify }: { language: Language; hasAvatar: boolean; busy?: boolean; onUpload: (blob: Blob) => Promise<void>; onRemove: () => Promise<void>; onNotify: (message: string) => void }) {
  const t = useTranslations(language)
  const [pending, setPending] = useState<PendingAvatar | null>(null)

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.previewUrl) }, [pending])
  useEffect(() => {
    if (!pending) return
    const handleNativeBack = (event: Event) => {
      if (event.defaultPrevented) return
      event.preventDefault()
      cancel()
    }
    window.addEventListener('sideshift-native-back', handleNativeBack, { capture: true })
    return () => window.removeEventListener('sideshift-native-back', handleNativeBack, { capture: true })
  }, [pending])

  async function choose(source: AvatarMediaSource) {
    const result = await pickAvatarFile(source)
    if (result.status !== 'selected') {
      if (result.status === 'cancelled') return
      if (result.status === 'permission_denied') return onNotify(t('friends.photoPermission'))
      return onNotify(t('friends.photoUnavailable'))
    }
    try {
      const blob = await processAvatarFile(result.file)
      setPending(current => { if (current) URL.revokeObjectURL(current.previewUrl); return { blob, previewUrl: URL.createObjectURL(blob) } })
    } catch { onNotify(t('friends.photoUnavailable')) }
  }

  async function confirm() {
    if (!pending || busy) return
    const selected = pending
    setPending(null)
    URL.revokeObjectURL(selected.previewUrl)
    await onUpload(selected.blob)
  }

  function cancel() {
    if (!pending) return
    URL.revokeObjectURL(pending.previewUrl)
    setPending(null)
  }

  if (pending) return <div className="avatar-photo-preview" role="group" aria-label={t('friends.previewPhoto')}><img src={pending.previewUrl} alt={t('friends.previewPhoto')} /><div className="profile-photo-actions"><Button variant="secondary" onClick={() => void confirm()} disabled={busy}>{t('friends.usePhoto')}</Button><button type="button" className="text-link" onClick={cancel} disabled={busy}>{t('common.cancel')}</button></div></div>

  return <div className="profile-photo-actions"><Button variant="secondary" onClick={() => void choose('gallery')} disabled={busy}>{t('friends.choosePhoto')}</Button><Button variant="secondary" onClick={() => void choose('camera')} disabled={busy}>{t('friends.takePhoto')}</Button>{hasAvatar && <button type="button" className="text-link" onClick={() => void onRemove()} disabled={busy}>{t('friends.removePhoto')}</button>}</div>
}
