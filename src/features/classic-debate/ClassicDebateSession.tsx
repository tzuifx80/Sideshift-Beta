import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { assignSide, createMockOpponent, movementBetween, takeText, type Language, type Mode, type Stance, type Take } from '../../domain'
import { useOnlineStatus } from '../../pwa'
import { clearArgumentDraft, loadArgumentDraft, saveArgumentDraft } from '../../drafts'
import { apiFetch } from '../../data/api'
import type { ReportInput } from '../../data/repository'
import type { AiRuntimeSnapshot } from '../../lib/ai/types'
import { trackEvent } from '../../analytics'
import { useTranslations } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { Button, Icon, Tag, type IconName } from '../../components/SideShiftUI'
import { openExternalUrl } from '../../capacitor'

type AiMode = AiRuntimeSnapshot['primary']
type Stage = 'stance' | 'argument' | 'post'

const stageKeys: TranslationKey[] = ['classic.stagePrivateStance', 'classic.stageOpening', 'classic.stageRebuttal', 'classic.stagePressureQuestion', 'classic.stageSteelman', 'classic.stageClosing', 'classic.stageShift']

function ClassicDebateSessionBase({ activeTake, language, mode, step, setStep, stance, setStance, confidence, setConfidence, postStance, setPostStance, understanding, setUnderstanding, responses, setResponses, opponentMessages, setOpponentMessages, onModeChange, onComplete, onExit, onNotify, onReport, onPersistRound, aiMode, online }: { activeTake: Take; language: Language; mode: Mode; step: number; setStep: (step: number) => void; stance: Stance; setStance: (stance: Stance) => void; confidence: number; setConfidence: (value: number) => void; postStance: Stance; setPostStance: (stance: Stance) => void; understanding: string; setUnderstanding: (value: string) => void; responses: Record<number, string>; setResponses: Dispatch<SetStateAction<Record<number, string>>>; opponentMessages: Record<number, string>; setOpponentMessages: Dispatch<SetStateAction<Record<number, string>>>; onModeChange: (mode: Mode) => void; onComplete: () => Promise<void>; onExit: () => void; onNotify: (message: string) => void; onReport: (payload: ReportInput) => Promise<void>; onPersistRound?: (nextStep: number, response: string | null, opponentMessage: string) => Promise<void>; aiMode: AiMode; online?: boolean }) {
  const [modeChoice, setModeChoice] = useState(mode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  const t = useTranslations(language)
  const takeTextValue = takeText(activeTake, language)
  const assignedSide = assignSide(stance, modeChoice, activeTake)
  const currentResponse = responses[step] || ''
  const previousOpponent = opponentMessages[step - 1] || ''
  const stage: Stage = step === 0 ? 'stance' : step === 6 ? 'post' : 'argument'
  const draftKey = `debate:${activeTake.id}:${modeChoice}:${step}`
  const stageNames = stageKeys.map(key => t(key))

  useEffect(() => {
    if (stage !== 'argument' || currentResponse) return
    const restored = loadArgumentDraft(draftKey)
    if (restored) setResponses(current => current[step] ? current : { ...current, [step]: restored })
  }, [currentResponse, draftKey, setResponses, stage, step])
  useEffect(() => { if (stage === 'argument') saveArgumentDraft(draftKey, currentResponse) }, [currentResponse, draftKey, stage])
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (stage === 'argument' && currentResponse.trim()) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentResponse, stage])

  function exitWithProtection() {
    if (stage === 'argument' && currentResponse.trim() && !window.confirm(t('classic.exitConfirm'))) return
    onExit()
  }

  async function advanceFromStance() {
    try { await onPersistRound?.(1, null, '') } catch { onNotify(t('classic.advanceLocal')) }
    setStep(1)
  }

  async function saveResponse() {
    if (!isOnline) return setError(t('classic.offline'))
    if (currentResponse.trim().length < 12) return setError(t('classic.minLength'))
    if (busy) return
    const trimmed = currentResponse.trim()
    setBusy(true)
    setError('')
    setResponses(current => ({ ...current, [step]: trimmed }))
    trackEvent('debate_round_submitted', { round: step })
    const persistAdvance = async (nextStep: number, opponentMessage: string) => {
      try { await onPersistRound?.(nextStep, trimmed, opponentMessage) } catch { onNotify(t('classic.roundLocal')) }
    }
    if (step === 5) {
      clearArgumentDraft(draftKey)
      await persistAdvance(6, '')
      setStep(6)
      setBusy(false)
      return
    }
    try {
      const output = await apiFetch<{ response: string; question: string }>('/api/ai/opponent', { method: 'POST', body: JSON.stringify({ take: { statement: activeTake.statement, context: activeTake.context }, assignedSide, round: step, latestArgument: trimmed, language }) })
      const opponentMessage = output.response + '\n\n' + t('classic.question') + ' ' + output.question
      setOpponentMessages(current => ({ ...current, [step]: opponentMessage }))
      clearArgumentDraft(draftKey)
      await persistAdvance(step + 1, opponentMessage)
      setStep(step + 1)
    } catch {
      const fallback = createMockOpponent(activeTake, assignedSide, step, trimmed, language)
      const opponentMessage = fallback.response + '\n\n' + t('classic.question') + ' ' + fallback.question
      setOpponentMessages(current => ({ ...current, [step]: opponentMessage }))
      clearArgumentDraft(draftKey)
      await persistAdvance(step + 1, opponentMessage)
      setStep(step + 1)
      onNotify(t('classic.aiFallback'))
    } finally {
      setBusy(false)
    }
  }

  async function complete() {
    if (!isOnline) return setError(t('classic.offline'))
    if (busy) return
    setBusy(true)
    setError('')
    try { await onComplete() } catch (caught) { setError(caught instanceof Error ? caught.message : t('classic.scoringFailed')); setBusy(false) }
  }

  async function reportIssue() {
    const reason = window.prompt(t('classic.reportReason'), 'other')?.trim()
    if (!reason) return
    const details = window.prompt(t('classic.reportDetails'), '')?.trim() || null
    try { await onReport({ debateId: null, challengeId: null, reportedContentType: 'debate', reason, details }); onNotify(t('classic.reportSubmitted')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('classic.reportFailed')) }
  }

  const modeLabel = (modeChoice === 'sideswitch' ? t('classic.sideSwitchMode') : modeChoice === 'blindside' ? t('classic.blindsideMode') : t('classic.classicMode')).toUpperCase()
  return <div className="debate-page"><div className="debate-top"><button type="button" className="back-button" onClick={exitWithProtection}><Icon name="close" size={18} /> {t('classic.exit')}</button><div className="debate-progress"><span>{t('classic.roundProgress', { current: Math.min(step + 1, 7), total: 7 })}</span><div className="progress-track"><i style={{ width: `${(step / 6) * 100}%` }} /></div></div><button type="button" className="report-button" onClick={() => void reportIssue()}><Icon name="shield" size={15} /> {t('classic.report')}</button></div><div className="debate-layout"><aside className="debate-sidebar"><div className="debate-take-label"><Tag tone="dark">{modeLabel}</Tag><span><Icon name="clock" size={13} /> {activeTake.time}</span></div><h2>{takeTextValue.statement}</h2><div className="assignment-card"><span className="assignment-lock"><Icon name="lock" size={14} /></span><small>{t('classic.assignedSide')}</small><strong>{step === 0 ? t('classic.hiddenSide') : assignedSide}</strong>{step === 0 ? <span className="assignment-hidden">{t('classic.privateThenFlip')}</span> : <span className="assignment-note"><Icon name="spark" size={13} /> {modeChoice === 'sideswitch' ? t('classic.oppositeSide') : t('classic.chosenSide')}</span>}</div><div className="stage-list">{stageNames.map((name, index) => <div className={`stage-item ${index === step ? 'current' : ''} ${index < step ? 'completed' : ''}`} key={name}><span className="stage-marker">{index < step ? <Icon name="check" size={12} /> : index + 1}</span><span>{name}</span>{index === step && <i />}</div>)}</div><div className="debate-safety"><Icon name="shield" size={15} /><span>{t('classic.structured')}<br />{aiMode === 'mock' ? t('classic.mockActive') : t('classic.runtime', { runtime: 'AI' })}</span></div></aside><section className="debate-main">{stage === 'stance' && <StanceStage take={activeTake} language={language} mode={modeChoice} setMode={value => { setModeChoice(value); onModeChange(value) }} stance={stance} setStance={setStance} confidence={confidence} setConfidence={setConfidence} onContinue={() => void advanceFromStance()} />}{stage === 'argument' && <ArgumentStage language={language} step={step} message={previousOpponent} response={currentResponse} setResponse={value => setResponses(current => ({ ...current, [step]: value }))} busy={busy} error={error} onContinue={saveResponse} />}{stage === 'post' && <PostStage language={language} stance={stance} confidence={confidence} postStance={postStance} setPostStance={setPostStance} understanding={understanding} setUnderstanding={setUnderstanding} busy={busy} error={error} onComplete={complete} />}</section></div></div>
}

