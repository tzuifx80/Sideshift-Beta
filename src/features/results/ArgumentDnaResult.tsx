import type { Language, ResultData } from '../../domain'
import { useTranslations } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { Icon, Tag } from '../../components/SideShiftUI'

const scoreLabelKeys: Record<string, TranslationKey> = {
  Clarity: 'results.label.clarity',
  Relevance: 'results.label.relevance',
  Reasoning: 'results.label.reasoning',
  Rebuttal: 'results.label.rebuttal',
  Fairness: 'results.label.fairness',
}

const scoreExplanationKeys: Record<string, TranslationKey> = {
  Clarity: 'results.explanation.clarity',
  Relevance: 'results.explanation.relevance',
  Reasoning: 'results.explanation.reasoning',
  Rebuttal: 'results.explanation.rebuttal',
  Fairness: 'results.explanation.fairness',
}

export function ArgumentDnaResult({ result, language }: { result: ResultData; language: Language }) {
  const t = useTranslations(language)
  return <div className="score-breakdown card-surface"><div className="card-topline"><div><span className="eyebrow">{t('results.howYouArgued')}</span><h2>{t('results.breakdown')}</h2></div><Tag tone="mint"><Icon name="spark" size={13} /> {t('results.aiEvaluation')}</Tag></div>{result.scores.map(item => { const labelKey = scoreLabelKeys[item.label]; const explanationKey = scoreExplanationKeys[item.label]; return <div className="score-row" key={item.label}><div className="score-label"><strong>{labelKey ? t(labelKey) : item.label}</strong><span>{explanationKey ? t(explanationKey) : item.explanation}</span></div><div className="score-bar"><i style={{ width: `${(item.score / 20) * 100}%` }} /></div><b>{item.score}<small>/20</small></b></div> })}<p className="ai-disclaimer"><Icon name="info" size={14} /> {t('results.disclaimer')}</p></div>
}
