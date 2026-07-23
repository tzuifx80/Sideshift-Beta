import { useEffect, useMemo, useRef, useState } from 'react'
import { takeText, type AiDebateData, type AiDifficulty, type AiQuality, type AiResponseLength, type AiRoundLength, type DebateLanguageCode, type DebateLanguageMode, type Language, type ResultData, type Take } from './domain'
import { DebateLanguageControl, DebateLanguageStatus } from './components/DebateLanguageControl'
import { buildDebateContext, validateCustomMotion, type ContextTurn } from './lib/ai/contextBuilder'
import { normalizeAiError } from './lib/ai/errors'
import { resolveOpponents } from './lib/ai/modelResolver'
import { basicOpponent, opponents } from './lib/ai/opponents'
import { diagnoseBasicTurn, prepareBasicTurn, shouldAcceptBasicTurnResponse } from './lib/ai/turnState'
import { consumeLastTurnResult, getActiveDebateEngineContext, setActiveDebateEngineContext } from './lib/debateEngine/context'
import { debateLanguageDisplayName, isReliableCoreLanguage, lockDebateLanguage, resolveDebateLanguage } from './lib/debateLanguage'
import type { AiFeedbackType, AiModelSelection, AiProvider, AiStartConfig, ResolvedOpponent } from './lib/ai/types'
import type { UserPreferences } from './data/types'
import { clearAiSetupDraft, clearArgumentDraft, loadAiSetupDraft, loadArgumentDraft, saveAiSetupDraft, saveArgumentDraft, type AiSetupDraft } from './drafts'
import { useTranslations } from './i18n'
import type { TranslationKey } from './i18n'

function aiButton(label: string, onClick: () => void, variant = 'primary', disabled = false) {
  return <button type="button" className={`button button-${variant}`} onClick={onClick} disabled={disabled}>{label}</button>
}

const aiScoreLabelKeys: Partial<Record<string, TranslationKey>> = {
  Clarity: 'results.label.clarity',
  Relevance: 'results.label.relevance',
  Reasoning: 'results.label.reasoning',
  Rebuttal: 'results.label.rebuttal',
  Fairness: 'results.label.fairness'
}

function translateConcession(concession: string | undefined, t: ReturnType<typeof useTranslations>) {
  if (concession === 'user') return t('ai.active.concessionUser')
  if (concession === 'opponent') return t('ai.active.concessionOpponent')
  if (concession === 'both') return t('ai.active.concessionBoth')
  return t('ai.active.concessionNone')
}

function translateScoreLabel(label: string, t: ReturnType<typeof useTranslations>) {
  const key = aiScoreLabelKeys[label]
  return key ? t(key) : label
}

function translateAiQuality(value: AiQuality | undefined, t: ReturnType<typeof useTranslations>) {
  if (value === 'fast') return t('ai.qualityFast')
  if (value === 'maximum') return t('ai.qualityMaximum')
  return t('ai.qualityBalanced')
}

function translateAiResponseLength(value: AiResponseLength | undefined, t: ReturnType<typeof useTranslations>) {
  if (value === 'concise') return t('ai.responseConcise')
  if (value === 'detailed') return t('ai.responseDetailed')
  return t('ai.responseStandard')
}

function argumentHintKey(round: number): TranslationKey {
  if (round <= 1) return 'ai.argumentHint.round1'
  if (round === 2) return 'ai.argumentHint.round2'
  if (round === 3) return 'ai.argumentHint.round3'
  return 'ai.argumentHint.roundLater'
}

function translateEngineStatus(note: 'idle' | 'enhanced' | 'reliable' | 'offline' | 'enhancement_unavailable' | 'quota' | 'local_review', t: ReturnType<typeof useTranslations>) {
  if (note === 'enhanced') return t('ai.enhancedActive')
  if (note === 'reliable') return t('ai.reliableActive')
  if (note === 'offline') return t('ai.offlineAvailable')
  if (note === 'enhancement_unavailable') return t('ai.enhancementUnavailable')
  if (note === 'quota') return t('ai.quotaReached')
  if (note === 'local_review') return t('ai.localReview')
  return t('ai.preparingDebate')
}

function EngineStatusPill({ note, language }: { note: 'idle' | 'enhanced' | 'reliable' | 'offline' | 'enhancement_unavailable' | 'quota' | 'local_review'; language: Language }) {
  const t = useTranslations(language)
  if (note === 'idle') return null
  return <span className="ai-engine-status-pill" role="status">{translateEngineStatus(note, t)}</span>
}

export function AiResults(props: { language: Language; result: ResultData; onRematch: () => void; onSwap: () => void; onChangeOpponent: () => void; onAnotherTake: () => void }) {
  const review = props.result.ai?.evaluation
  const t = useTranslations(props.language)
  return <><AiResultsBase {...props} />{review && <section className="page ai-results-addendum"><details className="ai-score-details card-surface"><summary>{t('ai.scoreWhy')}</summary><p>{t('ai.scoreGrounding')}</p><dl><dt>{t('ai.unansweredPoint')}</dt><dd>{review.unansweredOpponentPoint || review.missedCounterargument}</dd><dt>{t('ai.concessionSignal')}</dt><dd>{translateConcession(review.concession, t)}</dd><dt>{t('ai.improvement')}</dt><dd>{review.improvedExampleResponse}</dd></dl></details></section>}</>
}

const qualityOptions: Array<[AiQuality, TranslationKey, TranslationKey]> = [['fast', 'ai.qualityFast', 'ai.qualityFastBody'], ['balanced', 'ai.qualityBalanced', 'ai.qualityBalancedBody'], ['maximum', 'ai.qualityMaximum', 'ai.qualityMaximumBody']]
const responseOptions: Array<[AiResponseLength, TranslationKey, TranslationKey]> = [['concise', 'ai.responseConcise', 'ai.responseConciseBody'], ['standard', 'ai.responseStandard', 'ai.responseStandardBody'], ['detailed', 'ai.responseDetailed', 'ai.responseDetailedBody']]

