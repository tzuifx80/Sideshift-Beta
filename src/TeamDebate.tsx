import { useEffect, useMemo, useRef, useState } from 'react'
import { getTake, takeText, takes, type Language, type Take } from './domain'
import {
  createTeamSession,
  isSessionComplete,
  roundForTurn,
  roundTypeForTurn,
  submitTeamTurn,
  tickTeamSession,
  teamColors,
  teamIcons,
  teamRoundLabels,
  validateTopic,
  validateTurn,
  type TeamDebateSession,
  type TeamAiReview,
  type TeamFormat,
  type TeamRoundType,
  type TeamScoring,
} from './collaboration'
import { useTranslations } from './i18n'
import type { TranslationKey } from './i18n'
import { apiFetch } from './data/api'
const teamRoundKeys: Record<TeamRoundType, TranslationKey> = { opening: 'team.roundType.opening', argument: 'team.roundType.argument', rebuttal: 'team.roundType.rebuttal', question: 'team.roundType.question', answer: 'team.roundType.answer', closing: 'team.roundType.closing' }

async function requestTeamReview(session: TeamDebateSession): Promise<TeamAiReview> {
  const payload = await apiFetch<{ review?: TeamAiReview }>('/api/ai/team-review', { method: 'POST', body: JSON.stringify({ topic: session.topic.statement, teams: session.teams.map(team => ({ id: team.id, name: team.name })), transcript: session.turns.slice(0, 32).map(turn => ({ teamId: turn.teamId, teamName: session.teams.find(team => team.id === turn.teamId)?.name || turn.teamId, round: turn.round, roundType: turn.roundType, content: turn.content, skipped: Boolean(turn.skipped) })), language: session.language }) })
  if (!payload.review) throw new Error('The AI review was unavailable. Your transcript is still saved.')
  return payload.review
}

type TeamDebateProps = {
  userId: string
  language: Language
  initialTake: Take
  initialTopic?: { statement: string; context: string; takeId: string | null; custom: boolean }
  groupId?: string | null
  session: TeamDebateSession | null
  onStart: (session: TeamDebateSession) => Promise<void> | void
  onSave: (session: TeamDebateSession) => Promise<void> | void
  onBack: () => void
  onNotify: (message: string) => void
}

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type RecognitionConstructor = new () => Recognition

function VoiceButton({ language, disabled, onTranscript }: { language: Language; disabled?: boolean; onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognition = useRef<Recognition | null>(null)

  useEffect(() => {
    const scope = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    setSupported(Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition))
  }, [])

  function toggle() {
    const scope = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition
    if (!Constructor) return
    if (recording) {
      recognition.current?.stop()
      setRecording(false)
      return
    }
    const next = new Constructor()
    next.lang = language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : language === 'it' ? 'it-IT' : 'en-US'
    next.interimResults = false
    next.continuous = false
    next.onresult = event => {
      const text = Array.from(event.results).map(item => item[0]?.transcript || '').join(' ').trim()
      if (text) onTranscript(text)
    }
    next.onend = () => setRecording(false)
    next.onerror = () => setRecording(false)
    recognition.current = next
    try { next.start(); setRecording(true) } catch { setRecording(false) }
  }

  return <button type="button" className={`voice-button ${recording ? 'recording' : ''}`} disabled={disabled || !supported} title={supported ? 'Speech is converted to a transcript on this device. Audio is not stored.' : 'Voice input is not supported in this browser or WebView.'} onClick={toggle}>{recording ? 'Stop voice' : supported ? 'Voice input' : 'Voice unavailable'}</button>
}

