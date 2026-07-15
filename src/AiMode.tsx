import { useEffect, useRef, useState } from 'react'
import { takeText, type AiDebateData, type AiDifficulty, type AiQuality, type AiResponseLength, type AiRoundLength, type Language, type ResultData, type Take } from './domain'
import { buildDebateContext, validateCustomMotion, type ContextTurn } from './lib/ai/contextBuilder'
import { normalizeAiError } from './lib/ai/errors'
import { resolveOpponents } from './lib/ai/modelResolver'
import { opponents } from './lib/ai/opponents'
import type { AiFeedbackType, AiModelSelection, AiProvider, AiStartConfig, ResolvedOpponent } from './lib/ai/types'
import type { UserPreferences } from './data/types'
import { clearAiSetupDraft, clearArgumentDraft, loadAiSetupDraft, loadArgumentDraft, saveAiSetupDraft, saveArgumentDraft, type AiSetupDraft } from './drafts'

function aiButton(label: string, onClick: () => void, variant = 'primary', disabled = false) {
  return <button type="button" className={`button button-${variant}`} onClick={onClick} disabled={disabled}>{label}</button>
}

export function AiResults(props: { result: ResultData; onRematch: () => void; onSwap: () => void; onChangeOpponent: () => void; onAnotherTake: () => void }) {
  const review = props.result.ai?.evaluation
  return <><AiResultsBase {...props} />{review && <section className="page ai-results-addendum"><details className="ai-score-details card-surface"><summary>Why this score?</summary><p>The bounded review is grounded in the completed transcript. It scores argument technique, not ideological correctness, and never adds a score when the evaluation fails.</p><dl><dt>Unanswered opponent point</dt><dd>{review.unansweredOpponentPoint || review.missedCounterargument}</dd><dt>Concession signal</dt><dd>{review.concession && review.concession !== 'none' ? review.concession : 'No genuine concession detected'}</dd><dt>Improvement</dt><dd>{review.improvedExampleResponse}</dd></dl></details></section>}</>
}

function connectionText(status: Awaited<ReturnType<AiProvider['getStatus']>>): string {
  return status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting…' : status === 'failed' ? 'Connection failed' : 'Not connected'
}

const qualityOptions: Array<[AiQuality, string, string]> = [['fast', 'Fast', 'Lower cost and quicker replies'], ['balanced', 'Balanced', 'Good quality, speed, and allowance use'], ['maximum', 'Maximum', 'Strongest compatible live model']]
const responseOptions: Array<[AiResponseLength, string, string]> = [['concise', 'Concise', 'Short, direct replies'], ['standard', 'Standard', 'A focused argument with a counterpoint'], ['detailed', 'Detailed', 'More context and examples']]

export function AiConnectionCard({ provider, onChange }: { provider: AiProvider; onChange?: () => void }) {
  const [status, setStatus] = useState<Awaited<ReturnType<AiProvider['getStatus']>>>('disconnected')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { void provider.getStatus().then(setStatus) }, [provider])
  async function connect() {
    setBusy(true); setError(''); setStatus('connecting')
    try { await provider.connect(); setStatus('connected'); onChange?.() } catch (caught) { const errorValue = normalizeAiError(caught); setStatus('failed'); setError(errorValue.message) } finally { setBusy(false) }
  }
  const livePuter = import.meta.env.VITE_AI_MOCK !== 'true'
  return <div className="ai-connection-card"><div className="ai-connection-mark">✦</div><div className="ai-connection-copy"><span className="eyebrow">{livePuter ? 'LIVE PUTER AI' : 'MOCK AI'}</span><strong>{connectionText(status)}</strong><p>{livePuter ? 'Sign in to Puter when you choose to discover compatible live AI opponents. SideShift keeps your profile separate.' : 'Mock AI is active for development. No provider account or live model is used.'}</p><small>{livePuter ? 'Usage belongs to your Puter allowance. SideShift never stores Puter credentials or provider secrets.' : 'Development responses are simulations and never represent a live provider result.'}</small></div>{status === 'connected' ? <span className="ai-status-pill connected">Connected</span> : <button type="button" className="button button-secondary" onClick={() => void connect()} disabled={busy}>{busy ? 'Connecting…' : livePuter ? 'Connect Puter' : 'Activate mock AI'}</button>}{error && <p className="form-error ai-connection-error" role="alert">{error}</p>}</div>
}