export function AiConnectionCard({ provider, language, onChange, mock = false }: { provider: AiProvider; language: Language; onChange?: () => void; mock?: boolean }) {
  const t = useTranslations(language)
  const [status, setStatus] = useState<Awaited<ReturnType<AiProvider['getStatus']>>>('disconnected')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { void provider.getStatus().then(setStatus) }, [provider])
  async function connect() {
    setBusy(true); setError(''); setStatus('connecting')
    try { await provider.connect(); setStatus('connected'); onChange?.() } catch (caught) { const errorValue = normalizeAiError(caught); setStatus('failed'); setError(errorValue.message) } finally { setBusy(false) }
  }
  const livePuter = provider.kind === 'puter' && !mock
  const liveBasic = provider.kind === 'basic' && !mock
  return <div className="ai-connection-card"><div className="ai-connection-mark">✦</div><div className="ai-connection-copy"><span className="eyebrow">{liveBasic ? t('ai.basicTitle') : livePuter ? t('ai.connectionLive') : t('ai.connectionMock')}</span><strong>{status === 'connected' ? t('ai.connected') : status === 'connecting' ? t('ai.connecting') : status === 'failed' ? t('ai.failed') : t('ai.notConnected')}</strong><p>{liveBasic ? t('ai.basicBody') : livePuter ? t('ai.liveBody') : t('ai.mockBody')}</p><small>{liveBasic ? t('ai.basicAvailability') : livePuter ? t('ai.liveSmall') : t('ai.mockSmall')}</small></div>{status === 'connected' ? <span className="ai-status-pill connected">{t('ai.connected')}</span> : <button type="button" className="button button-secondary" onClick={() => void connect()} disabled={busy}>{busy ? t('ai.connecting') : liveBasic ? t('ai.basicTitle') : livePuter ? t('ai.connectPuter') : t('ai.activateMock')}</button>}{error && <p className="form-error ai-connection-error" role="alert">{error}</p>}</div>
}

function AiProviderChoice({ language, route, onSelect }: { language: Language; route: 'basic' | 'puter'; onSelect: (route: 'basic' | 'puter') => void }) {
  const t = useTranslations(language)
  return <section className="ai-provider-choice" aria-labelledby="ai-provider-choice-title"><div><span className="eyebrow">{t('ai.providerChoice')}</span><h2 id="ai-provider-choice-title">{t('ai.providerChoice')}</h2></div><div className="provider-choice-grid"><button type="button" className={`provider-choice-card ${route === 'basic' ? 'selected' : ''}`} aria-pressed={route === 'basic'} onClick={() => onSelect('basic')}><strong>{t('ai.basicTitle')}</strong><span>{t('ai.basicBody')}</span><small>{t('ai.basicAvailability')}</small></button><button type="button" className={`provider-choice-card ${route === 'puter' ? 'selected' : ''}`} aria-pressed={route === 'puter'} onClick={() => onSelect('puter')}><strong>{t('ai.connectPuter')}</strong><span>{t('ai.puterBody')}</span><small>{t('ai.puterOptional')}</small></button></div></section>
}