function TeamSetup({ language, initialTake, initialTopic, groupId, onStart, onBack, onNotify, userId }: Omit<TeamDebateProps, 'session' | 'onSave'>) {
  const t = useTranslations(language)
  const roundLabels = Object.fromEntries(Object.entries(teamRoundKeys).map(([key, translationKey]) => [key, t(translationKey)])) as Record<TeamRoundType, string>
  const fallback = takeText(initialTake, language)
  const [topicChoice, setTopicChoice] = useState(initialTopic?.takeId || initialTake.id)
  const [customTopic, setCustomTopic] = useState(initialTopic?.custom ? initialTopic.statement : '')
  const [customContext, setCustomContext] = useState(initialTopic?.custom ? initialTopic.context : '')
  const [teamCount, setTeamCount] = useState(2)
  const [teamNames, setTeamNames] = useState(['Team A', 'Team B', 'Team C', 'Team D'])
  const [format, setFormat] = useState<TeamFormat>('rounds')
  const [rounds, setRounds] = useState(2)
  const [roundTypes, setRoundTypes] = useState<TeamRoundType[]>(['opening', 'argument', 'rebuttal', 'closing'])
  const [teamTurnSeconds, setTeamTurnSeconds] = useState(90)
  const [totalSeconds, setTotalSeconds] = useState(15 * 60)
  const [preparationSeconds, setPreparationSeconds] = useState(0)
  const [closingRound, setClosingRound] = useState(true)
  const [scoring, setScoring] = useState<TeamScoring>('none')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedTake = useMemo(() => getTake(topicChoice), [topicChoice])
  const selectedText = takeText(selectedTake, language)
  const topicStatement = customTopic.trim() || selectedText.statement
  const topicContext = customTopic.trim() ? customContext.trim() : selectedText.context

  function applyPreset(preset: 'quick' | 'standard' | 'deep') {
    if (preset === 'quick') { setFormat('rounds'); setRounds(1); setRoundTypes(['opening', 'argument', 'closing']); setTeamTurnSeconds(45); setPreparationSeconds(0); setClosingRound(true) }
    if (preset === 'standard') { setFormat('rounds'); setRounds(2); setRoundTypes(['opening', 'argument', 'rebuttal', 'closing']); setTeamTurnSeconds(90); setPreparationSeconds(20); setClosingRound(true) }
    if (preset === 'deep') { setFormat('timer'); setRounds(3); setRoundTypes(['opening', 'argument', 'rebuttal', 'question', 'answer', 'closing']); setTeamTurnSeconds(120); setTotalSeconds(30 * 60); setPreparationSeconds(60); setClosingRound(true) }
  }

  function toggleRoundType(type: TeamRoundType) {
    setRoundTypes(current => current.includes(type) ? current.filter(item => item !== type) : [...current, type])
  }

  async function start() {
    const topicError = validateTopic(topicStatement, topicContext)
    if (topicError) return setError(topicError)
    if (roundTypes.length === 0) return setError(t('groups.noTopics'))
    if (teamNames.slice(0, teamCount).some(name => name.trim().length < 1)) return setError(t('groups.name'))
    setBusy(true)
    try {
      const now = new Date().toISOString()
      await onStart(createTeamSession({ facilitatorId: userId, groupId: groupId || null, language, topic: { statement: topicStatement, context: topicContext, takeId: customTopic.trim() ? null : selectedTake.id, custom: Boolean(customTopic.trim()) }, teams: teamNames.slice(0, teamCount).map((name, index) => ({ id: `team-${index + 1}`, name: name.trim().slice(0, 32), color: teamColors[index], icon: teamIcons[index] })), format, rounds: Math.max(1, Math.min(8, rounds)), roundTypes, teamTurnSeconds: Math.max(20, Math.min(600, teamTurnSeconds)), totalSeconds: Math.max(60, Math.min(7200, totalSeconds)), preparationSeconds: Math.max(0, Math.min(300, preparationSeconds)), closingRound, scoring }, now))
    } catch (caught) { setError(caught instanceof Error ? caught.message : t('debateChoice.teamTitle')) } finally { setBusy(false) }
  }

  return <div className="page team-page"><button type="button" className="back-link" onClick={onBack}>← {t('common.back')}</button><div className="page-heading"><div><span className="eyebrow">{t('team.sharedDevice')}</span><h1>{t('team.title')}<span className="heading-period">.</span></h1><p className="muted">{t('team.body')}</p></div><span className="team-beta-badge">{t('team.privateSession')}</span></div><div className="team-setup-grid"><section className="team-setup-main card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('team.topicStep')}</span><h2>{t('team.chooseMotion')}</h2></div></div><div className="team-topic-options">{takes.slice(0, 4).map(take => <button type="button" key={take.id} className={topicChoice === take.id && !customTopic ? 'selected' : ''} onClick={() => { setTopicChoice(take.id); setCustomTopic(''); setCustomContext('') }}><strong>{takeText(take, language).statement}</strong><small>{takeText(take, language).category}</small></button>)}</div><label className="field-label" htmlFor="team-custom-topic">{t('team.customTopic')}</label><input id="team-custom-topic" className="text-input" maxLength={240} value={customTopic} onChange={event => setCustomTopic(event.target.value)} placeholder={t('team.customTopicPlaceholder')} /><textarea className="settings-textarea" maxLength={600} value={customContext} onChange={event => setCustomContext(event.target.value)} placeholder={t('team.neutralContextPlaceholder')} /><p className="field-help">{t('team.customTopicHelp')}</p><div className="team-setup-divider" /><div className="settings-section-heading"><div><span className="eyebrow">{t('team.teamsStep')}</span><h2>{t('team.buildRoom')}</h2></div></div><div className="team-count-options">{[2, 3, 4].map(count => <button type="button" key={count} className={teamCount === count ? 'selected' : ''} onClick={() => setTeamCount(count)}>{t('team.count', { count })}</button>)}</div><div className="team-name-list">{teamNames.slice(0, teamCount).map((name, index) => <label className="field-label" key={teamColors[index]}><span className={`team-swatch ${teamColors[index]}`} />Team {index + 1}<input className="text-input" maxLength={32} value={name} onChange={event => setTeamNames(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /></label>)}</div></section><aside className="team-setup-side"><section className="card-surface team-presets"><span className="eyebrow">{t('team.quickStart')}</span><h2>{t('team.pickStructure')}</h2><button type="button" onClick={() => applyPreset('quick')}><strong>{t('team.quickClassroom')}</strong><small>{t('team.quickClassroomBody')}</small></button><button type="button" onClick={() => applyPreset('standard')}><strong>{t('team.standardDebate')}</strong><small>{t('team.standardDebateBody')}</small></button><button type="button" onClick={() => applyPreset('deep')}><strong>{t('team.deepDebate')}</strong><small>{t('team.deepDebateBody')}</small></button></section><section className="card-surface team-setup-options"><span className="eyebrow">{t('team.structureStep')}</span><h2>{t('team.setPace')}</h2><div className="team-count-options"><button type="button" className={format === 'rounds' ? 'selected' : ''} onClick={() => setFormat('rounds')}>{t('team.roundMode')}</button><button type="button" className={format === 'timer' ? 'selected' : ''} onClick={() => setFormat('timer')}>{t('team.timerMode')}</button></div><label className="field-label">{t('team.rounds')}<input className="number-input" type="number" min={1} max={8} value={rounds} onChange={event => setRounds(Number(event.target.value))} /></label><label className="field-label">{t('team.turnSeconds')}<input className="number-input" type="number" min={20} max={600} value={teamTurnSeconds} onChange={event => setTeamTurnSeconds(Number(event.target.value))} /></label>{format === 'timer' && <label className="field-label">{t('team.totalMinutes')}<input className="number-input" type="number" min={1} max={120} value={Math.round(totalSeconds / 60)} onChange={event => setTotalSeconds(Number(event.target.value) * 60)} /></label>}<label className="field-label">{t('team.preparationSeconds')}<input className="number-input" type="number" min={0} max={300} value={preparationSeconds} onChange={event => setPreparationSeconds(Number(event.target.value))} /></label><span className="field-label">{t('team.roundTypes')}</span><div className="round-type-options">{(Object.keys(roundLabels) as TeamRoundType[]).map(type => <button type="button" key={type} className={roundTypes.includes(type) ? 'selected' : ''} aria-pressed={roundTypes.includes(type)} onClick={() => toggleRoundType(type)}>{roundLabels[type]}</button>)}</div><label className="toggle-row"><input type="checkbox" checked={closingRound} onChange={event => setClosingRound(event.target.checked)} /><span>{t('team.includeClosing')}</span><small>{t('team.shortDebates')}</small></label><label className="field-label">{t('team.results')}<select className="settings-select" value={scoring} onChange={event => setScoring(event.target.value as TeamScoring)}><option value="none">{t('team.summaryOnly')}</option><option value="facilitator">{t('team.facilitatorScoring')}</option><option value="ai">{t('team.aiFeedback')}</option></select></label></section></aside></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="team-setup-footer"><p><strong>{t('team.textAvailable')}</strong> {t('team.voiceOptional')}</p><button type="button" className="button button-primary" onClick={() => void start()} disabled={busy}>{busy ? t('team.starting') : t('team.start')}</button></div></div>
}