function ModeCard({ mode, title, description, icon, accent, selected, badge, onClick }: { mode: Mode; title: string; description: string; icon: IconName; accent: string; selected: boolean; badge?: string; onClick: () => void }) {
  return <button type="button" className={`mode-card ${selected ? 'selected' : ''} accent-${accent}`} aria-pressed={selected} onClick={onClick}><span className="mode-icon"><Icon name={icon} size={21} /></span><span className="mode-copy"><strong>{title}</strong><small>{description}</small></span>{badge && <Tag tone="new">{badge}</Tag>}<span className="mode-check">{selected && <Icon name="check" size={14} />}</span></button>
}

function StanceStage({ take, language, mode, setMode, stance, setStance, confidence, setConfidence, onContinue }: { take: Take; language: Language; mode: Mode; setMode: (mode: Mode) => void; stance: Stance; setStance: (stance: Stance) => void; confidence: number; setConfidence: (value: number) => void; onContinue: () => void }) {
  const t = useTranslations(language)
  const labels = [t('classic.stance.stronglyDisagree'), t('classic.stance.disagree'), t('classic.stance.unsure'), t('classic.stance.agree'), t('classic.stance.stronglyAgree')]
  const text = takeText(take, language)
  const confidenceLabel = confidence <= 2 ? t('classic.openMinded') : confidence === 3 ? t('classic.onTheFence') : t('classic.prettySure')
  return <div className="stage-panel"><div className="stage-kicker"><span className="stage-number">01</span><span>{t('classic.beforeBegin')}</span></div><h1>{t('classic.stanceTitle')}</h1><p className="stage-intro">{t('classic.stanceBody')}</p><div className="private-note"><Icon name="lock" size={16} /><span><strong>{t('classic.startPrivate')}</strong><small>{t('classic.onlyYou')}</small></span></div><div className="stance-prompt"><span className="eyebrow">{t('classic.take')}</span><h2>{text.statement}</h2></div><div className="stance-scale">{labels.map((label, index) => { const value = (index - 2) as Stance; return <button type="button" key={label} className={`stance-option stance-${index} ${stance === value ? 'selected' : ''}`} aria-pressed={stance === value} onClick={() => setStance(value)}><span className="stance-dot" /><span>{label}</span></button> })}</div><div className="confidence-row"><span>{t('classic.confidence')}</span><div className="confidence-options">{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} className={confidence === value ? 'selected' : ''} aria-pressed={confidence === value} onClick={() => setConfidence(value)}>{value}</button>)}</div><span className="confidence-label">{confidenceLabel}</span></div><div className="mode-select"><span className="eyebrow">{t('classic.chooseMode')}</span><ModeCard mode="classic" title={t('classic.classicMode')} description={t('classic.classicModeBody')} icon="sun" accent="coral" selected={mode === 'classic'} onClick={() => setMode('classic')} /><ModeCard mode="sideswitch" title={t('classic.sideSwitchMode')} description={t('classic.sideSwitchModeBody')} icon="spark" accent="lavender" selected={mode === 'sideswitch'} badge={t('classic.signature')} onClick={() => setMode('sideswitch')} /><ModeCard mode="blindside" title={t('classic.blindsideMode')} description={t('classic.blindsideModeBody')} icon="bolt" accent="yellow" selected={mode === 'blindside'} onClick={() => setMode('blindside')} /></div><Button className="stage-continue" icon="arrow" onClick={onContinue}>{t('classic.lockStance')}</Button></div>
}