export function AiSetup({ provider, basicProvider, puterProvider, take, language, preferences, preset, onStart, onBack, mock = false, online = true, engineStatusNote = 'idle' }: { provider: AiProvider; basicProvider?: AiProvider; puterProvider?: AiProvider | null; take: Take; language: Language; preferences: UserPreferences; preset?: Partial<AiStartConfig>; onStart: (config: AiStartConfig, take: Take) => Promise<void>; onBack: () => void; mock?: boolean; online?: boolean; engineStatusNote?: 'idle' | 'enhanced' | 'reliable' | 'offline' | 'enhancement_unavailable' | 'quota' | 'local_review' }) {
  const t = useTranslations(language)
  const saved = preset ? null : loadAiSetupDraft(take.id)
  const [status, setStatus] = useState<Awaited<ReturnType<AiProvider['getStatus']>>>('disconnected')
  const [catalogue, setCatalogue] = useState<Awaited<ReturnType<AiProvider['listModels']>>>([])
  const [resolved, setResolved] = useState<ResolvedOpponent[]>([])
  const [usage, setUsage] = useState<Awaited<ReturnType<AiProvider['getUsage']>>>(null)
  const [selectedId, setSelectedId] = useState(saved?.selectedId || preset?.opponent?.id || opponents.find(opponent => opponent.family === preferences.preferredAiFamily)?.id || preferences.preferredOpponentId)
  const [difficulty, setDifficulty] = useState<AiDifficulty>(saved?.difficulty || preset?.difficulty || preferences.aiDifficulty)
  const [roundLength, setRoundLength] = useState<AiRoundLength>(saved?.roundLength || preset?.roundLength || preferences.aiRoundLength)
  const [quality, setQuality] = useState<AiQuality>(saved?.quality || preset?.quality || preferences.aiQuality)
  const [responseLength, setResponseLength] = useState<AiResponseLength>(saved?.responseLength || preset?.responseLength || preferences.aiResponseLength)
  const [modelSelection, setModelSelection] = useState<AiModelSelection>(saved?.modelSelection || preset?.modelSelection || (preferences.preferredAiModelId ? 'exact' : 'automatic'))
  const [exactModelId, setExactModelId] = useState(saved?.exactModelId || (preset?.modelSelection === 'exact' ? preset.opponent?.model?.id || null : preferences.preferredAiModelId))
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [puterOpen, setPuterOpen] = useState(false)
  const [userSide, setUserSide] = useState(saved?.userSide || preset?.userSide || take.supportLabel)
  const [customMotion, setCustomMotion] = useState(saved?.customMotion || preset?.customMotion || '')
  const [debateLanguageMode, setDebateLanguageMode] = useState<DebateLanguageMode>(saved?.debateLanguageMode || preset?.debateLanguageMode || 'auto')
  const [debateLanguageCode, setDebateLanguageCode] = useState<DebateLanguageCode>(saved?.debateLanguageCode || preset?.debateLanguageCode || preferences.debateLanguages[0] || language)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [route, setRoute] = useState<'basic' | 'puter'>(mock ? 'puter' : 'basic')
  const [lazyPuterProvider, setLazyPuterProvider] = useState<AiProvider | null>(null)
  const routeProvider = route === 'basic' ? (basicProvider || provider) : (puterProvider || lazyPuterProvider || provider)
  const text = takeText(take, language)
  const motion = customMotion.trim() || text.statement
  const selected = resolved.find(opponent => opponent.id === selectedId) || null
  const roundCount = route === 'basic' ? 3 : roundLength === 'quick' ? 3 : roundLength === 'deep' ? 6 : 4
  const allowanceExhausted = (usage?.remaining !== null && usage?.remaining !== undefined && usage.remaining <= 0) || usage?.turnsRemaining === 0
  const savedModelUnavailable = modelSelection === 'exact' && Boolean(exactModelId) && Boolean(selected && !selected.models.some(model => model.id === exactModelId))

  useEffect(() => {
    saveAiSetupDraft({ takeId: take.id, selectedId: selectedId || '', difficulty, roundLength, quality, responseLength, modelSelection, exactModelId, userSide, customMotion, debateLanguageMode, debateLanguageCode } satisfies AiSetupDraft)
  }, [customMotion, debateLanguageCode, debateLanguageMode, difficulty, exactModelId, modelSelection, quality, responseLength, roundLength, selectedId, take.id, userSide])

  useEffect(() => {
    if (route === 'basic') {
      const model = catalogue[0]
      setResolved(model ? [{ ...basicOpponent, available: true, model, models: [model], selection: 'automatic' }] : [])
    } else setResolved(resolveOpponents(catalogue, { quality, exactModelIds: modelSelection === 'exact' ? { [selected?.family || 'GPT']: exactModelId } : undefined }))
  }, [catalogue, exactModelId, modelSelection, quality, route, selected?.family])

  async function refreshModels(force = false) {
    try {
      const current = await routeProvider.getStatus(); setStatus(current); if (current !== 'connected') return
      const [models, currentUsage] = await Promise.all([routeProvider.listModels(force), routeProvider.getUsage()])
      setCatalogue(models); setUsage(currentUsage); setError('')
    } catch (caught) { const errorValue = normalizeAiError(caught); setError(errorValue.message); setStatus('failed') }
  }
  useEffect(() => {
    if (route === 'basic') {
      void provider.connect().then(() => refreshModels(true)).catch(() => setStatus('connected'))
      return
    }
    setStatus('disconnected')
    setCatalogue([])
    setResolved([])
    setSelectedId(preferences.preferredOpponentId === basicOpponent.id ? opponents[0].id : preferences.preferredOpponentId)
    void refreshModels()
  }, [route, routeProvider])
  useEffect(() => {
    if (route !== 'puter' || puterProvider || lazyPuterProvider || mock) return
    void import('./lib/ai/puterProvider').then(({ createPuterProvider }) => setLazyPuterProvider(createPuterProvider())).catch(() => setError(t('ai.puterUnavailable')))
  }, [lazyPuterProvider, mock, puterProvider, route, t])
  async function connect() {
    setBusy(true); setError(''); setStatus('connecting')
    try { await routeProvider.connect(); await refreshModels(true) } catch (caught) { const errorValue = normalizeAiError(caught); setStatus('failed'); setError(errorValue.message) } finally { setBusy(false) }
  }
  function chooseOpponent(id: string) {
    setSelectedId(id)
    const next = resolved.find(opponent => opponent.id === id)
    if (modelSelection === 'exact' && next && !next.models.some(model => model.id === exactModelId)) setExactModelId(null)
  }
  async function start() {
    if (route !== 'basic' && status !== 'connected') return setError(t('ai.connectBeforeStart'))
    if (route !== 'basic' && allowanceExhausted) return setError(t('ai.allowanceExhausted'))
    if (route === 'basic' && !online && debateLanguageMode === 'explicit' && !isReliableCoreLanguage(debateLanguageCode)) {
      return setError(t('ai.debateLanguage.onlineRequired'))
    }
    const debateModel = { id: 'sideshift-debate', provider: 'SideShift', name: 'SideShift Debate', aliases: [], context: null, maxTokens: 180, inputCost: null, outputCost: null, supportsText: true, supportsChat: true, supportsStreaming: true, isLegacy: false, raw: {} }
    const opponent = selected?.available && selected.model
      ? selected
      : route === 'basic'
        ? { ...basicOpponent, available: true, model: debateModel, models: [debateModel], selection: 'automatic' as const }
        : null
    if (!opponent?.model) return setError(t('ai.chooseAvailable'))
    let privateMotion: string | null
    try { privateMotion = customMotion.trim() ? validateCustomMotion(customMotion) : null } catch (caught) { return setError(caught instanceof Error ? caught.message : t('ai.invalidMotion')) }
    setBusy(true); setError('')
    try {
      clearAiSetupDraft()
      const aiSide = userSide === take.supportLabel ? take.opposeLabel : take.supportLabel
      await onStart({ opponent, difficulty, roundLength: route === 'basic' ? 'quick' : roundLength, quality: route === 'basic' ? 'balanced' : quality, responseLength: route === 'basic' ? 'concise' : responseLength, modelSelection: route === 'basic' ? 'automatic' : opponent.selection, userSide, aiSide, customMotion: privateMotion, debateLanguageMode, debateLanguageCode: debateLanguageMode === 'explicit' ? debateLanguageCode : undefined }, privateMotion ? { ...take, id: `private-${Date.now()}`, statement: privateMotion, statementDe: privateMotion, context: t('ai.active.privateMotion'), contextDe: t('ai.active.privateMotion') } : take)
    } catch (caught) { setError(caught instanceof Error ? caught.message : t('ai.startError')) } finally { setBusy(false) }
  }
  const fallbackOpponents = opponents.map(opponent => ({ ...opponent, available: false, model: null, models: [], selection: 'automatic' as const }))
  const visibleOpponents = resolved.length ? resolved : route === 'basic' ? [] : fallbackOpponents
  const roundOptions = [['quick', 'ai.roundQuick', 3], ['standard', 'ai.roundStandard', 4], ['deep', 'ai.roundDeep', 6]] as const
  return <div className="page ai-setup-page"><button type="button" className="back-link" onClick={onBack}>← {t('common.back')}</button><div className="page-heading"><div><span className="eyebrow">{t('ai.setupEyebrow')}</span><h1>{route === 'basic' ? t('ai.debateTitle') : t('ai.setupTitle')}</h1><p className="muted">{route === 'basic' ? t('ai.setupSimpleBody') : t('ai.setupBody')}</p><small className="field-help">{route === 'basic' ? t('ai.debateSupport') : ''}</small></div><EngineStatusPill note={online ? engineStatusNote : 'offline'} language={language} /></div>{route === 'puter' && <AiProviderChoice language={language} route={route} onSelect={nextRoute => { setRoute(nextRoute); setError('') }} />}{route === 'puter' && status !== 'connected' && <AiConnectionCard provider={routeProvider} language={language} mock={mock} onChange={() => void refreshModels(true)} />}{route === 'puter' && status === 'connected' && <div className={`ai-allowance-card ${allowanceExhausted ? 'exhausted' : ''}`}><span><strong>{t('ai.allowance')}</strong>{usage?.remaining === null || !usage ? t('ai.usageUnavailable') : allowanceExhausted ? t('ai.noAllowance') : t('ai.remaining', { count: usage.remaining })}</span><button type="button" className="text-link" onClick={() => void refreshModels(true)}>{t('ai.refreshAllowance')}</button><small>{t('ai.usageNotice')}</small></div>}<section className="ai-setup-section card-surface"><DebateLanguageControl language={language} mode={debateLanguageMode} code={debateLanguageCode} online={online} onChange={next => { setDebateLanguageMode(next.mode); setDebateLanguageCode(next.code) }} /></section><section className="ai-setup-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('ai.motion')}</span><h2>{customMotion.trim() ? t('ai.privateMotion') : text.category}</h2></div><span className="ai-round-badge">{t('ai.rounds', { count: roundCount })}</span></div><p className="ai-motion-copy">{motion}</p><label className="field-label" htmlFor="ai-custom-motion">{t('ai.privateMotion')} <span>({t('common.optional')})</span></label><textarea id="ai-custom-motion" className="settings-textarea" maxLength={240} value={customMotion} onChange={event => setCustomMotion(event.target.value)} placeholder={t('ai.privateMotionPlaceholder')} dir="auto" /><small className="field-help">{t('ai.motionHelp')}</small></section>{visibleOpponents.length > 0 && <section className="ai-setup-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('ai.opponents')}</span><h2>{t('ai.pushBack')}</h2></div></div><div className="opponent-grid">{visibleOpponents.map(opponent => <button type="button" key={opponent.id} className={`opponent-card ${selectedId === opponent.id ? 'selected' : ''}`} disabled={!opponent.available} aria-pressed={selectedId === opponent.id} onClick={() => chooseOpponent(opponent.id)}><span className="opponent-avatar">{opponent.icon}</span><span><strong>{opponent.displayName}</strong><small>{opponent.description}</small><em>{opponent.available ? `${preferences.showModelDetails ? t('ai.active.model', { value: opponent.model?.name || opponent.model?.id || t('ai.compatibleModel') }) : t('ai.compatibleModel')}` : status === 'connected' ? t('ai.noCompatibleModel') : t('ai.connectToCheck')}</em></span></button>)}</div></section>}{route !== 'basic' ? <section className="ai-setup-section card-surface"><span className="field-label">{t('ai.quality')}</span><div className="ai-length-options ai-quality-options">{qualityOptions.map(([value, label, description]) => <button type="button" key={value} className={quality === value ? 'selected' : ''} onClick={() => setQuality(value)}><strong>{t(label)}</strong><small>{t(description)}</small></button>)}</div>{quality === 'maximum' && <p className="ai-setting-note">{t('ai.maximumNote')}</p>}<div className="settings-fields-grid"><label className="field-label">{t('ai.yourSide')}<select className="settings-select" value={userSide} onChange={event => setUserSide(event.target.value)}><option value={take.supportLabel}>{take.supportLabel}</option><option value={take.opposeLabel}>{take.opposeLabel}</option></select></label><label className="field-label">{t('ai.difficulty')}<select className="settings-select" value={difficulty} onChange={event => setDifficulty(event.target.value as AiDifficulty)}><option value="beginner">{t('ai.difficultyBeginner')}</option><option value="intermediate">{t('ai.difficultyIntermediate')}</option><option value="advanced">{t('ai.difficultyAdvanced')}</option><option value="expert">{t('ai.difficultyExpert')}</option></select></label></div><span className="field-label">{t('ai.debateLength')}</span><div className="ai-length-options">{roundOptions.map(([value, label, count]) => <button type="button" key={value} className={roundLength === value ? 'selected' : ''} onClick={() => setRoundLength(value)}><strong>{t(label)}</strong><small>{t('ai.rounds', { count })}</small></button>)}</div><span className="field-label ai-response-label">{t('ai.responseLength')}</span><div className="ai-length-options">{responseOptions.map(([value, label, description]) => <button type="button" key={value} className={responseLength === value ? 'selected' : ''} onClick={() => setResponseLength(value)}><strong>{t(label)}</strong><small>{t(description)}</small></button>)}</div></section> : <section className="ai-setup-section card-surface"><div className="settings-fields-grid"><label className="field-label">{t('ai.yourSide')}<select className="settings-select" value={userSide} onChange={event => setUserSide(event.target.value)}><option value={take.supportLabel}>{take.supportLabel}</option><option value={take.opposeLabel}>{take.opposeLabel}</option></select></label><label className="field-label">{t('ai.difficulty')}<select className="settings-select" value={difficulty} onChange={event => setDifficulty(event.target.value as AiDifficulty)}><option value="beginner">{t('ai.difficultyBeginner')}</option><option value="intermediate">{t('ai.difficultyIntermediate')}</option><option value="advanced">{t('ai.difficultyAdvanced')}</option><option value="expert">{t('ai.difficultyExpert')}</option></select></label></div><p className="field-help">{t('ai.basicBody')}</p></section>}{route !== 'basic' && <section className="ai-advanced-settings card-surface"><button type="button" className="ai-advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(open => !open)}><span><strong>{t('ai.advanced')}</strong><small>{t('ai.advancedBody')}</small></span><span aria-hidden="true">{advancedOpen ? '−' : '+'}</span></button>{advancedOpen && <div className="ai-advanced-content"><label className="toggle-row"><input type="checkbox" checked={modelSelection === 'exact'} onChange={event => setModelSelection(event.target.checked ? 'exact' : 'automatic')} /><span>{t('ai.exactModel')}</span><small>{t('ai.automaticFallback')}</small></label>{modelSelection === 'exact' && <label className="field-label">{t('ai.exactModelLabel')}<select className="settings-select" data-testid="ai-exact-model" value={exactModelId || ''} onChange={event => setExactModelId(event.target.value || null)}><option value="">{t('ai.automaticFallback')}</option>{selected?.models.map(model => <option key={model.id} value={model.id}>{model.name || model.id}{model.isLegacy ? ` (${t('ai.active.legacy')})` : ''}</option>)}</select></label>}{savedModelUnavailable && <p className="ai-setting-note">{t('ai.savedModelUnavailable')}</p>}<p className="field-help">{t('ai.modelCatalogueSource')}</p></div>}</section>}{error && <p className="form-error" role="alert">{error}</p>}<section className="ai-advanced-settings card-surface"><button type="button" className="ai-advanced-toggle" aria-expanded={puterOpen} onClick={() => setPuterOpen(open => !open)}><span><strong>{t('ai.puterAdvanced')}</strong><small>{t('ai.puterOptional')}</small></span><span aria-hidden="true">{puterOpen ? '−' : '+'}</span></button>{puterOpen && <div className="ai-advanced-content"><AiProviderChoice language={language} route={route} onSelect={nextRoute => { setRoute(nextRoute); setError('') }} />{route === 'puter' && status !== 'connected' && <AiConnectionCard provider={routeProvider} language={language} mock={mock} onChange={() => void refreshModels(true)} />}</div>}</section><div className="ai-setup-footer">{aiButton(route === 'basic' ? t('ai.debateStart') : t('ai.start'), () => void start(), 'dark', busy || (route !== 'basic' && (status !== 'connected' || allowanceExhausted || !selected?.available)))}<small>{route === 'basic' ? t('ai.debateSupport') : t('ai.liveBody')}</small></div></div>
}