function TeamActive({ language, session, onSave, onBack, onNotify }: { language: Language; session: TeamDebateSession; onSave: (session: TeamDebateSession) => Promise<void> | void; onBack: () => void; onNotify: (message: string) => void }) {
  const t = useTranslations(language)
  const roundLabels = Object.fromEntries(Object.entries(teamRoundKeys).map(([key, translationKey]) => [key, t(translationKey)])) as Record<TeamRoundType, string>
  const [argument, setArgument] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [facilitatorOpen, setFacilitatorOpen] = useState(false)
  const [commonGround, setCommonGround] = useState('')
  const lastTurn = session.turns[session.turns.length - 1]
  const team = session.teams[session.currentTurnIndex % session.teams.length]
  const round = roundForTurn(session)
  const roundType = roundTypeForTurn(session)
  const completed = isSessionComplete(session)
  const progress = Math.min(100, Math.round((session.currentTurnIndex / Math.max(session.teams.length * session.rounds, 1)) * 100))

  useEffect(() => {
    if (session.status !== 'active' || completed) return
    const timer = window.setInterval(() => {
      if (session.remainingSeconds <= 0) return
      void onSave(tickTeamSession(session))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [completed, onSave, session])

  async function submit(skip = false) {
    if (busy || session.status !== 'active') return
    if (!skip) {
      const validation = validateTurn(argument)
      if (validation) return setError(validation)
    }
    setBusy(true)
    setError('')
    try {
      const output = submitTeamTurn(session, argument, new Date().toISOString(), skip)
      if (!output.session) return setError(output.error || 'Turn could not be submitted.')
      const next = output.session
      setArgument('')
      await onSave(next)
    } finally { setBusy(false) }
  }

  async function togglePause() {
    const nextStatus = session.status === 'active' ? 'paused' : 'active'
    await onSave({ ...session, status: nextStatus, updatedAt: new Date().toISOString() })
  }

  async function endDebate() {
    if (!window.confirm(`${t('debateChoice.teamTitle')}? ${t('groups.pointsBody')}`)) return
    await onSave({ ...session, status: 'ended', result: { scoring: session.scoring, facilitatorScores: {}, commonGround, completedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() })
  }

  if (session.status === 'completed' || session.status === 'ended') return <TeamResults language={language} session={session} commonGround={commonGround} setCommonGround={setCommonGround} onSave={onSave} onBack={onBack} />

  return <div className="page team-page team-active-page"><div className="team-active-header"><button type="button" className="back-link" onClick={onBack}>← {t('team.exitSetup')}</button><span className="team-session-label">{t('team.title')} · {session.format === 'timer' ? t('team.timerMode') : t('team.roundMode')}</span><button type="button" className="back-link" onClick={() => void endDebate()}>{t('team.end')}</button></div><div className="team-progress-line"><span style={{ width: `${progress}%` }} /></div><div className="team-active-grid"><aside className="card-surface team-current-card"><span className="eyebrow">{t('team.current')}</span><div className={`team-current-mark ${team.color}`}>{team.icon}</div><h1>{team.name}</h1><p>{session.topic.statement}</p><div className="team-stat-row"><span><small>{t('team.rounds')}</small><strong>{round} / {session.rounds}</strong></span><span><small>{t('team.roundTypes')}</small><strong>{roundLabels[roundType]}</strong></span><span><small>{t('team.totalMinutes')}</small><strong>{Math.floor(session.remainingSeconds / 60)}:{String(session.remainingSeconds % 60).padStart(2, '0')}</strong></span></div></aside><main className="team-turn-panel"><div className="team-topic-strip"><span className="eyebrow">{t('team.motion')}</span><strong>{session.topic.statement}</strong>{session.topic.context && <small>{session.topic.context}</small>}</div>{lastTurn && <div className="previous-argument"><span className="eyebrow">{t('team.previousArgument')} · {t('team.answerPoint')}</span><p>{lastTurn.content}</p></div>}<section className="card-surface team-composer"><div className="team-composer-top"><div><span className="eyebrow">{team.name.toUpperCase()} · {roundLabels[roundType].toUpperCase()}</span><h2>{t('team.makeCase')}</h2></div><span className={`team-timer ${session.remainingSeconds < 20 ? 'urgent' : ''}`}>{session.status === 'paused' ? t('team.paused') : `${session.remainingSeconds}s`}</span></div><textarea value={argument} maxLength={2000} onChange={event => setArgument(event.target.value)} placeholder={t('ai.argumentPlaceholder')} disabled={busy || session.status !== 'active'} /><div className="team-composer-actions"><VoiceButton language={language} disabled={busy || session.status !== 'active'} onTranscript={text => setArgument(current => `${current}${current ? ' ' : ''}${text}`.slice(0, 2000))} /><small>{argument.length} / 2,000 · {t('team.transcriptEvidence')}</small><button type="button" className="button button-primary" onClick={() => void submit()} disabled={busy || session.status !== 'active'}>{busy ? t('team.saveTurn') : t('team.submitTurn')}</button></div></section><div className="team-controls"><button type="button" className="button button-secondary" onClick={() => void togglePause()}>{session.status === 'paused' ? t('team.resumeTimer') : t('team.pauseTimer')}</button><button type="button" className="button button-ghost" onClick={() => void submit(true)} disabled={busy || session.status !== 'active'}>{t('team.skipTeam')}</button><button type="button" className="button button-ghost" onClick={() => setFacilitatorOpen(value => !value)}>{facilitatorOpen ? t('team.hideControls') : t('team.facilitatorControls')}</button></div>{facilitatorOpen && <div className="card-surface facilitator-panel"><strong>{t('team.facilitatorControls')}</strong><p>{t('team.controlsHelp')}</p><button type="button" className="button button-secondary" onClick={() => void onSave({ ...session, remainingSeconds: session.remainingSeconds + 30, updatedAt: new Date().toISOString() })}>{t('team.addSeconds')}</button></div>}{error && <p className="form-error" role="alert">{error}</p>}<p className="field-help team-privacy-note">{t('team.privacyNote')}</p></main></div></div>
}

function TeamResults({ language, session, commonGround, setCommonGround, onSave, onBack }: { language: Language; session: TeamDebateSession; commonGround: string; setCommonGround: (value: string) => void; onSave: (session: TeamDebateSession) => Promise<void> | void; onBack: () => void }) {
  const t = useTranslations(language)
  const roundLabels = Object.fromEntries(Object.entries(teamRoundKeys).map(([key, translationKey]) => [key, t(translationKey)])) as Record<TeamRoundType, string>
  const [saved, setSaved] = useState(false)
  const [localReview, setLocalReview] = useState<TeamAiReview | null>(session.result?.aiReview || null)
  const [reviewState, setReviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>(session.result?.aiReview ? 'ready' : 'idle')
  const reviewRequestRef = useRef<string | null>(null)
  const grouped = session.teams.map(team => ({ team, turns: session.turns.filter(turn => turn.teamId === team.id) }))
  useEffect(() => {
    if (session.result?.scoring !== 'ai' || session.result.aiReview || reviewRequestRef.current === session.id) return
    reviewRequestRef.current = session.id
    setReviewState('loading')
    requestTeamReview(session).then(review => {
      setLocalReview(review)
      setReviewState('ready')
      void Promise.resolve(onSave({ ...session, result: { ...(session.result as NonNullable<TeamDebateSession['result']>), aiReview: review }, updatedAt: new Date().toISOString() })).catch(() => setReviewState('error'))
    }).catch(() => setReviewState('error'))
  }, [session.id, session.result?.aiReview, session.result?.scoring])
  async function saveCommonGround() {
    await onSave({ ...session, result: { ...(session.result || { scoring: session.scoring, facilitatorScores: {}, completedAt: new Date().toISOString() }), commonGround: commonGround.trim() }, updatedAt: new Date().toISOString() })
    setSaved(true)
  }
  const review = localReview || session.result?.aiReview
  const aiReviewCard = session.result?.scoring === 'ai' ? <section className="card-surface team-ai-review"><span className="eyebrow">{t('team.aiAssisted')}</span><h2>{t('team.techniqueNotIdeology')}</h2>{reviewState === 'loading' && <p className="muted">{t('team.reviewLoading')}</p>}{reviewState === 'error' && <p className="form-error" role="alert">{t('team.reviewUnavailable')}</p>}{review && <><p>{review.summary}</p><div className="team-review-grid">{session.teams.map(team => { const item = review.teams[team.id]; if (!item) return null; const total = item.clarity + item.relevance + item.rebuttal + item.teamwork + item.fairness; return <article key={team.id}><div className="team-transcript-heading"><span className={`team-swatch ${team.color}`} /><h3>{team.name}</h3><strong>{total}/100</strong></div><p><strong>{t('team.strongestPoint')}</strong> {item.strongestPoint}</p><p><strong>{t('team.openQuestion')}</strong> {item.unansweredQuestion}</p>{item.evidence.length > 0 && <small>{t('team.transcriptEvidence')} “{item.evidence[0]}”</small>}</article> })}</div><p className="field-help">{t('team.rubric')}</p></>}</section> : null
  return <div className="page team-page team-results-page"><div className="page-heading"><div><span className="eyebrow">{t('team.complete')}</span><h1>{t('team.goodWork').replace(/[.]$/, '')}<span className="heading-period">.</span></h1><p className="muted">{t('team.completeBody')}</p></div><button type="button" className="back-link" onClick={onBack}>{t('team.backToSetup')}</button></div><section className="team-results-summary card-surface"><span className="eyebrow">{t('team.motion')}</span><h2>{session.topic.statement}</h2><p>{session.topic.context}</p><div className="team-results-meta"><span>{session.turns.length} turns</span><span>{session.teams.length} teams</span><span>{session.result?.scoring === 'none' ? t('team.summaryOnly') : session.result?.scoring === 'facilitator' ? t('team.facilitatorScoring') : t('team.aiAssisted')}</span></div></section><div className="team-transcript-grid">{grouped.map(({ team, turns }) => <section className="card-surface team-transcript-card" key={team.id}><div className="team-transcript-heading"><span className={`team-swatch ${team.color}`} /><h2>{team.name}</h2></div>{turns.length ? turns.map(turn => <article key={turn.id}><span>{roundLabels[turn.roundType]} · Round {turn.round}</span><p>{turn.content}</p></article>) : <p className="muted">{t('team.noSubmittedTurns')}</p>}</section>)}</div>{aiReviewCard}<section className="card-surface team-common-ground"><span className="eyebrow">{t('team.facilitatorNote')}</span><h2>{t('team.commonGround')}</h2><textarea className="settings-textarea" maxLength={600} value={commonGround} onChange={event => { setCommonGround(event.target.value); setSaved(false) }} placeholder={t('team.commonGroundPlaceholder')} /><div className="team-setup-footer"><p>{saved ? t('team.savedNote') : t('team.sessionNote')}</p><button type="button" className="button button-secondary" onClick={() => void saveCommonGround()}>{t('team.saveNote')}</button></div></section><div className="team-result-actions"><button type="button" className="button button-primary" onClick={onBack}>{t('team.startAnother')}</button><button type="button" className="button button-secondary" onClick={() => window.print()}>{t('team.printTranscript')}</button></div></div>
}

export function TeamDebate(props: TeamDebateProps) {
  if (!props.session) return <TeamSetup {...props} />
  return <TeamActive language={props.language} session={props.session} onSave={props.onSave} onBack={props.onBack} onNotify={props.onNotify} />
}
