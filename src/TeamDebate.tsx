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

const teamApiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

async function requestTeamReview(session: TeamDebateSession): Promise<TeamAiReview> {
  const response = await fetch(`${teamApiBaseUrl}/api/ai/team-review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic: session.topic.statement, teams: session.teams.map(team => ({ id: team.id, name: team.name })), transcript: session.turns.slice(0, 32).map(turn => ({ teamId: turn.teamId, teamName: session.teams.find(team => team.id === turn.teamId)?.name || turn.teamId, round: turn.round, roundType: turn.roundType, content: turn.content, skipped: Boolean(turn.skipped) })), language: session.language }) })
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; review?: TeamAiReview }
  if (!response.ok || !payload.review) throw new Error(payload.error?.message || 'The AI review was unavailable. Your transcript is still saved.')
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
    next.lang = language === 'de' ? 'de-DE' : 'en-US'
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
    if (roundTypes.length === 0) return setError('Choose at least one round type.')
    if (teamNames.slice(0, teamCount).some(name => name.trim().length < 1)) return setError('Give every team a name.')
    setBusy(true)
    try {
      const now = new Date().toISOString()
      await onStart(createTeamSession({ facilitatorId: userId, groupId: groupId || null, language, topic: { statement: topicStatement, context: topicContext, takeId: customTopic.trim() ? null : selectedTake.id, custom: Boolean(customTopic.trim()) }, teams: teamNames.slice(0, teamCount).map((name, index) => ({ id: `team-${index + 1}`, name: name.trim().slice(0, 32), color: teamColors[index], icon: teamIcons[index] })), format, rounds: Math.max(1, Math.min(8, rounds)), roundTypes, teamTurnSeconds: Math.max(20, Math.min(600, teamTurnSeconds)), totalSeconds: Math.max(60, Math.min(7200, totalSeconds)), preparationSeconds: Math.max(0, Math.min(300, preparationSeconds)), closingRound, scoring }, now))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The Team Debate could not be started.') } finally { setBusy(false) }
  }

  return <div className="page team-page"><button type="button" className="back-link" onClick={onBack}>← Back</button><div className="page-heading"><div><span className="eyebrow">SHARED DEVICE MODE</span><h1>Team Debate<span className="heading-period">.</span></h1><p className="muted">A structured debate for classrooms, clubs, families and friends. No participant account required.</p></div><span className="team-beta-badge">PRIVATE FACILITATOR SESSION</span></div><div className="team-setup-grid"><section className="team-setup-main card-surface"><div className="settings-section-heading"><div><span className="eyebrow">01 · TOPIC</span><h2>Choose the motion</h2></div></div><div className="team-topic-options">{takes.slice(0, 4).map(take => <button type="button" key={take.id} className={topicChoice === take.id && !customTopic ? 'selected' : ''} onClick={() => { setTopicChoice(take.id); setCustomTopic(''); setCustomContext('') }}><strong>{takeText(take, language).statement}</strong><small>{takeText(take, language).category}</small></button>)}</div><label className="field-label" htmlFor="team-custom-topic">Private custom topic</label><input id="team-custom-topic" className="text-input" maxLength={240} value={customTopic} onChange={event => setCustomTopic(event.target.value)} placeholder="Example: Schools should start later" /><textarea className="settings-textarea" maxLength={600} value={customContext} onChange={event => setCustomContext(event.target.value)} placeholder="Neutral context (optional)" /><p className="field-help">Custom motions stay in this session or group. They are never published automatically.</p><div className="team-setup-divider" /><div className="settings-section-heading"><div><span className="eyebrow">02 · TEAMS</span><h2>Build the room</h2></div></div><div className="team-count-options">{[2, 3, 4].map(count => <button type="button" key={count} className={teamCount === count ? 'selected' : ''} onClick={() => setTeamCount(count)}>{count} teams</button>)}</div><div className="team-name-list">{teamNames.slice(0, teamCount).map((name, index) => <label className="field-label" key={teamColors[index]}><span className={`team-swatch ${teamColors[index]}`} />Team {index + 1}<input className="text-input" maxLength={32} value={name} onChange={event => setTeamNames(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /></label>)}</div></section><aside className="team-setup-side"><section className="card-surface team-presets"><span className="eyebrow">QUICK START</span><h2>Pick a structure</h2><button type="button" onClick={() => applyPreset('quick')}><strong>Quick classroom debate</strong><small>One clear round · 5–8 minutes</small></button><button type="button" onClick={() => applyPreset('standard')}><strong>Standard debate</strong><small>Opening, argument, rebuttal, closing</small></button><button type="button" onClick={() => applyPreset('deep')}><strong>Deep debate</strong><small>Timer mode with questions and answers</small></button></section><section className="card-surface team-setup-options"><span className="eyebrow">03 · STRUCTURE</span><h2>Set the pace</h2><div className="team-count-options"><button type="button" className={format === 'rounds' ? 'selected' : ''} onClick={() => setFormat('rounds')}>Round mode</button><button type="button" className={format === 'timer' ? 'selected' : ''} onClick={() => setFormat('timer')}>Timer mode</button></div><label className="field-label">Rounds<input className="number-input" type="number" min={1} max={8} value={rounds} onChange={event => setRounds(Number(event.target.value))} /></label><label className="field-label">Turn seconds<input className="number-input" type="number" min={20} max={600} value={teamTurnSeconds} onChange={event => setTeamTurnSeconds(Number(event.target.value))} /></label>{format === 'timer' && <label className="field-label">Total minutes<input className="number-input" type="number" min={1} max={120} value={Math.round(totalSeconds / 60)} onChange={event => setTotalSeconds(Number(event.target.value) * 60)} /></label>}<label className="field-label">Preparation seconds<input className="number-input" type="number" min={0} max={300} value={preparationSeconds} onChange={event => setPreparationSeconds(Number(event.target.value))} /></label><span className="field-label">Round types</span><div className="round-type-options">{(Object.keys(teamRoundLabels) as TeamRoundType[]).map(type => <button type="button" key={type} className={roundTypes.includes(type) ? 'selected' : ''} aria-pressed={roundTypes.includes(type)} onClick={() => toggleRoundType(type)}>{teamRoundLabels[type]}</button>)}</div><label className="toggle-row"><input type="checkbox" checked={closingRound} onChange={event => setClosingRound(event.target.checked)} /><span>Include a closing round</span><small>Short debates can skip any round type.</small></label><label className="field-label">Results<select className="settings-select" value={scoring} onChange={event => setScoring(event.target.value as TeamScoring)}><option value="none">No winner — summary only</option><option value="facilitator">Facilitator scoring</option><option value="ai">AI-assisted feedback (one bounded review)</option></select></label></section></aside></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="team-setup-footer"><p><strong>Text is always available.</strong> Voice input is optional and only saves the approved transcript, never raw audio.</p><button type="button" className="button button-primary" onClick={() => void start()} disabled={busy}>{busy ? 'Starting…' : 'Start Team Debate →'}</button></div></div>
}

function TeamActive({ language, session, onSave, onBack, onNotify }: { language: Language; session: TeamDebateSession; onSave: (session: TeamDebateSession) => Promise<void> | void; onBack: () => void; onNotify: (message: string) => void }) {
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
    if (!window.confirm('End this Team Debate? The transcript will remain saved for the facilitator.')) return
    await onSave({ ...session, status: 'ended', result: { scoring: session.scoring, facilitatorScores: {}, commonGround, completedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() })
  }

  if (session.status === 'completed' || session.status === 'ended') return <TeamResults language={language} session={session} commonGround={commonGround} setCommonGround={setCommonGround} onSave={onSave} onBack={onBack} />

  return <div className="page team-page team-active-page"><div className="team-active-header"><button type="button" className="back-link" onClick={onBack}>← Exit to setup</button><span className="team-session-label">TEAM DEBATE · {session.format === 'timer' ? 'TIMER MODE' : 'ROUND MODE'}</span><button type="button" className="back-link" onClick={() => void endDebate()}>End debate</button></div><div className="team-progress-line"><span style={{ width: `${progress}%` }} /></div><div className="team-active-grid"><aside className="card-surface team-current-card"><span className="eyebrow">CURRENT TEAM</span><div className={`team-current-mark ${team.color}`}>{team.icon}</div><h1>{team.name}</h1><p>{session.topic.statement}</p><div className="team-stat-row"><span><small>Round</small><strong>{round} / {session.rounds}</strong></span><span><small>Round type</small><strong>{teamRoundLabels[roundType]}</strong></span><span><small>Time</small><strong>{Math.floor(session.remainingSeconds / 60)}:{String(session.remainingSeconds % 60).padStart(2, '0')}</strong></span></div></aside><main className="team-turn-panel"><div className="team-topic-strip"><span className="eyebrow">MOTION</span><strong>{session.topic.statement}</strong>{session.topic.context && <small>{session.topic.context}</small>}</div>{lastTurn && <div className="previous-argument"><span className="eyebrow">PREVIOUS ARGUMENT · ANSWER THIS POINT</span><p>{lastTurn.content}</p></div>}<section className="card-surface team-composer"><div className="team-composer-top"><div><span className="eyebrow">{team.name.toUpperCase()} · {teamRoundLabels[roundType].toUpperCase()}</span><h2>Make the strongest case</h2></div><span className={`team-timer ${session.remainingSeconds < 20 ? 'urgent' : ''}`}>{session.status === 'paused' ? 'PAUSED' : `${session.remainingSeconds}s`}</span></div><textarea value={argument} maxLength={2000} onChange={event => setArgument(event.target.value)} placeholder="Write the team’s argument here…" disabled={busy || session.status !== 'active'} /><div className="team-composer-actions"><VoiceButton language={language} disabled={busy || session.status !== 'active'} onTranscript={text => setArgument(current => `${current}${current ? ' ' : ''}${text}`.slice(0, 2000))} /><small>{argument.length} / 2,000 · approved transcript only</small><button type="button" className="button button-primary" onClick={() => void submit()} disabled={busy || session.status !== 'active'}>{busy ? 'Saving…' : 'Submit turn'}</button></div></section><div className="team-controls"><button type="button" className="button button-secondary" onClick={() => void togglePause()}>{session.status === 'paused' ? 'Resume timer' : 'Pause timer'}</button><button type="button" className="button button-ghost" onClick={() => void submit(true)} disabled={busy || session.status !== 'active'}>Skip absent team</button><button type="button" className="button button-ghost" onClick={() => setFacilitatorOpen(value => !value)}>{facilitatorOpen ? 'Hide facilitator controls' : 'Facilitator controls'}</button></div>{facilitatorOpen && <div className="card-surface facilitator-panel"><strong>Facilitator controls</strong><p>Use pause, skip or end controls carefully. Submitted turns cannot be duplicated.</p><button type="button" className="button button-secondary" onClick={() => void onSave({ ...session, remainingSeconds: session.remainingSeconds + 30, updatedAt: new Date().toISOString() })}>Add 30 seconds</button></div>}{error && <p className="form-error" role="alert">{error}</p>}<p className="field-help team-privacy-note">Shared-device mode stores the approved text transcript with the signed-in facilitator. Voice audio is not uploaded or retained.</p></main></div></div>
}

function TeamResults({ language, session, commonGround, setCommonGround, onSave, onBack }: { language: Language; session: TeamDebateSession; commonGround: string; setCommonGround: (value: string) => void; onSave: (session: TeamDebateSession) => Promise<void> | void; onBack: () => void }) {
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
  const aiReviewCard = session.result?.scoring === 'ai' ? <section className="card-surface team-ai-review"><span className="eyebrow">AI-ASSISTED FEEDBACK</span><h2>Technique, not ideology</h2>{reviewState === 'loading' && <p className="muted">Reviewing the bounded transcript once. No winner will be assigned.</p>}{reviewState === 'error' && <p className="form-error" role="alert">AI review unavailable. The transcript remains complete and no score was invented.</p>}{review && <><p>{review.summary}</p><div className="team-review-grid">{session.teams.map(team => { const item = review.teams[team.id]; if (!item) return null; const total = item.clarity + item.relevance + item.rebuttal + item.teamwork + item.fairness; return <article key={team.id}><div className="team-transcript-heading"><span className={`team-swatch ${team.color}`} /><h3>{team.name}</h3><strong>{total}/100</strong></div><p><strong>Strongest point:</strong> {item.strongestPoint}</p><p><strong>Open question:</strong> {item.unansweredQuestion}</p>{item.evidence.length > 0 && <small>Transcript evidence: “{item.evidence[0]}”</small>}</article> })}</div><p className="field-help">The same five-part rubric was applied to every team. Scores describe debate technique, not factual certainty or ideological correctness.</p></>}</section> : null
  return <div className="page team-page team-results-page"><div className="page-heading"><div><span className="eyebrow">DEBATE COMPLETE</span><h1>Good work in the room<span className="heading-period">.</span></h1><p className="muted">A structured transcript for the facilitator. No ideological winner was assigned.</p></div><button type="button" className="back-link" onClick={onBack}>Back to Team Debate</button></div><section className="team-results-summary card-surface"><span className="eyebrow">MOTION</span><h2>{session.topic.statement}</h2><p>{session.topic.context}</p><div className="team-results-meta"><span>{session.turns.length} turns</span><span>{session.teams.length} teams</span><span>{session.result?.scoring === 'none' ? 'Summary only' : session.result?.scoring === 'facilitator' ? 'Facilitator scoring' : 'AI feedback selected'}</span></div></section><div className="team-transcript-grid">{grouped.map(({ team, turns }) => <section className="card-surface team-transcript-card" key={team.id}><div className="team-transcript-heading"><span className={`team-swatch ${team.color}`} /><h2>{team.name}</h2></div>{turns.length ? turns.map(turn => <article key={turn.id}><span>{teamRoundLabels[turn.roundType]} · Round {turn.round}</span><p>{turn.content}</p></article>) : <p className="muted">No submitted turns.</p>}</section>)}</div>{aiReviewCard}<section className="card-surface team-common-ground"><span className="eyebrow">FACILITATOR NOTE</span><h2>What can the room agree on?</h2><textarea className="settings-textarea" maxLength={600} value={commonGround} onChange={event => { setCommonGround(event.target.value); setSaved(false) }} placeholder="Capture common ground or an unanswered question…" /><div className="team-setup-footer"><p>{saved ? 'Saved with the private transcript.' : 'This note stays with the facilitator session.'}</p><button type="button" className="button button-secondary" onClick={() => void saveCommonGround()}>Save note</button></div></section><div className="team-result-actions"><button type="button" className="button button-primary" onClick={onBack}>Start another Team Debate</button><button type="button" className="button button-secondary" onClick={() => window.print()}>Print / export transcript</button></div></div>
}

export function TeamDebate(props: TeamDebateProps) {
  if (!props.session) return <TeamSetup {...props} />
  return <TeamActive language={props.language} session={props.session} onSave={props.onSave} onBack={props.onBack} onNotify={props.onNotify} />
}
