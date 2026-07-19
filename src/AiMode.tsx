import { useEffect, useRef, useState } from 'react'
import { takeText, type AiDebateData, type AiDifficulty, type AiQuality, type AiResponseLength, type AiRoundLength, type Language, type ResultData, type Take } from './domain'
import { buildDebateContext, validateCustomMotion, type ContextTurn } from './lib/ai/contextBuilder'
import { normalizeAiError } from './lib/ai/errors'
import { resolveOpponents } from './lib/ai/modelResolver'
import { basicOpponent, opponents } from './lib/ai/opponents'
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

export function AiSetup({ provider, basicProvider, puterProvider, take, language, preferences, preset, onStart, onBack, mock = false }: { provider: AiProvider; basicProvider?: AiProvider; puterProvider?: AiProvider | null; take: Take; language: Language; preferences: UserPreferences; preset?: Partial<AiStartConfig>; onStart: (config: AiStartConfig, take: Take) => Promise<void>; onBack: () => void; mock?: boolean }) {
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
  const [userSide, setUserSide] = useState(saved?.userSide || preset?.userSide || take.supportLabel)
  const [customMotion, setCustomMotion] = useState(saved?.customMotion || preset?.customMotion || '')
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
    saveAiSetupDraft({ takeId: take.id, selectedId: selectedId || '', difficulty, roundLength, quality, responseLength, modelSelection, exactModelId, userSide, customMotion } satisfies AiSetupDraft)
  }, [customMotion, difficulty, exactModelId, modelSelection, quality, responseLength, roundLength, selectedId, take.id, userSide])

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
  useEffect(() => { setStatus('disconnected'); setCatalogue([]); setResolved([]); setSelectedId(route === 'basic' ? basicOpponent.id : preferences.preferredOpponentId === basicOpponent.id ? opponents[0].id : preferences.preferredOpponentId); void refreshModels() }, [route, routeProvider])
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
    if (status !== 'connected') return setError(route === 'basic' ? t('ai.basicUnavailable') : t('ai.connectBeforeStart'))
    if (allowanceExhausted) return setError(t('ai.allowanceExhausted'))
    if (!selected?.available || !selected.model) return setError(t('ai.chooseAvailable'))
    let privateMotion: string | null
    try { privateMotion = customMotion.trim() ? validateCustomMotion(customMotion) : null } catch (caught) { return setError(caught instanceof Error ? caught.message : t('ai.invalidMotion')) }
    setBusy(true); setError('')
    try {
      clearAiSetupDraft()
      const aiSide = userSide === take.supportLabel ? take.opposeLabel : take.supportLabel
      await onStart({ opponent: selected, difficulty, roundLength: route === 'basic' ? 'quick' : roundLength, quality: route === 'basic' ? 'balanced' : quality, responseLength: route === 'basic' ? 'concise' : responseLength, modelSelection: route === 'basic' ? 'automatic' : selected.selection, userSide, aiSide, customMotion: privateMotion }, privateMotion ? { ...take, id: `private-${Date.now()}`, statement: privateMotion, statementDe: privateMotion, context: t('ai.active.privateMotion'), contextDe: t('ai.active.privateMotion') } : take)
    } catch (caught) { setError(caught instanceof Error ? caught.message : t('ai.startError')) } finally { setBusy(false) }
  }
  const fallbackOpponents = opponents.map(opponent => ({ ...opponent, available: false, model: null, models: [], selection: 'automatic' as const }))
  const roundOptions = [['quick', 'ai.roundQuick', 3], ['standard', 'ai.roundStandard', 4], ['deep', 'ai.roundDeep', 6]] as const
  return <div className="page ai-setup-page"><button type="button" className="back-link" onClick={onBack}>← {t('common.back')}</button><div className="page-heading"><div><span className="eyebrow">{t('ai.setupEyebrow')}</span><h1>{t('ai.setupTitle')}</h1><p className="muted">{t('ai.setupBody')}</p></div>{status === 'connected' ? <span className="ai-status-pill connected">{t('ai.connected')}</span> : null}</div><AiProviderChoice language={language} route={route} onSelect={nextRoute => { setRoute(nextRoute); setError('') }} />{status !== 'connected' && <AiConnectionCard provider={routeProvider} language={language} mock={mock} onChange={() => void refreshModels(true)} />}{status === 'connected' && <div className={`ai-allowance-card ${allowanceExhausted ? 'exhausted' : ''}`}><span><strong>{t('ai.allowance')}</strong>{usage?.remaining === null || !usage ? t('ai.usageUnavailable') : allowanceExhausted ? t('ai.noAllowance') : t('ai.remaining', { count: usage.remaining })}</span><button type="button" className="text-link" onClick={() => void refreshModels(true)}>{t('ai.refreshAllowance')}</button><small>{t('ai.usageNotice')}</small></div>}<section className="ai-setup-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('ai.motion')}</span><h2>{customMotion.trim() ? t('ai.privateMotion') : text.category}</h2></div><span className="ai-round-badge">{t('ai.rounds', { count: roundCount })}</span></div><p className="ai-motion-copy">{motion}</p><label className="field-label" htmlFor="ai-custom-motion">{t('ai.privateMotion')} <span>({t('common.optional')})</span></label><textarea id="ai-custom-motion" className="settings-textarea" maxLength={240} value={customMotion} onChange={event => setCustomMotion(event.target.value)} placeholder={t('ai.privateMotionPlaceholder')} /><small className="field-help">{t('ai.motionHelp')}</small></section><section className="ai-setup-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('ai.opponents')}</span><h2>{t('ai.pushBack')}</h2></div></div><div className="opponent-grid">{(resolved.length ? resolved : fallbackOpponents).map(opponent => <button type="button" key={opponent.id} className={`opponent-card ${selectedId === opponent.id ? 'selected' : ''}`} disabled={!opponent.available} aria-pressed={selectedId === opponent.id} onClick={() => chooseOpponent(opponent.id)}><span className="opponent-avatar">{opponent.icon}</span><span><strong>{opponent.displayName}</strong><small>{opponent.description}</small><em>{opponent.available ? `${preferences.showModelDetails ? t('ai.active.model', { value: opponent.model?.name || opponent.model?.id || t('ai.compatibleModel') }) : t('ai.compatibleModel')}` : status === 'connected' ? t('ai.noCompatibleModel') : t('ai.connectToCheck')}</em></span></button>)}</div></section><section className="ai-setup-section card-surface"><span className="field-label">{t('ai.quality')}</span><div className="ai-length-options ai-quality-options">{qualityOptions.map(([value, label, description]) => <button type="button" key={value} className={quality === value ? 'selected' : ''} onClick={() => setQuality(value)}><strong>{t(label)}</strong><small>{t(description)}</small></button>)}</div>{quality === 'maximum' && <p className="ai-setting-note">{t('ai.maximumNote')}</p>}<div className="settings-fields-grid"><label className="field-label">{t('ai.yourSide')}<select className="settings-select" value={userSide} onChange={event => setUserSide(event.target.value)}><option value={take.supportLabel}>{take.supportLabel}</option><option value={take.opposeLabel}>{take.opposeLabel}</option></select></label><label className="field-label">{t('ai.difficulty')}<select className="settings-select" value={difficulty} onChange={event => setDifficulty(event.target.value as AiDifficulty)}><option value="beginner">{t('ai.difficultyBeginner')}</option><option value="intermediate">{t('ai.difficultyIntermediate')}</option><option value="advanced">{t('ai.difficultyAdvanced')}</option><option value="expert">{t('ai.difficultyExpert')}</option></select></label></div><span className="field-label">{t('ai.debateLength')}</span><div className="ai-length-options">{roundOptions.map(([value, label, count]) => <button type="button" key={value} className={roundLength === value ? 'selected' : ''} onClick={() => setRoundLength(value)}><strong>{t(label)}</strong><small>{t('ai.rounds', { count })}</small></button>)}</div><span className="field-label ai-response-label">{t('ai.responseLength')}</span><div className="ai-length-options">{responseOptions.map(([value, label, description]) => <button type="button" key={value} className={responseLength === value ? 'selected' : ''} onClick={() => setResponseLength(value)}><strong>{t(label)}</strong><small>{t(description)}</small></button>)}</div></section><section className="ai-advanced-settings card-surface"><button type="button" className="ai-advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(open => !open)}><span><strong>{t('ai.advanced')}</strong><small>{t('ai.advancedBody')}</small></span><span aria-hidden="true">{advancedOpen ? '−' : '+'}</span></button>{advancedOpen && <div className="ai-advanced-content"><label className="toggle-row"><input type="checkbox" checked={modelSelection === 'exact'} onChange={event => setModelSelection(event.target.checked ? 'exact' : 'automatic')} /><span>{t('ai.exactModel')}</span><small>{t('ai.automaticFallback')}</small></label>{modelSelection === 'exact' && <label className="field-label">{t('ai.exactModelLabel')}<select className="settings-select" data-testid="ai-exact-model" value={exactModelId || ''} onChange={event => setExactModelId(event.target.value || null)}><option value="">{t('ai.automaticFallback')}</option>{selected?.models.map(model => <option key={model.id} value={model.id}>{model.name || model.id}{model.isLegacy ? ` (${t('ai.active.legacy')})` : ''}</option>)}</select></label>}{savedModelUnavailable && <p className="ai-setting-note">{t('ai.savedModelUnavailable')}</p>}<p className="field-help">{t('ai.modelCatalogueSource')}</p></div>}</section>{error && <p className="form-error" role="alert">{error}</p>}<div className="ai-setup-footer">{aiButton(t('ai.start'), () => void start(), 'dark', busy || status !== 'connected' || allowanceExhausted || !selected?.available)}<small>{t('ai.liveBody')}</small></div></div>
}