function responseTokenLimit(length: AiResponseLength, opponentLimit: number): number {
  const requested = length === 'concise' ? 150 : length === 'detailed' ? 280 : 220
  return Math.min(requested, opponentLimit)
}

export function AiDebate({ provider, take, language, config, snapshot, draftId, online = true, engineStatusNote = 'idle', onSnapshot, onComplete, onExit, onFeedback, onNotify }: { provider: AiProvider; take: Take; language: Language; config: AiStartConfig; snapshot: AiDebateData; draftId: string; online?: boolean; engineStatusNote?: 'idle' | 'enhanced' | 'reliable' | 'offline' | 'enhancement_unavailable' | 'quota' | 'local_review'; onSnapshot: (snapshot: AiDebateData) => void; onComplete: (transcript: AiDebateData['transcript']) => Promise<void>; onExit: () => void; onFeedback: (feedback: AiFeedbackType) => Promise<void>; onNotify: (message: string) => void }) {
  const t = useTranslations(language)
  const [argument, setArgument] = useState('')
  const [generation, setGeneration] = useState<'idle' | 'streaming' | 'interrupted' | 'error'>('idle')
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState('')
  const finishInFlightRef = useRef(false)
  const streamRef = useRef<{ stop: () => void } | null>(null)
  const requestRef = useRef('')
  const submissionRef = useRef(false)
  const generationRef = useRef(generation)
  const mountedRef = useRef(true)
  const snapshotRef = useRef(snapshot)
  const reconnectRef = useRef<Promise<void> | null>(null)
  const providerRef = useRef(provider)
  const draftKey = `ai:${draftId}`
  const isBasic = config.opponent.id === 'sideshift-basic'
  const argumentTooShort = argument.trim().length > 0 && argument.trim().length < 12
  const debateLang = useMemo(() => resolveDebateLanguage({
    mode: snapshot.debateLanguageMode || 'auto',
    explicitCode: snapshot.debateLanguageCode,
    lockedCode: snapshot.debateLanguageCode,
    locked: snapshot.debateLanguageLocked,
    interfaceLocale: language,
    firstSubstantiveArgument: snapshot.transcript.find(turn => turn.role === 'user')?.content || null,
  }), [language, snapshot.debateLanguageCode, snapshot.debateLanguageLocked, snapshot.debateLanguageMode, snapshot.transcript])
  function applyDebateLanguageLock(nextArgument?: string) {
    const locked = lockDebateLanguage(debateLang, nextArgument)
    if (locked.code === snapshotRef.current.debateLanguageCode && locked.locked === snapshotRef.current.debateLanguageLocked) return locked
    const nextSnapshot = { ...snapshotRef.current, debateLanguageCode: locked.code, debateLanguageMode: locked.mode, debateLanguageLocked: locked.locked }
    publish(nextSnapshot)
    const ctx = getActiveDebateEngineContext()
    if (ctx) setActiveDebateEngineContext({ ...ctx, language: locked.code, languageName: locked.displayName })
    return locked
  }
  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])
  useEffect(() => { generationRef.current = generation }, [generation])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; streamRef.current?.stop() } }, [])
  useEffect(() => {
    if (providerRef.current !== provider) {
      providerRef.current = provider
      reconnectRef.current = null
    }
  }, [provider])
  useEffect(() => {
    const handleLifecycle = (event: Event) => {
      const active = (event as CustomEvent<{ isActive?: boolean }>).detail?.isActive
      if (active === true) { reconnectRef.current = null; return }
      if (active !== false || generationRef.current !== 'streaming') return
      const requestId = requestRef.current
      requestRef.current = ''
      streamRef.current?.stop()
      streamRef.current = null
      setGenerationState('interrupted')
      diagnoseBasicTurn({ round: Math.max(0, ...snapshotRef.current.transcript.map(turn => turn.round)), requestId, phase: 'lifecycle', outcome: 'backgrounded' })
      publish({ ...snapshotRef.current, interrupted: true, completionReason: 'interrupted' })
    }
    window.addEventListener('sideshift-lifecycle', handleLifecycle)
    return () => window.removeEventListener('sideshift-lifecycle', handleLifecycle)
  }, [])
  useEffect(() => {
    if (argument) return
    const restored = loadArgumentDraft(draftKey)
    if (restored) setArgument(restored)
  }, [argument, draftKey])
  useEffect(() => { saveArgumentDraft(draftKey, argument) }, [argument, draftKey])
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (argument.trim()) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [argument])
  async function ensureConnected(): Promise<void> {
    if (!reconnectRef.current) {
      reconnectRef.current = provider.getStatus().then(status => status === 'connected' ? undefined : provider.connect()).catch(error => { reconnectRef.current = null; throw error })
    }
    await reconnectRef.current
  }
  function publish(next: AiDebateData) { snapshotRef.current = next; onSnapshot(next) }
  function setGenerationState(next: 'idle' | 'streaming' | 'interrupted' | 'error') { generationRef.current = next; setGeneration(next) }
  const latestTurn = snapshot.transcript[snapshot.transcript.length - 1]
  const pendingUser = latestTurn?.role === 'user'
  const currentRound = Math.max(0, ...snapshot.transcript.map(turn => turn.round))
  const aiTurns = snapshot.transcript.filter(turn => turn.role === 'opponent')
  const completeReady = !pendingUser && aiTurns.length >= snapshot.roundLimit
  const userRound = pendingUser ? currentRound : currentRound + 1
  const awaitingUser = !completeReady && !pendingUser && generation !== 'streaming'
  const displayMotion = snapshot.customMotion || takeText(take, language).statement
  async function streamReply(transcript: AiDebateData['transcript'], round: number, latestArgument: string, requestId: string, languageState = debateLang) {
    requestRef.current = requestId; setGenerationState('streaming'); setError('')
    diagnoseBasicTurn({ round, requestId, phase: 'submit', outcome: 'started' })
    publish({ ...snapshotRef.current, transcript, partialResponse: '', interrupted: false, completionReason: null })
    const contextTurns: ContextTurn[] = transcript.slice(0, -1).map(turn => ({ role: turn.role === 'opponent' ? 'assistant' : 'user', content: turn.content, round: turn.round }))
    try {
      diagnoseBasicTurn({ round, requestId, phase: 'connect' })
      await ensureConnected()
      const stream = await provider.streamChat({ modelId: config.opponent.model?.id || '', messages: buildDebateContext({ motion: displayMotion, userSide: config.userSide, aiSide: config.aiSide, languageCode: languageState.code, languageName: languageState.displayName, difficulty: config.difficulty, roundLength: config.roundLength, round, roundLimit: snapshotRef.current.roundLimit, latestArgument, recentTurns: contextTurns, tacticsUsed: snapshotRef.current.transcript.filter(turn => turn.role === 'opponent').map(turn => turn.tactic || '').filter(Boolean), stylePrompt: config.opponent.stylePrompt }), maxTokens: responseTokenLimit(config.responseLength, config.opponent.maxResponseTokens), temperature: config.difficulty === 'expert' ? .25 : .4, debateId: draftId, round, requestId })
      if (!mountedRef.current || !shouldAcceptBasicTurnResponse({ expectedRequestId: requestRef.current, requestId })) { diagnoseBasicTurn({ round, requestId, phase: 'response', outcome: 'stale' }); stream.stop(); streamRef.current = null; return }
      diagnoseBasicTurn({ round, requestId, phase: 'response', outcome: 'accepted' })
      streamRef.current = stream; let partial = ''
      for await (const chunk of stream.chunks) { if (!mountedRef.current || !shouldAcceptBasicTurnResponse({ expectedRequestId: requestRef.current, requestId })) { diagnoseBasicTurn({ round, requestId, phase: 'chunk', outcome: 'stale' }); stream.stop(); streamRef.current = null; return }; partial += chunk; publish({ ...snapshotRef.current, transcript, partialResponse: partial, interrupted: false, completionReason: null }) }
      if (!mountedRef.current || !shouldAcceptBasicTurnResponse({ expectedRequestId: requestRef.current, requestId })) { diagnoseBasicTurn({ round, requestId, phase: 'complete', outcome: 'stale' }); streamRef.current = null; return }
      streamRef.current = null
      if (!partial.trim()) throw new Error('The AI returned an empty response. Retry this round.')
      const turnMeta = consumeLastTurnResult()
      publish({ ...snapshotRef.current, transcript: [...transcript, { role: 'opponent', round, content: partial.trim(), engineMode: turnMeta?.engineMode, engineVersion: turnMeta?.engineVersion, tactic: turnMeta?.tactic, requestId: turnMeta?.requestId || requestId, fallbackReason: turnMeta?.fallbackReason, latencyMs: turnMeta?.latencyMs, generatedAt: turnMeta?.generatedAt }], partialResponse: '', interrupted: false, completionReason: null }); setGenerationState('idle')
      diagnoseBasicTurn({ round, requestId, phase: 'complete', outcome: 'success' })
    } catch (caught) {
      if (!mountedRef.current || !shouldAcceptBasicTurnResponse({ expectedRequestId: requestRef.current, requestId })) { diagnoseBasicTurn({ round, requestId, phase: 'error', outcome: 'stale' }); return }
      streamRef.current = null; const normalized = normalizeAiError(caught); setGenerationState('error'); setError(normalized.message); const status = caught && typeof caught === 'object' && 'status' in caught && typeof caught.status === 'number' ? caught.status : undefined; diagnoseBasicTurn({ round, requestId, phase: 'error', outcome: normalized.code, status }); publish({ ...snapshotRef.current, transcript, partialResponse: snapshotRef.current.partialResponse, interrupted: true, completionReason: 'interrupted' })
    }
  }
  async function send() {
    if (submissionRef.current || generationRef.current === 'streaming') return
    const prepared = prepareBasicTurn(snapshotRef.current, draftId, argument)
    if (!prepared) return
    submissionRef.current = true
    if (prepared.transcript.length > snapshotRef.current.transcript.length) { clearArgumentDraft(draftKey); setArgument('') }
    try {
      const locked = applyDebateLanguageLock(prepared.argument)
      await streamReply(prepared.transcript, prepared.round, prepared.argument, prepared.requestId, locked)
    } finally { submissionRef.current = false }
  }
  function stop() { streamRef.current?.stop(); streamRef.current = null; requestRef.current = ''; setGenerationState('interrupted'); publish({ ...snapshotRef.current, interrupted: true, completionReason: 'interrupted' }); onNotify(t('ai.active.responseStopped')) }
  useEffect(() => {
    const handleNativeBack = (event: Event) => {
      const activeElement = document.activeElement as HTMLElement | null
      if (activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'INPUT') { activeElement.blur(); event.preventDefault(); return }
      if (generationRef.current === 'streaming') { stop(); event.preventDefault(); return }
      if (argument.trim() && !window.confirm(t('classic.exitConfirm'))) event.preventDefault()
    }
    window.addEventListener('sideshift-native-back', handleNativeBack, true)
    return () => window.removeEventListener('sideshift-native-back', handleNativeBack, true)
  }, [argument, t])
  function exitWithProtection() {
    if (argument.trim() && !window.confirm(t('classic.exitConfirm'))) return
    onExit()
  }
  async function finish() {
    if (completing || finishInFlightRef.current) return
    finishInFlightRef.current = true
    setCompleting(true); setCompleteError('')
    try { clearArgumentDraft(draftKey); await onComplete(snapshot.transcript) } catch (caught) { setCompleteError(normalizeAiError(caught).message) } finally { finishInFlightRef.current = false; setCompleting(false) }
  }
  return <div className="page ai-debate-page"><div className="ai-debate-top"><button type="button" className="back-link" onClick={exitWithProtection}>← {t('ai.active.exit')}</button><span className="ai-round-badge">{t('ai.active.roundProgress', { current: Math.min(currentRound + (pendingUser ? 0 : 1), snapshot.roundLimit), total: snapshot.roundLimit })}</span><DebateLanguageStatus language={language} label={debateLang.displayName} locked={debateLang.locked} detected={snapshot.debateLanguageMode === 'auto' && debateLang.locked} onlineRequired={!online && !isReliableCoreLanguage(debateLang.code)} reliableOnly={!online && !isReliableCoreLanguage(debateLang.code)} /><EngineStatusPill note={online ? engineStatusNote : 'offline'} language={language} /></div><div className="ai-debate-layout"><aside className="ai-debate-sidebar card-surface"><span className="eyebrow">{t('ai.active.sidebar')}</span><h2 dir="auto">{displayMotion}</h2><div className="ai-side-block"><small>{t('ai.active.yourSide')}</small><strong dir="auto">{config.userSide}</strong></div><div className="ai-side-block opponent-side"><small>{t('ai.active.opponentSide')}</small><strong dir="auto">{config.aiSide}</strong></div><div className="ai-rule-note">{t(isBasic ? 'ai.active.reliableRuleNote' : 'ai.active.ruleNote')}</div></aside><section className="ai-debate-main"><div className="ai-transcript" aria-live="polite">{snapshot.transcript.map((turn, index) => <article className={`ai-turn ${turn.role}`} key={`${turn.round}-${turn.role}-${index}`}><span className="ai-turn-label">{turn.role === 'user' ? t('ai.active.you') : config.opponent.displayName}</span><p dir="auto">{turn.content}</p>{turn.role === 'opponent' && index === snapshot.transcript.length - 1 && <div className="ai-feedback-row"><span>{t('ai.active.useful')}</span>{([['helpful', 'ai.active.helpful'], ['not_helpful', 'ai.active.notHelpful'], ['incorrect', 'ai.active.incorrect'], ['too_long', 'ai.active.tooLong'], ['missed_point', 'ai.active.missedPoint']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => void onFeedback(value)}>{t(label)}</button>)}</div>}</article>)}{snapshot.partialResponse && <article className="ai-turn opponent streaming"><span className="ai-turn-label">{config.opponent.displayName} · {t('ai.active.responding')}</span><p dir="auto">{snapshot.partialResponse}</p></article>}{!snapshot.transcript.length && !snapshot.partialResponse && <div className="ai-waiting-state"><span>✦</span><strong>{t('ai.active.firstArgument')}</strong><small>{t('ai.active.makeCase', { side: config.userSide })}</small></div>}</div>{(generation === 'interrupted' || generation === 'error' || snapshot.interrupted) && <div className="ai-interrupted" role="status"><strong>{generation === 'error' ? t('ai.active.responseInterrupted') : t('ai.active.responseStopped')}</strong><span>{error || t('ai.active.partialSaved')}</span>{aiButton(t('ai.active.retry'), () => void send(), 'secondary', generation === 'streaming')}</div>}{!completeReady && <div className="ai-response-box">{awaitingUser && <p className="ai-your-turn-prompt" role="status">{t('ai.active.yourTurn')}</p>}<details className="argument-hint-panel"><summary>{t('ai.argumentHint.title')}</summary><p>{t(argumentHintKey(userRound))}</p></details><textarea aria-label={t('ai.active.argumentAria')} value={argument} onChange={event => setArgument(event.target.value.slice(0, 500))} onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' })} placeholder={pendingUser ? t('ai.active.latestWaiting') : t('ai.active.casePlaceholder', { side: config.userSide })} disabled={generation === 'streaming' || pendingUser} dir="auto" /><div className="ai-response-footer"><small>{argument.length} / 500 · {t('ai.active.plainText')}{argumentTooShort ? ` · ${t('ai.active.minLengthHint')}` : ''}</small><div>{generation === 'streaming' && aiButton(t('ai.active.stop'), stop, 'secondary')}{generation !== 'streaming' && !pendingUser && aiButton(t('ai.active.sendArgument'), () => void send(), 'dark', argument.trim().length < 12)}</div></div></div>}{completeReady && <div className="ai-complete-card"><strong>{t('ai.active.complete')}</strong><span>{t('ai.active.limitBody', { count: snapshot.roundLimit })}</span>{completeError && <p className="form-error" role="alert">{completeError}</p>}{aiButton(completing ? t('ai.active.reviewing') : completeError ? t('ai.active.retryReview') : t('ai.active.completeReview'), () => void finish(), 'dark', completing)}</div>}</section></div></div>
}