function ArgumentStage({ language, step, message, response, setResponse, busy, error, onContinue }: { language: Language; step: number; message: string; response: string; setResponse: (value: string) => void; busy: boolean; error: string; onContinue: () => void }) {
  const t = useTranslations(language)
  const stageInfo: Record<number, { kicker: TranslationKey; title: TranslationKey; prompt: TranslationKey; placeholder: TranslationKey; limit: number }> = { 1: { kicker: 'classic.makeCase', title: 'classic.openingTitle', prompt: 'classic.openingPrompt', placeholder: 'classic.openingPlaceholder', limit: 350 }, 2: { kicker: 'classic.goDeeper', title: 'classic.rebuttalTitle', prompt: 'classic.rebuttalPrompt', placeholder: 'classic.rebuttalPlaceholder', limit: 350 }, 3: { kicker: 'classic.pressureTest', title: 'classic.pressureTitle', prompt: 'classic.pressurePrompt', placeholder: 'classic.pressurePlaceholder', limit: 280 }, 4: { kicker: 'classic.steelman', title: 'classic.steelmanTitle', prompt: 'classic.steelmanPrompt', placeholder: 'classic.steelmanPlaceholder', limit: 220 }, 5: { kicker: 'classic.lastThought', title: 'classic.lastTitle', prompt: 'classic.lastPrompt', placeholder: 'classic.lastPlaceholder', limit: 220 } }
  const info = stageInfo[step]
  const responseLabel = step === 4 ? t('classic.yourSteelman') : step === 3 ? t('classic.yourResponse') : t('classic.yourArgument')
  return <div className="stage-panel argument-panel"><div className="stage-kicker"><span className="stage-number">0{step + 1}</span><span>{t(info.kicker)}</span></div><div className="argument-heading"><div><h1>{t(info.title)}</h1><p className="stage-intro">{t(info.prompt)}</p></div><div className="turn-badge"><span className="ai-pulse" /> {busy ? t('classic.aiThinking') : step === 3 ? t('classic.aiAsks') : t('classic.yourTurn')}</div></div><div className="opponent-message"><div className="message-avatar"><span>AI</span><i /></div><div><div className="message-meta"><strong>{message ? t('classic.sharpSkeptic') : t('classic.yourOpening')}</strong><span>{message ? t('classic.justNow') : t('classic.waitingFirstMove')}</span></div><p>{message || t('classic.opponentWillRespond')}</p>{message && <button type="button" className="message-more" onClick={() => window.alert(t('classic.whyResponseDetail'))}>{t('classic.whyResponse')} <Icon name="help" size={13} /></button>}</div></div><div className="response-box"><div className="response-box-top"><span className="eyebrow">{responseLabel}</span><span className={response.length >= info.limit ? 'counter over' : 'counter'}>{response.length} / {info.limit}</span></div><textarea aria-label={t(info.title)} autoFocus value={response} onChange={event => setResponse(event.target.value.slice(0, info.limit))} placeholder={t(info.placeholder)} disabled={busy} /><div className="response-box-bottom"><span><Icon name="info" size={14} /> {t('classic.keepSpecific')}</span><Button icon="arrow" onClick={onContinue} disabled={response.trim().length < 12 || busy}>{busy ? t('classic.thinking') : step === 5 ? t('classic.seeShift') : t('classic.sendResponse')}</Button></div>{error && <p className="form-error" role="alert">{error}</p>}</div><div className="argument-footer"><span><Icon name="lock" size={13} /> {t('classic.onlyOpponent')}</span><span>{t('classic.charLimit')}</span></div></div>
}