function responseTokenLimit(length: AiResponseLength, opponentLimit: number): number {
  const requested = length === 'concise' ? 150 : length === 'detailed' ? 280 : 220
  return Math.min(requested, opponentLimit)
}

export function AiDebate({ provider, take, language, config, snapshot, draftId, onSnapshot, onComplete, onExit, onFeedback, onNotify }: { provider: AiProvider; take: Take; language: Language; config: AiStartConfig; snapshot: AiDebateData; draftId: string; onSnapshot: (snapshot: AiDebateData) => void; onComplete: (transcript: AiDebateData['transcript']) => Promise<void>; onExit: () => void; onFeedback: (feedback: AiFeedbackType) => Promise<void>; onNotify: (message: string) => void }) {
  const t = useTranslations(language)
  const [argument, setArgument] = useState('')
  const [generation, setGeneration] = useState<'idle' | 'streaming' | 'interrupted' | 'error'>('idle')
  const [error, setError] = useState('')
  const streamRef = useRef<{ stop: () => void } | null>(null)
  const requestRef = useRef('')
  const mountedRef = useRef(true)
  const snapshotRef = useRef(snapshot)
  const reconnectRef = useRef<Promise<void> | null>(null)
  const draftKey = `ai:${draftId}`
  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; streamRef.current?.stop() } }, [])
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
  const latestTurn = snapshot.transcript[snapshot.transcript.length - 1]
  const pendingUser = latestTurn?.role === 'user'
  const currentRound = Math.max(0, ...snapshot.transcript.map(turn => turn.round))
  const aiTurns = snapshot.transcript.filter(turn => turn.role === 'opponent')
  const completeReady = !pendingUser && aiTurns.length >= snapshot.roundLimit
  const displayMotion = snapshot.customMotion || takeText(take, language).statement
  async function streamReply(transcript: AiDebateData['transcript'], round: number, latestArgument: string) {
    const requestId = `${Date.now()}-${Math.random()}`
    requestRef.current = requestId; setGeneration('streaming'); setError('')
    publish({ ...snapshotRef.current, transcript, partialResponse: '', interrupted: false, completionReason: null })
    const contextTurns: ContextTurn[] = transcript.slice(0, -1).map(turn => ({ role: turn.role === 'opponent' ? 'assistant' : 'user', content: turn.content, round: turn.round }))
    try {
      await ensureConnected()
      const stream = await provider.streamChat({ modelId: config.opponent.model?.id || '', messages: buildDebateContext({ motion: displayMotion, userSide: config.userSide, aiSide: config.aiSide, language, difficulty: config.difficulty, roundLength: config.roundLength, round, latestArgument, recentTurns: contextTurns, stylePrompt: config.opponent.stylePrompt }), maxTokens: responseTokenLimit(config.responseLength, config.opponent.maxResponseTokens), temperature: config.difficulty === 'expert' ? .25 : .4, debateId: draftId, round, requestId })
      if (!mountedRef.current || requestRef.current !== requestId) { stream.stop(); return }
      streamRef.current = stream; let partial = ''
      for await (const chunk of stream.chunks) { if (!mountedRef.current || requestRef.current !== requestId) { stream.stop(); return }; partial += chunk; publish({ ...snapshotRef.current, transcript, partialResponse: partial, interrupted: false, completionReason: null }) }
      if (!mountedRef.current || requestRef.current !== requestId) return
      streamRef.current = null
      if (!partial.trim()) throw new Error('The AI returned an empty response. Retry this round.')
      publish({ ...snapshotRef.current, transcript: [...transcript, { role: 'opponent', round, content: partial.trim() }], partialResponse: '', interrupted: false, completionReason: null }); setGeneration('idle')
    } catch (caught) { if (!mountedRef.current || requestRef.current !== requestId) return; streamRef.current = null; setGeneration('error'); const normalized = normalizeAiError(caught); setError(normalized.message); publish({ ...snapshotRef.current, transcript, partialResponse: snapshotRef.current.partialResponse, interrupted: true, completionReason: 'interrupted' }) }
  }
  async function send() {
    const trimmed = argument.trim()
    if (generation === 'streaming' || (!pendingUser && trimmed.length < 12)) return
    if (pendingUser) return void streamReply(snapshotRef.current.transcript, currentRound, latestTurn.content)
    const next = [...snapshotRef.current.transcript, { role: 'user' as const, round: currentRound + 1, content: trimmed }]
    clearArgumentDraft(draftKey); setArgument(''); await streamReply(next, currentRound + 1, trimmed)
  }
  function stop() { streamRef.current?.stop(); requestRef.current = ''; setGeneration('interrupted'); publish({ ...snapshotRef.current, interrupted: true, completionReason: 'interrupted' }); onNotify(t('ai.active.responseStopped')) }
  function exitWithProtection() {
    if (argument.trim() && !window.confirm(t('classic.exitConfirm'))) return
    onExit()
  }
  return <div className="page ai-debate-page"><div className="ai-debate-top"><button type="button" className="back-link" onClick={exitWithProtection}>← {t('ai.active.exit')}</button><span className="ai-round-badge">{t('ai.active.roundProgress', { current: Math.min(currentRound + (pendingUser ? 0 : 1), snapshot.roundLimit), total: snapshot.roundLimit })}</span><span className="ai-model-label">{config.opponent.displayName} · {config.opponent.model?.name}</span></div><div className="ai-debate-layout"><aside className="ai-debate-sidebar card-surface"><span className="eyebrow">{t('ai.active.sidebar')}</span><h2>{displayMotion}</h2><div className="ai-side-block"><small>{t('ai.active.yourSide')}</small><strong>{config.userSide}</strong></div><div className="ai-side-block opponent-side"><small>{t('ai.active.opponentSide')}</small><strong>{config.aiSide}</strong></div><div className="ai-rule-note">{t('ai.active.ruleNote')}</div></aside><section className="ai-debate-main"><div className="ai-transcript" aria-live="polite">{snapshot.transcript.map((turn, index) => <article className={`ai-turn ${turn.role}`} key={`${turn.round}-${turn.role}-${index}`}><span className="ai-turn-label">{turn.role === 'user' ? t('ai.active.you') : config.opponent.displayName}</span><p>{turn.content}</p>{turn.role === 'opponent' && index === snapshot.transcript.length - 1 && <div className="ai-feedback-row"><span>{t('ai.active.useful')}</span>{([['helpful', 'ai.active.helpful'], ['not_helpful', 'ai.active.notHelpful'], ['incorrect', 'ai.active.incorrect'], ['too_long', 'ai.active.tooLong'], ['missed_point', 'ai.active.missedPoint']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => void onFeedback(value)}>{t(label)}</button>)}</div>}</article>)}{snapshot.partialResponse && <article className="ai-turn opponent streaming"><span className="ai-turn-label">{config.opponent.displayName} · {t('ai.active.responding')}</span><p>{snapshot.partialResponse}</p></article>}{!snapshot.transcript.length && !snapshot.partialResponse && <div className="ai-waiting-state"><span>✦</span><strong>{t('ai.active.firstArgument')}</strong><small>{t('ai.active.makeCase', { side: config.userSide })}</small></div>}</div>{(generation === 'interrupted' || generation === 'error' || snapshot.interrupted) && <div className="ai-interrupted" role="status"><strong>{generation === 'error' ? t('ai.active.responseInterrupted') : t('ai.active.responseStopped')}</strong><span>{error || t('ai.active.partialSaved')}</span>{aiButton(t('ai.active.retry'), () => void send(), 'secondary', generation === 'streaming')}</div>}{!completeReady && <div className="ai-response-box"><textarea aria-label={t('ai.active.argumentAria')} value={argument} onChange={event => setArgument(event.target.value.slice(0, 500))} placeholder={pendingUser ? t('ai.active.latestWaiting') : t('ai.active.casePlaceholder', { side: config.userSide })} disabled={generation === 'streaming' || pendingUser} /><div className="ai-response-footer"><small>{argument.length} / 500 · {t('ai.active.plainText')}</small><div>{generation === 'streaming' && aiButton(t('ai.active.stop'), stop, 'secondary')}{generation !== 'streaming' && !pendingUser && aiButton(t('ai.active.sendArgument'), () => void send(), 'dark', argument.trim().length < 12)}</div></div></div>}{completeReady && <div className="ai-complete-card"><strong>{t('ai.active.complete')}</strong><span>{t('ai.active.limitBody', { count: snapshot.roundLimit })}</span>{aiButton(t('ai.active.completeReview'), () => { clearArgumentDraft(draftKey); void onComplete(snapshot.transcript) }, 'dark')}</div>}</section></div></div>
}