export function AiSetup({ provider, take, language, preferences, preset, onStart, onBack }: { provider: AiProvider; take: Take; language: Language; preferences: UserPreferences; preset?: Partial<AiStartConfig>; onStart: (config: AiStartConfig, take: Take) => Promise<void>; onBack: () => void }) {
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
  const text = takeText(take, language)
  const motion = customMotion.trim() || text.statement
  const selected = resolved.find(opponent => opponent.id === selectedId) || null
  const roundCount = roundLength === 'quick' ? 3 : roundLength === 'deep' ? 6 : 4
  const allowanceExhausted = usage?.remaining !== null && usage?.remaining !== undefined && usage.remaining <= 0
  const savedModelUnavailable = modelSelection === 'exact' && Boolean(exactModelId) && Boolean(selected && !selected.models.some(model => model.id === exactModelId))

  useEffect(() => {
    saveAiSetupDraft({ takeId: take.id, selectedId: selectedId || '', difficulty, roundLength, quality, responseLength, modelSelection, exactModelId, userSide, customMotion } satisfies AiSetupDraft)
  }, [customMotion, difficulty, exactModelId, modelSelection, quality, responseLength, roundLength, selectedId, take.id, userSide])

  useEffect(() => { setResolved(resolveOpponents(catalogue, { quality, exactModelIds: modelSelection === 'exact' ? { [selected?.family || 'GPT']: exactModelId } : undefined })) }, [catalogue, exactModelId, modelSelection, quality, selected?.family])

  async function refreshModels(force = false) {
    try {
      const current = await provider.getStatus(); setStatus(current); if (current !== 'connected') return
      const [models, currentUsage] = await Promise.all([provider.listModels(force), provider.getUsage()])
      setCatalogue(models); setUsage(currentUsage); setError('')
    } catch (caught) { const errorValue = normalizeAiError(caught); setError(errorValue.message); setStatus('failed') }
  }
  useEffect(() => { void refreshModels() }, [provider])
  async function connect() {
    setBusy(true); setError(''); setStatus('connecting')
    try { await provider.connect(); await refreshModels(true) } catch (caught) { const errorValue = normalizeAiError(caught); setStatus('failed'); setError(errorValue.message) } finally { setBusy(false) }
  }
  function chooseOpponent(id: string) {
    setSelectedId(id)
    const next = resolved.find(opponent => opponent.id === id)
    if (modelSelection === 'exact' && next && !next.models.some(model => model.id === exactModelId)) setExactModelId(null)
  }
  async function start() {
    if (status !== 'connected') return setError('Connect Puter before starting an AI debate.')
    if (allowanceExhausted) return setError('Your Puter allowance is exhausted. Refresh or choose a different account before starting.')
    if (!selected?.available || !selected.model) return setError('Choose an available AI opponent.')
    let privateMotion: string | null
    try { privateMotion = customMotion.trim() ? validateCustomMotion(customMotion) : null } catch (caught) { return setError(caught instanceof Error ? caught.message : 'That private motion is not valid.') }
    setBusy(true); setError('')
    try {
      clearAiSetupDraft()
      const aiSide = userSide === take.supportLabel ? take.opposeLabel : take.supportLabel
      await onStart({ opponent: selected, difficulty, roundLength, quality, responseLength, modelSelection: selected.selection, userSide, aiSide, customMotion: privateMotion }, privateMotion ? { ...take, id: `private-${Date.now()}`, statement: privateMotion, statementDe: privateMotion, context: 'Private motion created only for this debate.', contextDe: 'Private motion created only for this debate.' } : take)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The AI debate could not start.') } finally { setBusy(false) }
  }
  const fallbackOpponents = opponents.map(opponent => ({ ...opponent, available: false, model: null, models: [], selection: 'automatic' as const }))
  return <div className="page ai-setup-page"><button type="button" className="back-link" onClick={onBack}>← Back</button><div className="page-heading"><div><span className="eyebrow">AI DEBATE SETUP</span><h1>Choose your<br /><em>opponent.</em></h1><p className="muted">Puter supplies the AI; your SideShift account keeps the debate private and persistent.</p></div>{status === 'connected' ? <span className="ai-status-pill connected">Puter connected</span> : null}</div>{status !== 'connected' && <AiConnectionCard provider={provider} onChange={() => void refreshModels(true)} />}{status === 'connected' && <div className={`ai-allowance-card ${allowanceExhausted ? 'exhausted' : ''}`}><span><strong>Monthly allowance</strong>{usage?.remaining === null || !usage ? 'Usage unavailable' : allowanceExhausted ? 'No allowance remaining' : `${usage.remaining} remaining`}</span><button type="button" className="text-link" onClick={() => void refreshModels(true)}>Refresh models and allowance</button><small>AI usage is charged to Puter. SideShift does not promise unlimited free AI.</small></div>}<section className="ai-setup-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">THE MOTION</span><h2>{customMotion.trim() ? 'Private motion' : text.category}</h2></div><span className="ai-round-badge">{roundCount} rounds</span></div><p className="ai-motion-copy">{motion}</p><label className="field-label" htmlFor="ai-custom-motion">Private custom motion <span>(optional)</span></label><textarea id="ai-custom-motion" className="settings-textarea" maxLength={240} value={customMotion} onChange={event => setCustomMotion(event.target.value)} placeholder="Write a motion visible only to you" /><small className="field-help">12–240 characters. This motion is not published or added to the topic library.</small></section><section className="ai-setup-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">AVAILABLE OPPONENTS</span><h2>Who should push back?</h2></div></div><div className="opponent-grid">{(resolved.length ? resolved : fallbackOpponents).map(opponent => <button type="button" key={opponent.id} className={`opponent-card ${selectedId === opponent.id ? 'selected' : ''}`} disabled={!opponent.available} aria-pressed={selectedId === opponent.id} onClick={() => chooseOpponent(opponent.id)}><span className="opponent-avatar">{opponent.icon}</span><span><strong>{opponent.displayName}</strong><small>{opponent.description}</small><em>{opponent.available ? `${preferences.showModelDetails ? `Model: ${opponent.model?.name || opponent.model?.id}` : 'Compatible live model available'}` : status === 'connected' ? 'No compatible text/chat/streaming model' : 'Connect Puter to check availability'}</em></span></button>)}</div></section><section className="ai-setup-section card-surface"><span className="field-label">Model quality</span><div className="ai-length-options ai-quality-options">{qualityOptions.map(([value, label, description]) => <button type="button" key={value} className={quality === value ? 'selected' : ''} onClick={() => setQuality(value)}><strong>{label}</strong><small>{description}</small></button>)}</div>{quality === 'maximum' && <p className="ai-setting-note">Maximum may use more of your Puter allowance when a stronger current model is available.</p>}<div className="settings-fields-grid"><label className="field-label">Your side<select className="settings-select" value={userSide} onChange={event => setUserSide(event.target.value)}><option value={take.supportLabel}>{take.supportLabel}</option><option value={take.opposeLabel}>{take.opposeLabel}</option></select></label><label className="field-label">Difficulty<select className="settings-select" value={difficulty} onChange={event => setDifficulty(event.target.value as AiDifficulty)}><option value="beginner">Beginner — clear and explanatory</option><option value="intermediate">Intermediate — stronger rebuttal</option><option value="advanced">Advanced — assumptions and trade-offs</option><option value="expert">Expert — rigorous counterexamples</option></select></label></div><span className="field-label">Debate length</span><div className="ai-length-options">{([['quick', 'Quick', '3 rounds'], ['standard', 'Standard', '4 rounds'], ['deep', 'Deep', '6 rounds']] as const).map(([value, label, description]) => <button type="button" key={value} className={roundLength === value ? 'selected' : ''} onClick={() => setRoundLength(value)}><strong>{label}</strong><small>{description}</small></button>)}</div><span className="field-label ai-response-label">Response length</span><div className="ai-length-options">{responseOptions.map(([value, label, description]) => <button type="button" key={value} className={responseLength === value ? 'selected' : ''} onClick={() => setResponseLength(value)}><strong>{label}</strong><small>{description}</small></button>)}</div></section><section className="ai-advanced-settings card-surface"><button type="button" className="ai-advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(open => !open)}><span><strong>Advanced model settings</strong><small>Choose an exact compatible model when the live catalogue exposes one.</small></span><span aria-hidden="true">{advancedOpen ? '−' : '+'}</span></button>{advancedOpen && <div className="ai-advanced-content"><label className="toggle-row"><input type="checkbox" checked={modelSelection === 'exact'} onChange={event => setModelSelection(event.target.checked ? 'exact' : 'automatic')} /><span>Use an exact model</span><small>Automatic remains family-safe and adapts to the live catalogue.</small></label>{modelSelection === 'exact' && <label className="field-label">Exact model<select className="settings-select" data-testid="ai-exact-model" value={exactModelId || ''} onChange={event => setExactModelId(event.target.value || null)}><option value="">Automatic fallback</option>{selected?.models.map(model => <option key={model.id} value={model.id}>{model.name || model.id}{model.isLegacy ? ' (legacy)' : ''}</option>)}</select></label>}{savedModelUnavailable && <p className="ai-setting-note">Your saved exact model is not in the current catalogue. Automatic family-safe fallback will be used until it returns.</p>}<p className="field-help">Model names and capabilities come from Puter at runtime. SideShift never substitutes a different family.</p></div>}</section>{error && <p className="form-error" role="alert">{error}</p>}<div className="ai-setup-footer">{aiButton('Start AI debate', () => void start(), 'dark', busy || status !== 'connected' || allowanceExhausted || !selected?.available)}<small>Before the first AI round, your debate text will be sent through Puter to the selected model.</small></div></div>
}

function responseTokenLimit(length: AiResponseLength, opponentLimit: number): number {
  const requested = length === 'concise' ? 150 : length === 'detailed' ? 280 : 220
  return Math.min(requested, opponentLimit)
}

export function AiDebate({ provider, take, language, config, snapshot, draftId, onSnapshot, onComplete, onExit, onFeedback, onNotify }: { provider: AiProvider; take: Take; language: Language; config: AiStartConfig; snapshot: AiDebateData; draftId: string; onSnapshot: (snapshot: AiDebateData) => void; onComplete: (transcript: AiDebateData['transcript']) => Promise<void>; onExit: () => void; onFeedback: (feedback: AiFeedbackType) => Promise<void>; onNotify: (message: string) => void }) {
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
      const stream = await provider.streamChat({ modelId: config.opponent.model?.id || '', messages: buildDebateContext({ motion: displayMotion, userSide: config.userSide, aiSide: config.aiSide, language, difficulty: config.difficulty, roundLength: config.roundLength, round, latestArgument, recentTurns: contextTurns, stylePrompt: config.opponent.stylePrompt }), maxTokens: responseTokenLimit(config.responseLength, config.opponent.maxResponseTokens), temperature: config.difficulty === 'expert' ? .25 : .4 })
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
  function stop() { streamRef.current?.stop(); requestRef.current = ''; setGeneration('interrupted'); publish({ ...snapshotRef.current, interrupted: true, completionReason: 'interrupted' }); onNotify('Response stopped. The received text is saved; retry when you are ready.') }
  function exitWithProtection() {
    if (argument.trim() && !window.confirm('You have an unsent argument. Leave it saved and return later?')) return
    onExit()
  }
  return <div className="page ai-debate-page"><div className="ai-debate-top"><button type="button" className="back-link" onClick={exitWithProtection}>← Exit AI debate</button><span className="ai-round-badge">ROUND {Math.min(currentRound + (pendingUser ? 0 : 1), snapshot.roundLimit)} / {snapshot.roundLimit}</span><span className="ai-model-label">{config.opponent.displayName} · {config.opponent.model?.name}</span></div><div className="ai-debate-layout"><aside className="ai-debate-sidebar card-surface"><span className="eyebrow">AI DEBATE</span><h2>{displayMotion}</h2><div className="ai-side-block"><small>YOUR SIDE</small><strong>{config.userSide}</strong></div><div className="ai-side-block opponent-side"><small>OPPONENT DEFENDS</small><strong>{config.aiSide}</strong></div><div className="ai-rule-note">Puter usage belongs to your Puter account. Text is sent to the selected model only for this debate.</div></aside><section className="ai-debate-main"><div className="ai-transcript" aria-live="polite">{snapshot.transcript.map((turn, index) => <article className={`ai-turn ${turn.role}`} key={`${turn.round}-${turn.role}-${index}`}><span className="ai-turn-label">{turn.role === 'user' ? 'YOU' : config.opponent.displayName}</span><p>{turn.content}</p>{turn.role === 'opponent' && index === snapshot.transcript.length - 1 && <div className="ai-feedback-row"><span>Was this response useful?</span>{([['helpful', 'Helpful'], ['not_helpful', 'Not helpful'], ['incorrect', 'Incorrect or fabricated'], ['too_long', 'Too long'], ['missed_point', 'Did not address my point']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => void onFeedback(value)}>{label}</button>)}</div>}</article>)}{snapshot.partialResponse && <article className="ai-turn opponent streaming"><span className="ai-turn-label">{config.opponent.displayName} · responding…</span><p>{snapshot.partialResponse}</p></article>}{!snapshot.transcript.length && !snapshot.partialResponse && <div className="ai-waiting-state"><span>✦</span><strong>Your first argument sets the direction.</strong><small>Make your case for {config.userSide}.</small></div>}</div>{(generation === 'interrupted' || generation === 'error' || snapshot.interrupted) && <div className="ai-interrupted" role="status"><strong>{generation === 'error' ? 'Response interrupted' : 'Response stopped'}</strong><span>{error || 'The partial reply is saved. Retry uses the same latest argument.'}</span>{aiButton('Retry response', () => void send(), 'secondary', generation === 'streaming')}</div>}{!completeReady && <div className="ai-response-box"><textarea aria-label="Your AI debate argument" value={argument} onChange={event => setArgument(event.target.value.slice(0, 500))} placeholder={pendingUser ? 'The latest response is waiting for a retry…' : `Make your case for ${config.userSide}…`} disabled={generation === 'streaming' || pendingUser} /><div className="ai-response-footer"><small>{argument.length} / 500 · plain text only</small><div>{generation === 'streaming' && aiButton('Stop response', stop, 'secondary')}{generation !== 'streaming' && !pendingUser && aiButton('Send argument', () => void send(), 'dark', argument.trim().length < 12)}</div></div></div>}{completeReady && <div className="ai-complete-card"><strong>Debate complete.</strong><span>You reached the {snapshot.roundLimit}-round limit. One compact AI review will be requested.</span>{aiButton('Complete and review', () => { clearArgumentDraft(draftKey); void onComplete(snapshot.transcript) }, 'dark')}</div>}</section></div></div>
}

function AiResultsBase({ result, onRematch, onSwap, onChangeOpponent, onAnotherTake }: { result: ResultData; onRematch: () => void; onSwap: () => void; onChangeOpponent: () => void; onAnotherTake: () => void }) {
  const review = result.ai?.evaluation
  return <div className="page ai-results-page"><span className="eyebrow">AI DEBATE COMPLETE</span><h1>Keep the<br /><em>good tension.</em></h1><p className="muted">{result.ai?.family} · {result.ai?.modelId} · {result.ai?.quality || 'balanced'} quality · {result.ai?.responseLength || 'standard'} replies</p>{review ? <section className="ai-review-grid"><div className="ai-review-card card-surface"><span className="eyebrow">ARGUMENT REVIEW</span><div className="ai-score-total"><strong>{result.score}</strong><small>/100 technique score</small></div><div className="ai-score-list">{result.scores.map(score => <div key={score.label}><span>{score.label}</span><b>{score.score}/20</b><i style={{ width: `${score.score * 5}%` }} /></div>)}</div></div><div className="ai-review-card card-surface"><span className="eyebrow">ARGUMENT DNA</span><h2>{review.argumentDna}</h2><dl><dt>Strongest point</dt><dd>{review.strongestPoint}</dd><dt>Weakest assumption</dt><dd>{review.weakestAssumption}</dd><dt>Missed counterargument</dt><dd>{review.missedCounterargument}</dd></dl><div className="ai-improved-response"><small>ONE IMPROVED RESPONSE</small><p>{review.improvedExampleResponse}</p></div></div></section> : <section className="ai-review-unavailable card-surface"><span className="eyebrow">REVIEW UNAVAILABLE</span><h2>Your completed debate is saved.</h2><p>The AI review could not be completed, so no score was invented. Your transcript, streak, and history are preserved.</p></section>}<div className="ai-result-actions">{aiButton('Rematch same opponent', onRematch, 'dark')}{aiButton('Swap sides', onSwap, 'secondary')}{aiButton('Choose another opponent', onChangeOpponent, 'secondary')}{aiButton('Debate another take', onAnotherTake, 'ghost')}</div></div>
}
