import { useEffect, useState } from 'react'
import { takeText, type Language, type ResultData, type Take, type Mode } from '../../domain'
import { useTranslations } from '../../i18n'
import { trackEvent } from '../../analytics'
import { downloadShareCard, shareCardFile } from '../../shareCard'
import { shareWithNative } from '../../capacitor'
import { copyText } from '../../lib/clipboard'
import { Button, Icon, Logo, Tag } from '../../components/SideShiftUI'
import { ArgumentDnaResult } from './ArgumentDnaResult'

type BeginHandler = (mode: Mode, take?: Take) => void | Promise<void>

export function ClassicDebateResult({ result, language, onBegin, onClash, onNotify }: { result: ResultData; language: Language; onBegin: BeginHandler; onClash: () => void; onNotify: (message: string) => void }) {
  const text = takeText(result.take, language)
  const t = useTranslations(language)
  const move = result.movement > 0 ? t('results.agree') : result.movement < 0 ? t('results.disagree') : t('results.noMovement')
  const [shareBusy, setShareBusy] = useState(false)
  useEffect(() => { trackEvent('result_viewed', { score: result.score, movement: result.movement }) }, [result.id, result.movement, result.score])
  async function shareResult() {
    if (shareBusy) return
    setShareBusy(true)
    window.setTimeout(() => setShareBusy(false), 2000)
    trackEvent('share_attempted', { surface: 'result' })
    const score = result.score ?? '—'
    const shareData = { title: t('results.shareTitle'), text: t('results.shareText', { score }) }
    try { if (await shareWithNative(shareData)) return } catch { /* fall through to web share */ }
    try { if (await shareCardFile(result, language)) return } catch { /* fall through to text share */ }
    if (navigator.share) { try { await navigator.share(shareData); return } catch { return } }
    try { await downloadShareCard(result, language); onNotify(t('results.shiftDownloaded')); return } catch { /* use caption fallback */ }
    onNotify(await copyText(shareData.text) ? t('results.captionCopied') : t('results.shareUnavailable'))
  }
  async function copyCaption() {
    const copied = await copyText(t('results.shareCaption', { score: result.score ?? '—' }))
    onNotify(copied ? t('results.captionCopied') : t('results.clipboardUnavailable'))
  }
  return <div className="page results-page"><div className="results-intro"><div><button type="button" className="back-link" onClick={() => onBegin('classic', result.take)}><Icon name="arrow" size={15} /> {t('results.doAnotherTake')}</button><span className="eyebrow">{t('results.completed', { mode: result.mode.toUpperCase() })}</span><h1>{t('results.heading')}</h1><p className="muted">{t('results.defended', { side: result.assignedSide })}</p></div><div className="result-score-hero"><span>{t('results.argumentScore').split(' ').map((part, index) => <span key={`${part}-${index}`}>{part}<br /></span>)}</span><strong>{result.score ?? '—'}</strong><small>/ 100</small><div className="score-orbit" /></div></div><section className="result-grid"><ArgumentDnaResult result={result} language={language} /><div className="movement-card card-surface"><div className="card-topline"><span className="eyebrow">{t('results.perspectiveMovement')}</span><span className="movement-icon"><Icon name="arrowUp" size={16} /></span></div><h2>{Math.abs(result.movement) === 1 ? t('results.oneStep') : t('results.manySteps', { count: Math.abs(result.movement) })}<br /><em>{move}.</em></h2><div className="movement-line"><span>{t('results.disagree')}</span><div><i /><b style={{ left: `${((result.movement + 2) / 4) * 100}%` }} /></div><span>{t('results.agree')}</span></div><p>{result.movement === 0 ? t('results.movementDescription') : t('results.movementDescriptionChanged')}</p><Tag tone="lavender"><Icon name="check" size={13} /> {result.understanding === 'yes' ? t('results.understandingVictory') : t('results.reflectionRecorded')}</Tag></div></section><section className="result-lower"><div className="shift-card-wrap"><div className="section-heading"><div><span className="eyebrow">{t('results.shareable')}</span><h2>{t('results.shiftCard')}</h2></div><button type="button" className="text-link" aria-label={t('results.shareCardDetails')} onClick={() => onNotify(t('results.shareCardPrivate'))}><Icon name="more" size={17} /></button></div><ShiftCard result={result} language={language} /><div className="share-actions"><Button variant="dark" icon="share" onClick={() => void shareResult()} disabled={shareBusy}>{t('results.shareResult')}</Button><Button variant="secondary" icon="copy" onClick={() => void copyCaption()}>{t('results.copyCaption')}</Button></div></div><aside className="next-move"><span className="eyebrow">{t('results.whatNext')}</span><h3>{t('results.keepConversation')}</h3><button type="button" onClick={onClash} className="next-move-link"><span className="next-move-icon"><Icon name="link" size={18} /></span><span><strong>{t('results.challengeFriend')}</strong><small>{t('results.challengeFriendBody')}</small></span><Icon name="arrow" size={16} /></button><button type="button" onClick={() => onBegin('sideswitch', result.take)} className="next-move-link"><span className="next-move-icon lavender"><Icon name="spark" size={18} /></span><span><strong>{t('results.oppositeSide')}</strong><small>{t('results.oppositeSideBody')}</small></span><Icon name="arrow" size={16} /></button></aside></section></div>
}

function ShiftCard({ result, language }: { result: ResultData; language: Language }) {
  const text = takeText(result.take, language)
  const t = useTranslations(language)
  return <div className="shift-card"><div className="shift-card-header"><Logo compact /><span><Icon name="spark" size={14} /> {t('results.shiftCard').toUpperCase()}</span></div><div className="shift-card-statement">“{text.statement}”</div><div className="shift-card-divider" /><div className="shift-card-data"><div><small>{t('results.mode')}</small><strong>{result.mode.toUpperCase()}</strong></div><div><small>{t('results.argumentScore')}</small><strong>{result.score ?? '—'}<i>/100</i></strong></div><div><small>{t('results.takeaway')}</small><strong>{result.understanding === 'yes' ? t('results.understandingWin') : t('results.reflectionWin')}</strong></div></div><div className="shift-card-footer"><span>{t('results.moveAMind')}</span><span>SIDESHIFT</span></div></div>
}

export const ResultsDependencies = Object.freeze({ component: 'ClassicDebateResult', dna: 'ArgumentDnaResult' })
