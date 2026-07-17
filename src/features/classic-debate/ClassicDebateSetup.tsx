import { takeText, type Language, type Take } from '../../domain'
import { useTranslations } from '../../i18n'
import { Icon, Tag, type IconName } from '../../components/SideShiftUI'

export function ClassicDebateSetup({ take, language, onBack, onAi, onPerson, onTeam }: { take: Take; language: Language; onBack: () => void; onAi: () => void; onPerson: () => void; onTeam: () => void }) {
  const text = takeText(take, language)
  const t = useTranslations(language)
  const modes = [
    { key: 'ai', label: t('debateChoice.aiTitle'), eyebrow: t('debateChoice.aiEyebrow'), description: t('debateChoice.aiBody'), action: t('debateChoice.aiAction'), icon: 'spark' as IconName, onClick: onAi },
    { key: 'person', label: t('debateChoice.personTitle'), eyebrow: t('debateChoice.personEyebrow'), description: t('debateChoice.personBody'), action: t('debateChoice.personAction'), icon: 'users' as IconName, onClick: onPerson },
    { key: 'team', label: t('debateChoice.teamTitle'), eyebrow: t('debateChoice.teamEyebrow'), description: t('debateChoice.teamBody'), action: t('debateChoice.teamAction'), icon: 'users' as IconName, onClick: onTeam },
  ]
  return <div className="page debate-choice-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('common.back')}</button><div className="page-heading"><div><span className="eyebrow">{t('debateChoice.eyebrow')}</span><h1>{t('debateChoice.title')}</h1><p className="muted">{t('debateChoice.body', { statement: text.statement })}</p></div><Tag tone="coral">{text.category}</Tag></div><div className="debate-choice-grid debate-choice-grid-three">{modes.map(mode => <button type="button" className={`debate-choice-card debate-choice-${mode.key}`} onClick={mode.onClick} key={mode.key}><span className="debate-choice-icon"><Icon name={mode.icon} size={22} /></span><span className="eyebrow">{mode.eyebrow}</span><h2>{mode.label}</h2><p>{mode.description}</p><span className="debate-choice-action">{mode.action} <Icon name="arrow" size={15} /></span></button>)}</div><p className="debate-choice-note"><Icon name="lock" size={14} /> {t('debateChoice.privacy')}</p></div>
}

export const ClassicDebateSetupDependencies = Object.freeze({ component: 'ClassicDebateSetup', route: 'debateChoice' })
