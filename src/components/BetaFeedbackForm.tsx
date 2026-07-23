import { useState } from 'react'
import { Button, Icon } from './SideShiftUI'
import type { BetaFeedbackCategory, BetaFeedbackInput } from '../data/repository'
import type { Language } from '../domain'
import { useTranslations } from '../i18n'
import type { TranslationKey } from '../i18n'

type BetaFeedbackFormProps = {
  language: Language
  surface: BetaFeedbackInput['surface']
  screen: string
  aiModelId?: string | null
  onSubmit: (payload: BetaFeedbackInput) => Promise<void>
}

const categoryKeys: Array<[BetaFeedbackCategory, TranslationKey]> = [
  ['broken', 'feedback.category.broken'],
  ['ai_quality', 'feedback.category.ai_quality'],
  ['design_usability', 'feedback.category.design_usability'],
  ['missing_topic', 'feedback.category.missing_topic'],
  ['suggestion', 'feedback.category.suggestion'],
  ['other', 'feedback.category.other'],
]

export function BetaFeedbackForm({ language, surface, screen, aiModelId, onSubmit }: BetaFeedbackFormProps) {
  const t = useTranslations(language)
  const [category, setCategory] = useState<BetaFeedbackCategory>('suggestion')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({ category, message: message.trim() || null, surface, screen, aiModelId: aiModelId || null, appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0-beta' })
      setSent(true)
      setMessage('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('feedback.error'))
    } finally {
      setBusy(false)
    }
  }
  return <section className="settings-section card-surface beta-feedback"><div className="settings-section-heading"><div><span className="eyebrow">{t('feedback.eyebrow')}</span><h2>{t('feedback.title')}</h2></div><Icon name="message" size={21} /></div><p className="field-help">{t('feedback.body')}</p><div className="feedback-options" role="group" aria-label={t('feedback.type')}>{categoryKeys.map(([value, labelKey]) => <button type="button" key={value} className={category === value ? 'selected' : ''} aria-pressed={category === value} onClick={() => { setCategory(value); setSent(false) }}>{t(labelKey)}</button>)}</div><label className="field-label" htmlFor={`beta-feedback-${surface}`}>{t('feedback.shortNote')}</label><textarea id={`beta-feedback-${surface}`} className="settings-textarea" maxLength={600} value={message} onChange={event => { setMessage(event.target.value); setSent(false); setError('') }} placeholder={t('feedback.placeholder')} /><div className="feedback-submit-row"><small>{message.length} / 600</small><Button variant="secondary" onClick={() => void submit()} disabled={busy}>{busy ? t('common.sending') : t('common.sendFeedback')}</Button></div>{error && <p className="form-error" role="alert">{error}</p>}{sent && <p className="form-success" role="status">{t('feedback.thanks')}</p>}</section>
}