function PostStage({ language, stance, confidence, postStance, setPostStance, understanding, setUnderstanding, busy, error, onComplete }: { language: Language; stance: Stance; confidence: number; postStance: Stance; setPostStance: (value: Stance) => void; understanding: string; setUnderstanding: (value: string) => void; busy: boolean; error: string; onComplete: () => void }) {
  const t = useTranslations(language)
  const labels = [t('classic.stance.stronglyDisagree'), t('classic.stance.disagree'), t('classic.stance.unsure'), t('classic.stance.agree'), t('classic.stance.stronglyAgree')]
  const moved = movementBetween(stance, postStance)
  const movedLabel = moved === 0 ? t('classic.samePlace') : Math.abs(moved) === 1 ? t('classic.oneStepMoved') : t('classic.manyStepsMoved', { count: Math.abs(moved) })
  return <div className="stage-panel post-panel"><div className="stage-kicker"><span className="stage-number">07</span><span>{t('classic.momentTruth')}</span></div><h1>{t('classic.didShift')}</h1><p className="stage-intro">{t('classic.noPressure')}</p><div className="post-compare"><div><span className="eyebrow">{t('classic.before')}</span><strong>{labels[stance + 2]}</strong><small>{t('classic.confidenceValue', { value: confidence })}</small></div><span className="compare-arrow"><Icon name="arrow" size={18} /></span><div className="post-value"><span className="eyebrow">{t('classic.after')}</span><strong>{labels[postStance + 2]}</strong><small>{movedLabel}</small></div></div><div className="post-stance"><span className="eyebrow">{t('classic.positionNow')}</span><div className="stance-scale post-scale">{labels.map((label, index) => { const value = (index - 2) as Stance; return <button type="button" key={label} className={`stance-option stance-${index} ${postStance === value ? 'selected' : ''}`} aria-pressed={postStance === value} onClick={() => setPostStance(value)}><span className="stance-dot" /><span>{label}</span></button> })}</div></div><div className="understanding"><span className="eyebrow">{t('classic.understandOther')}</span><div className="understanding-options"><button type="button" className={understanding === 'yes' ? 'selected' : ''} onClick={() => setUnderstanding('yes')}><Icon name="check" size={15} /> {t('classic.definitely')}</button><button type="button" className={understanding === 'maybe' ? 'selected' : ''} onClick={() => setUnderstanding('maybe')}><Icon name="more" size={15} /> {t('classic.little')}</button><button type="button" className={understanding === 'no' ? 'selected' : ''} onClick={() => setUnderstanding('no')}><Icon name="x" size={15} /> {t('classic.notYet')}</button></div></div>{error && <p className="form-error" role="alert">{error}</p>}<Button className="stage-continue" icon="spark" onClick={onComplete} disabled={busy}>{busy ? t('classic.scoring') : t('classic.showResult')}</Button></div>
}

type ClassicDebateSessionProps = Parameters<typeof ClassicDebateSessionBase>[0]
export function ClassicDebateSession(props: ClassicDebateSessionProps) {
  const t = useTranslations(props.language)
  const pulse = props.activeTake.worldPulse
  return <><ClassicDebateSessionBase {...props} />{pulse && <aside className="debate-context-panel card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('worldPulse.sourcePanel')}</span><h2>{pulse.headline}</h2></div><Tag tone={pulse.sensitivity === 'standard' ? 'mint' : 'yellow'}>{pulse.sensitivity === 'standard' ? t('common.private') : t('worldPulse.sensitive')}</Tag></div><p>{pulse.neutralContext}</p><div className="world-pulse-sources">{pulse.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" onClick={event => { event.preventDefault(); void openExternalUrl(source.url) }}>{source.publisher}: {source.title}<Icon name="link" size={13} /></a>)}</div></aside>}</>
}

export const ClassicDebateSessionDependencies = Object.freeze({ component: 'ClassicDebateSession', stages: ['StanceStage', 'ArgumentStage', 'PostStage'] })