function AiResultsBase({ language, result, onRematch, onSwap, onChangeOpponent, onAnotherTake }: { language: Language; result: ResultData; onRematch: () => void; onSwap: () => void; onChangeOpponent: () => void; onAnotherTake: () => void }) {
  const t = useTranslations(language)
  const review = result.ai?.evaluation
  return <div className="page ai-results-page"><span className="eyebrow">{t('ai.complete')}</span><h1>{t('ai.resultTitle')}</h1><p className="muted">{result.ai?.family} · {result.ai?.modelId} · {t('ai.active.quality', { value: translateAiQuality(result.ai?.quality, t) })} · {t('ai.active.replies', { value: translateAiResponseLength(result.ai?.responseLength, t) })}</p>{result.ai?.evaluationDisclaimer && <p className="field-help">{result.ai.evaluationDisclaimer}</p>}{review ? <section className="ai-review-grid"><div className="ai-review-card card-surface"><span className="eyebrow">{t('ai.argumentReview')}</span><div className="ai-score-total"><strong>{result.score}</strong><small>/100 {t('ai.active.techniqueScore')}</small></div><div className="ai-score-list">{result.scores.map(score => <div key={score.label}><span>{translateScoreLabel(score.label, t)}</span><b>{score.score}/20</b><i style={{ width: `${score.score * 5}%` }} /></div>)}</div></div><div className="ai-review-card card-surface"><span className="eyebrow">{t('ai.argumentDna')}</span><h2>{review.argumentDna}</h2><dl><dt>{t('team.strongestPoint')}</dt><dd>{review.strongestPoint}</dd><dt>{t('ai.improvement')}</dt><dd>{review.weakestAssumption}</dd><dt>{t('ai.unansweredPoint')}</dt><dd>{review.missedCounterargument}</dd></dl><div className="ai-improved-response"><small>{t('ai.improvement')}</small><p>{review.improvedExampleResponse}</p></div></div></section> : <section className="ai-review-unavailable card-surface"><span className="eyebrow">{t('ai.reviewUnavailable')}</span><h2>{t('ai.complete')}</h2><p>{t('ai.reviewUnavailable')}</p></section>}<div className="ai-result-actions">{aiButton(t('ai.rematch'), onRematch, 'dark')}{aiButton(t('ai.swap'), onSwap, 'secondary')}{aiButton(t('ai.changeOpponent'), onChangeOpponent, 'secondary')}{aiButton(t('ai.anotherTake'), onAnotherTake, 'ghost')}</div></div>
}
