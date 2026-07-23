import { useMemo, useState } from 'react'
import type { DebateLanguageCode, DebateLanguageMode, Language } from '../domain'
import { listCoreDebateLanguages, listHostedExtraLanguages, resolveDebateLanguageOption } from '../lib/debateLanguage'
import { useTranslations } from '../i18n'

type Props = {
  language: Language
  mode: DebateLanguageMode
  code: DebateLanguageCode
  online: boolean
  disabled?: boolean
  onChange: (next: { mode: DebateLanguageMode; code: DebateLanguageCode }) => void
}

export function DebateLanguageControl({ language, mode, code, online, disabled = false, onChange }: Props) {
  const t = useTranslations(language)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState('')
  const core = listCoreDebateLanguages()
  const extra = listHostedExtraLanguages()
  const filteredExtra = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return extra
    return extra.filter(item => `${item.label} ${item.nativeLabel} ${item.code}`.toLowerCase().includes(needle))
  }, [extra, query])

  function selectExplicit(nextCode: DebateLanguageCode) {
    onChange({ mode: 'explicit', code: nextCode })
    setDialogOpen(false)
    setQuery('')
  }

  const current = mode === 'auto' ? null : resolveDebateLanguageOption(code)

  return (
    <div className="debate-language-control">
      <span className="field-label">{t('ai.debateLanguage.label')}</span>
      <div className="debate-language-options">
        <button type="button" className={mode === 'auto' ? 'selected' : ''} disabled={disabled} onClick={() => onChange({ mode: 'auto', code })}>
          <strong>{t('ai.debateLanguage.auto')}</strong>
          <small>{t('ai.debateLanguage.autoHelp')}</small>
        </button>
        {core.map(item => (
          <button type="button" key={item.code} className={mode === 'explicit' && code === item.code ? 'selected' : ''} disabled={disabled} onClick={() => selectExplicit(item.code)}>
            <strong>{item.nativeLabel}</strong>
          </button>
        ))}
        {online && (
          <button type="button" className="debate-language-more" disabled={disabled} onClick={() => setDialogOpen(open => !open)}>
            {current && !core.some(item => item.code === current.code) ? current.nativeLabel : t('ai.debateLanguage.more')}
          </button>
        )}
      </div>
      {dialogOpen && online && (
        <div className="debate-language-dialog card-surface" role="dialog" aria-label={t('ai.debateLanguage.more')}>
          <input className="text-input" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('ai.debateLanguage.search')} />
          <div className="debate-language-dialog-list">
            {filteredExtra.map(item => (
              <button type="button" key={item.code} onClick={() => selectExplicit(item.code)}>
                <strong>{item.nativeLabel}</strong>
                <small>{item.label}</small>
              </button>
            ))}
          </div>
          <button type="button" className="text-link" onClick={() => setDialogOpen(false)}>{t('common.close')}</button>
        </div>
      )}
      {!online && mode === 'explicit' && !resolveDebateLanguageOption(code).reliableCore && (
        <p className="field-help" role="status">{t('ai.debateLanguage.onlineRequired')}</p>
      )}
    </div>
  )
}

export function DebateLanguageStatus({ language, label, locked, detected, retrying, onlineRequired, reliableOnly }: {
  language: Language
  label: string
  locked?: boolean
  detected?: boolean
  retrying?: boolean
  onlineRequired?: boolean
  reliableOnly?: boolean
}) {
  const t = useTranslations(language)
  let message = t('ai.debateLanguage.answering', { language: label })
  if (detected) message = t('ai.debateLanguage.detected', { language: label })
  if (retrying) message = t('ai.debateLanguage.retrying', { language: label })
  if (onlineRequired) message = t('ai.debateLanguage.onlineRequired')
  if (reliableOnly) message = t('ai.debateLanguage.reliableOnly')
  return <span className="debate-language-status" role="status">{message}{locked ? ` · ${t('ai.debateLanguage.locked')}` : ''}</span>
}
