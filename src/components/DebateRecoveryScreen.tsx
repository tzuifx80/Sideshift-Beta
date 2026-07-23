import { Button } from './SideShiftUI'
import { useTranslations } from '../i18n'
import type { Language } from '../domain'
import type { DebateRecoveryIssue } from '../lib/debateRecovery'

export function DebateRecoveryScreen(props: {
  language: Language
  issue: DebateRecoveryIssue
  onResume: () => void
  onHome: () => void
  onDiscard: () => void
  busy?: boolean
}) {
  const t = useTranslations(props.language)
  const detail = props.issue === 'missing_ai_config' ? t('debate.recovery.missingConfig') : t('debate.recovery.body')
  return (
    <div className="page debate-recovery-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('debate.recovery.eyebrow')}</span>
          <h1>{t('debate.recovery.title')}</h1>
          <p className="muted">{detail}</p>
        </div>
      </div>
      <section className="card-surface debate-recovery-actions">
        {props.issue !== 'missing_ai_config' && (
          <Button onClick={props.onResume} disabled={props.busy}>{t('debate.recovery.resume')}</Button>
        )}
        <Button variant="secondary" onClick={props.onHome} disabled={props.busy}>{t('debate.recovery.home')}</Button>
        <Button variant="ghost" onClick={props.onDiscard} disabled={props.busy}>{t('debate.recovery.discard')}</Button>
      </section>
    </div>
  )
}