function AiResultsBase({ language, result, onRematch, onSwap, onChangeOpponent, onAnotherTake }: { language: Language; result: ResultData; onRematch: () => void; onSwap: () => void; onChangeOpponent: () => void; onAnotherTake: () => void }) {
  const t = useTranslations(language)
  const review = result.ai?.evaluation
  return <div className="page ai-results-page"><span className="eyebrow">{t('ai.complete')}</span><h1>{t('ai.resultTitle')}</h1><p className="muted">{result.ai?.family} · {result.ai?.modelId} · {t('ai.active.quality', { value: translateAiQuality(result.ai?.quality, t) })} · {t('ai.active.replies', { value: translateAiResponseLength(result.ai?.responseLength, t) })}</p>{review ? <section className="ai-review-grid"><div className="ai-review-card card-surface"><span className="eyebrow">{t('ai.argumentReview')}</span><div className="ai-score-total"><strong>{result.score}</strong><small>/100 {t('ai.active.techniqueScore')}</small></div><div className="ai-score-list">{result.scores.map(score => <div key={score.label}><span>{translateScoreLabel(score.label, t)}</span><b>{score.score}/20</b><i style={{ width: `${score.score * 5}%` }} /></div>)}</div></div><div className="ai-review-card card-surface"><span className="eyebrow">{t('ai.argumentDna')}</span><h2>{review.argumentDna}</h2><dl><dt>{t('team.strongestPoint')}</dt><dd>{review.strongestPoint}</dd><dt>{t('ai.improvement')}</dt><dd>{review.weakestAssumption}</dd><dt>{t('ai.unansweredPoint')}</dt><dd>{review.missedCounterargument}</dd></dl><div className="ai-improved-response"><small>{t('ai.improvement')}</small><p>{review.improvedExampleResponse}</p></div></div></section> : <section className="ai-review-unavailable card-surface"><span className="eyebrow">{t('ai.reviewUnavailable')}</span><h2>{t('ai.complete')}</h2><p>{t('ai.reviewUnavailable')}</p></section>}<div className="ai-result-actions">{aiButton(t('ai.rematch'), onRematch, 'dark')}{aiButton(t('ai.swap'), onSwap, 'secondary')}{aiButton(t('ai.changeOpponent'), onChangeOpponent, 'secondary')}{aiButton(t('ai.anotherTake'), onAnotherTake, 'ghost')}</div></div>
}
