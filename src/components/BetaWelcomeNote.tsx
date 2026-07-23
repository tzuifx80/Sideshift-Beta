import { useEffect, useState } from 'react'
import { Icon } from './SideShiftUI'
import type { Language } from '../domain'
import { useTranslations } from '../i18n'
import { BETA_WELCOME_STORAGE_KEY } from '../i18n/polish'

export function isBetaWelcomeDismissed(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(BETA_WELCOME_STORAGE_KEY) === 'dismissed'
}

export function dismissBetaWelcome(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BETA_WELCOME_STORAGE_KEY, 'dismissed')
}

export function BetaWelcomeNote({ language }: { language: Language }) {
  const t = useTranslations(language)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!isBetaWelcomeDismissed())
  }, [])

  if (!visible) return null

  function close() {
    dismissBetaWelcome()
    setVisible(false)
  }

  return (
    <section className="beta-welcome-note card-surface" role="note" aria-labelledby="beta-welcome-title">
      <div className="beta-welcome-head">
        <span className="eyebrow">{t('betaWelcome.eyebrow')}</span>
        <button type="button" className="modal-close" onClick={close} aria-label={t('common.close')}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <h2 id="beta-welcome-title">{t('betaWelcome.title')}</h2>
      <ul className="beta-welcome-list">
        <li>{t('betaWelcome.point1')}</li>
        <li>{t('betaWelcome.point2')}</li>
        <li>{t('betaWelcome.point3')}</li>
        <li>{t('betaWelcome.point4')}</li>
      </ul>
      <button type="button" className="button button-secondary beta-welcome-dismiss" onClick={close}>
        {t('betaWelcome.dismiss')}
      </button>
    </section>
  )
}
