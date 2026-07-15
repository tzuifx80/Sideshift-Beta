import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  assignSide,
  calculateMockScore,
  createMockOpponent,
  getTake,
  makeUuid,
  movementBetween,
  movementLabel,
  personalizeTakes,
  selectPersonalizedTakes,
  takeText,
  takes,
  interestOptions,
  type DebateSnapshot,
  type AiDebateData,
  type AiEvaluationData,
  type Language,
  type Mode,
  type ResultData,
  type Stance,
  type Take,
} from './domain'
import { AiConnectionCard, AiDebate, AiResults, AiSetup } from './AiMode'
import { buildEvaluationContext } from './lib/ai/contextBuilder'
import { createMockAiProvider } from './lib/ai/provider'
import { getOpponent } from './lib/ai/opponents'
import { aiRuntimeLabel, createAiRuntimeSnapshot } from './lib/ai/runtimeStatus'
import type { AiFeedbackType, AiModel, AiProvider, AiRuntimeSnapshot, AiStartConfig, ResolvedOpponent } from './lib/ai/types'
import { useAuth } from './auth/useAuth'
import type { AppRepository, BetaFeedbackCategory, BetaFeedbackInput, ChallengeResolved, ReportInput } from './data/repository'
import type { UserPreferences, UserProfile, UserStatsSnapshot } from './data/types'
import { accentThemes, appearanceLabels, avatarPresets, normalizePreferences, normalizeProfile, textSizeLabels } from './profile'
import { calculatePersonalStats, type PersonalStats } from './stats'
import { applyTheme } from './theme'
import { setAnalyticsAccessToken, trackEvent } from './analytics'
import { registerServiceWorker, useInstallPrompt, useOnlineStatus, useServiceWorkerUpdate } from './pwa'
import { downloadShareCard, shareCardFile } from './shareCard'
import { clearAiSetupDraft, clearArgumentDraft, hasArgumentDraft, loadAiSetupDraft, loadArgumentDraft, saveArgumentDraft } from './drafts'
import { FirstUseGuide, hasSeenFirstUseGuide, markFirstUseGuideSeen } from './FirstUseGuide'
import { initializeCapacitorBridge, shareWithNative } from './capacitor'
import { Groups } from './Groups'
import { TeamDebate } from './TeamDebate'
import type { GroupSummary, GroupTopic, TeamDebateSession } from './collaboration'

type Screen = 'home' | 'explore' | 'groups' | 'team' | 'debateChoice' | 'debate' | 'results' | 'clash' | 'profile' | 'settings' | 'aiSetup' | 'aiDebate' | 'aiResults'
type IconName = 'arrow' | 'arrowUp' | 'bolt' | 'book' | 'calendar' | 'check' | 'chevron' | 'clock' | 'close' | 'copy' | 'flame' | 'globe' | 'help' | 'home' | 'info' | 'layers' | 'link' | 'lock' | 'message' | 'more' | 'person' | 'plus' | 'search' | 'send' | 'settings' | 'share' | 'shield' | 'spark' | 'star' | 'sun' | 'target' | 'trophy' | 'users' | 'x'
type AiMode = AiRuntimeSnapshot['primary']
type BeginHandler = (mode: Mode, take?: Take) => void | Promise<void>

const stageNames = ['Private stance', 'Opening', 'Rebuttal', 'Pressure question', 'Steelman', 'Closing', 'Your shift']
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function defaultProfile(id: string): UserProfile {
  return { id, displayName: null, bio: null, avatarPreset: 'orbit', interfaceLanguage: 'en', challengeShowName: false, shareRealStance: false }
}

function defaultPreferences(userId: string): UserPreferences {
  return { userId, topicPreferences: [], debateLanguages: ['en'], intensity: 'balanced', preferredMode: 'sideswitch', preferredAiStyle: 'sharp-skeptic', preferredOpponentType: 'ask', preferredAiFamily: 'GPT', preferredOpponentId: 'gpt-logician', preferredAiModelId: null, aiDifficulty: 'intermediate', aiRoundLength: 'standard', aiQuality: 'balanced', aiResponseLength: 'standard', showModelDetails: false, theme: 'system', accent: 'coral', reducedMotion: false, textSize: 'comfortable', shareRealStance: false, onboardingCompleted: false }
}

const emptyStatsSnapshot: UserStatsSnapshot = { challengeCreated: 0, challengeResponses: 0, activityDates: [] }

function appUrl(path: string): string {
  const base = String(import.meta.env.VITE_APP_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  return `${base}${path}`
}

function aiRoundLimit(roundLength: AiStartConfig['roundLength']): number {
  return roundLength === 'quick' ? 3 : roundLength === 'deep' ? 6 : 4
}

function privateTake(motion: string, baseTake: Take): Take {
  return { ...baseTake, id: `private-${makeUuid()}`, statement: motion, statementDe: motion, context: 'Private motion created only for this debate.', contextDe: 'Private motion created only for this debate.' }
}

function hydratedAiConfig(ai: AiDebateData): AiStartConfig | null {
  const opponent = getOpponent(ai.opponentId)
  if (!opponent) return null
  const model: AiModel = { id: ai.modelId, provider: opponent.family, name: ai.modelId, aliases: [], context: null, maxTokens: opponent.maxResponseTokens, inputCost: null, outputCost: null, supportsText: true, supportsChat: true, supportsStreaming: true, isLegacy: false, raw: {} }
  const resolved: ResolvedOpponent = { ...opponent, available: true, model, models: [model], selection: ai.modelSelection || 'exact' }
  return { opponent: resolved, difficulty: ai.difficulty, roundLength: ai.roundLength, quality: ai.quality || 'balanced', responseLength: ai.responseLength || 'standard', modelSelection: ai.modelSelection || 'exact', userSide: ai.userSide, aiSide: ai.aiSide, customMotion: ai.customMotion }
}

function hydratedResultAiConfig(result: ResultData): AiStartConfig | null {
  if (!result.ai) return null
  const opponent = getOpponent(result.ai.opponentId)
  if (!opponent) return null
  const model: AiModel = { id: result.ai.modelId, provider: opponent.family, name: result.ai.modelId, aliases: [], context: null, maxTokens: opponent.maxResponseTokens, inputCost: null, outputCost: null, supportsText: true, supportsChat: true, supportsStreaming: true, isLegacy: false, raw: {} }
  const resolved: ResolvedOpponent = { ...opponent, available: true, model, models: [model], selection: result.ai.modelSelection || 'exact' }
  const aiSide = result.assignedSide === result.take.supportLabel ? result.take.opposeLabel : result.take.supportLabel
  return { opponent: resolved, difficulty: result.ai.difficulty, roundLength: result.ai.roundLength, quality: result.ai.quality || 'balanced', responseLength: result.ai.responseLength || 'standard', modelSelection: result.ai.modelSelection || 'exact', userSide: result.assignedSide, aiSide, customMotion: result.ai.customMotion || null }
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    arrowUp: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z" /><path d="M4 5.5v16" /><path d="M8 7h8" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 9.5h18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
    flame: <path d="M12.2 21c4.2-.1 6.8-2.8 6.8-6.4 0-3.1-2-5.3-4.4-7.4.1 1.8-.4 3.1-1.5 4.1-.1-3.7-1.9-6.3-5-8.3.4 3.8-2.1 5.4-2.1 9.2 0 5.2 2.8 8.6 6.2 8.8Z" />,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.6 2.6 0 1 1 4.5 1.8c-.9.9-2.1 1.3-2.1 2.9M12 17h.01" /></>,
    home: <><path d="m3.5 10 8.5-7 8.5 7" /><path d="M5.5 9v10h13V9M9.5 19v-5h5v5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1.1l1.4-1.4a5 5 0 0 0-7.1-7.1L10.6 5.4" /><path d="M14 11a5 5 0 0 0-7.1-.1L5.5 12.3a5 5 0 0 0 7.1 7.1l.8-.8" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    message: <><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-3.8A3 3 0 0 1 3 15V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z" /><path d="M8 9h8M8 13h5" /></>,
    more: <><circle cx="5" cy="12" r=".8" fill="currentColor" /><circle cx="12" cy="12" r=".8" fill="currentColor" /><circle cx="19" cy="12" r=".8" fill="currentColor" /></>,
    person: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    send: <><path d="m3 4 18 8-18 8 3-8-3-8Z" /><path d="M6 12h15" /></>,
    settings: <><path d="M12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" /><path d="m19.4 15 .1.1-1.5 2.6-.2-.1a2.1 2.1 0 0 0-3.1 1.2v.3h-3v-.3a2.1 2.1 0 0 0-3.1-1.2l-.2.1-1.5-2.6.1-.1a2.1 2.1 0 0 0 0-3.6l-.1-.1 1.5-2.6.2.1a2.1 2.1 0 0 0 3.1-1.2v-.3h3v.3a2.1 2.1 0 0 0 3.1 1.2l.2-.1 1.5 2.6-.1.1a2.1 2.1 0 0 0 0 3.6Z" /></>,
    share: <><circle cx="18" cy="5" r="2.4" /><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="19" r="2.4" /><path d="m8 11 7.6-4.5M8 13l7.6 4.5" /></>,
    shield: <path d="M12 3 20 6v5.7c0 4.4-3.4 7.9-8 9.3-4.6-1.4-8-4.9-8-9.3V6l8-3Z" />,
    spark: <><path d="m12 2 1.2 6.8L20 10l-6.8 1.2L12 18l-1.2-6.8L4 10l6.8-1.2L12 2Z" /><path d="m19 17 .5 2.5L22 20l-2.5.5L19 23l-.5-2.5L16 20l2.5-.5L19 17Z" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".8" fill="currentColor" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" /></>,
    users: <><circle cx="9" cy="9" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 7.5a2.7 2.7 0 0 1 0 5.3M18 15a5 5 0 0 1 3 4.5" /></>,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark"><span /></span>{!compact && <span className="brand-word">Side<span>Shift</span></span>}</div>
}

function Button({ children, variant = 'primary', icon, onClick, type = 'button', className = '', disabled = false }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'dark' | 'soft'; icon?: IconName; onClick?: () => void; type?: 'button' | 'submit'; className?: string; disabled?: boolean }) {
  return <button type={type} className={`button button-${variant} ${className}`} onClick={onClick} disabled={disabled}>{children}{icon && <Icon name={icon} size={16} />}</button>
}

function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`tag tag-${tone}`}>{children}</span>
}

function OfflineBanner({ online }: { online: boolean }) {
  return online ? null : <div className="offline-banner" role="status"><Icon name="info" size={15} /> Offline mode: your private draft stays on this device, but saving, AI replies, challenges, and reports are paused until you reconnect.</div>
}

function BetaNotice({ aiMode }: { aiMode: AiMode }) {
  const message = aiMode === 'mock'
    ? 'Development mock AI is active; replies and scores are simulations, not expert advice.'
    : aiMode === 'basic_server_available'
      ? 'Server AI is available. Puter remains a separate user connection.'
      : aiRuntimeLabel(aiMode) + '. No provider is being represented as connected.'
  return <div className="beta-notice" role="note"><Icon name="info" size={14} /> Private beta: {message} <button type="button" className="text-link" onClick={() => window.dispatchEvent(new Event('sideshift-debate-entry'))}>Choose how to debate</button></div>
}

function InstallControl({ onNotify }: { onNotify: (message: string) => void }) {
  const prompt = useInstallPrompt()
  if (!prompt.available) return null
  return <button type="button" className="install-button install-control" onClick={() => { trackEvent('installation_action_used', { action: 'install_prompt' }); void prompt.install().then(outcome => onNotify(outcome === 'accepted' ? 'SideShift is being installed.' : 'Install dismissed.')) }}><Icon name="plus" size={14} /> Install app</button>
}

function LegalPage({ kind }: { kind: 'privacy' | 'terms' | 'community' }) {
  const content = kind === 'privacy'
    ? { title: 'Privacy', eyebrow: 'HOW SIDESHIFT HANDLES DATA', paragraphs: ['SideShift is a private beta. We use anonymous Supabase Auth to create a session without asking for an email address.', 'We store the display name, selected interests, debate drafts, transcripts, private before/after stances, challenge records, responses, and reports needed to provide the beta. Technical analytics record allow-listed event names and small non-content properties; raw debate text is not sent as analytics.', 'The current beta may use mock AI or a configured AI provider. AI requests are processed by the server and are disclosed in the app. Do not enter sensitive personal information. You can use “Delete my beta data” in Profile to delete your beta records. Your anonymous authentication identity remains until you sign out or the session expires.'], contact: 'Questions: beta-owner@example.com' }
    : kind === 'terms'
      ? { title: 'Beta Terms', eyebrow: 'PRIVATE BETA TERMS', paragraphs: ['SideShift is an experimental private beta provided for testing and feedback. Features, availability, storage, and scores may change or be removed.', 'You are responsible for the material you submit. Do not use SideShift for emergencies, professional advice, confidential information, or unlawful activity. Challenge links are private bearer links: share them only with people you trust.', 'Mock AI is not a factual authority and no score decides whether a belief is correct. By using the beta, you agree to these terms and the Community Rules.'], contact: 'Beta contact: beta-owner@example.com' }
      : { title: 'Community Rules', eyebrow: 'KEEP THE ROOM WORTH RETURNING TO', paragraphs: ['Make the strongest case you can, and make room for another person to think differently.', 'Do not submit harassment, threats, hate or dehumanizing content, sexual exploitation, doxxing or private personal data, spam, malware, illegal instructions, or targeted abuse. Do not use a challenge link to pressure someone into responding.', 'Use the Report control for content that breaks these rules. Reports are stored for beta review and are rate-limited.'], contact: 'Report concerns in-app or contact beta-owner@example.com' }
  return <div className="legal-page"><div className="legal-content"><button type="button" className="back-link" onClick={() => { window.location.href = '/' }}><Icon name="arrow" size={15} /> Back to SideShift</button><Tag tone="coral">{content.eyebrow}</Tag><h1>{content.title}</h1>{content.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}<p className="legal-contact">{content.contact}</p><div className="legal-links"><a href="/privacy">Privacy</a><a href="/terms">Beta Terms</a><a href="/community">Community Rules</a></div></div></div>
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error?.message || `Request failed (${response.status}).`)
  return payload as T
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function Onboarding({ onComplete, online }: { onComplete: (name: string, interests: string[]) => Promise<void>; online?: boolean }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(['Politics and Democracy', 'Football', 'AI and Technology'])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  async function submit() {
    if (!isOnline) return setError('You are offline. Reconnect before saving your private setup.')
    const trimmed = name.trim()
    if (trimmed.length < 2) return setError('Add a display name with at least two characters.')
    if (selected.length < 3) return setError('Choose at least three arenas so we can personalize your takes.')
    setBusy(true)
    try { await onComplete(trimmed, selected) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save your preferences.') } finally { setBusy(false) }
  }
  return <div className="onboarding-page"><div className="onboarding-top"><Logo /><span className="onboarding-meta"><Icon name="lock" size={14} /> Private by default</span></div><div className="onboarding-layout"><section className="onboarding-copy"><Tag tone="coral">PERSPECTIVE GAME</Tag><h1>Can you move<br /><em>a mind?</em></h1><p className="onboarding-lede">Defend the side you disagree with in a five-minute challenge. SideShift asks you to make the strongest case, then shows what actually moved.</p></section><section className="onboarding-card"><div className="onboarding-card-head"><span className="eyebrow">FIRST, A QUICK SETUP</span><span className="step-count">01 / 01</span></div><h2>What should we call you?</h2><p className="muted">Your profile is private by default.</p><label className="field-label" htmlFor="display-name">Display name</label><input id="display-name" className="text-input" value={name} onChange={event => { setName(event.target.value); setError('') }} placeholder="Your name" maxLength={24} autoComplete="nickname" /><div className="setup-divider" /><div className="onboarding-card-head"><span className="eyebrow">PICK YOUR ARENAS</span><span className="step-count">Choose 3+</span></div><div className="interest-grid">{interestOptions.map(interest => <button type="button" key={interest} className={`interest-chip ${selected.includes(interest) ? 'selected' : ''}`} aria-pressed={selected.includes(interest)} onClick={() => setSelected(current => current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest])}>{selected.includes(interest) && <Icon name="check" size={14} />}{interest}</button>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<Button className="full-width onboarding-submit" icon="arrow" onClick={() => void submit()} disabled={busy}>{busy ? 'Connecting…' : 'Enter the arena'}</Button><p className="onboarding-footnote"><Icon name="shield" size={14} /> Your starting stance stays private.</p></section></div></div>
}

function Sidebar({ screen, name, historyCount, onNavigate, onOpenProfile, onNotify }: { screen: Screen; name: string; historyCount: number; onNavigate: (screen: Screen) => void; onOpenProfile: () => void; onNotify: (message: string) => void }) {
  return <aside className="sidebar"><div className="sidebar-brand"><Logo /></div><div className="sidebar-section-label">YOUR SPACE</div><nav className="sidebar-nav">{[{ id: 'home' as Screen, label: 'Today', icon: 'home' as IconName }, { id: 'explore' as Screen, label: 'Explore takes', icon: 'layers' as IconName }, { id: 'results' as Screen, label: 'Your shifts', icon: 'spark' as IconName }].map(item => <button type="button" key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.id === 'results' && historyCount > 0 && <span className="nav-count">{historyCount}</span>}</button>)}</nav><div className="sidebar-section-label sidebar-modes-label">PLAY MODES</div><button type="button" className="nav-item" onClick={() => onNavigate('home')}><span className="mode-dot dot-coral" /><span>Classic</span></button><button type="button" className="nav-item" onClick={() => onNavigate('home')}><span className="mode-dot dot-lavender" /><span>SideSwitch</span><Tag tone="new">NEW</Tag></button><button type="button" className="nav-item" onClick={() => onNavigate('clash')}><span className="mode-dot dot-yellow" /><span>Friend Clash</span></button><div className="sidebar-spacer" /><div className="streak-card"><div className="streak-top"><span className="streak-icon"><Icon name="flame" size={16} /></span><span>{historyCount ? `${Math.min(historyCount, 3)} day streak` : 'Start your streak'}</span></div><div className="streak-dots"><i className={historyCount ? 'filled' : ''} /><i className={historyCount > 1 ? 'filled' : ''} /><i className={historyCount > 2 ? 'filled' : ''} /><i /><i /><i /><i /></div><p>Keep your thinking<br />in motion.</p></div><button type="button" className="profile-mini" onClick={onOpenProfile}><span className="avatar avatar-coral">{name.slice(0, 1).toUpperCase()}</span><span className="profile-mini-copy"><strong>{name}</strong><small>Curious challenger</small></span><span aria-label="Profile options" onClick={event => { event.stopPropagation(); onNotify('Profile settings are coming after beta.') }}><Icon name="more" size={16} /></span></button></aside>
}

function TopBar({ onLanguage, language, aiMode, onProfile, onNotify }: { onLanguage: () => void; language: Language; aiMode: AiMode; onProfile: () => void; onNotify: (message: string) => void }) {
  return <header className="topbar"><div className="mobile-logo"><Logo compact /></div><div className="breadcrumb"><span>Today</span><span className="breadcrumb-dot">·</span><strong>{aiRuntimeLabel(aiMode)} <Icon name="spark" size={14} /></strong></div><div className="topbar-actions"><button type="button" className="language-button" onClick={onLanguage} aria-label={`Switch language. Current language ${language}`}><Icon name="globe" size={15} /> {language.toUpperCase()} <Icon name="chevron" size={12} /></button><button type="button" className="icon-button" aria-label="Help" onClick={() => onNotify('SideShift takes about five minutes: state your view, defend a side, then reflect.') }><Icon name="help" size={18} /></button><button type="button" className="icon-button notification-button" aria-label="Notifications" onClick={() => onNotify('No new notifications.') }><Icon name="spark" size={17} /><i /></button><button type="button" className="top-avatar" onClick={onProfile} aria-label="Open profile">A</button></div></header>
}

function AppShell({ children, screen, name, historyCount, onNavigate, onLanguage, language, aiMode, onProfile, onNotify, online, onDelete }: { children: ReactNode; screen: Screen; name: string; historyCount: number; onNavigate: (screen: Screen) => void; onLanguage: () => void; language: Language; aiMode: AiMode; onProfile: () => void; onNotify: (message: string) => void; online?: boolean; onDelete?: () => void }) {
  const navItems = [{ id: 'home' as Screen, label: 'Today', short: 'Today', icon: 'home' as IconName }, { id: 'explore' as Screen, label: 'Explore takes', short: 'Explore', icon: 'layers' as IconName }, { id: 'results' as Screen, label: 'Your shifts', short: 'Shifts', icon: 'spark' as IconName }]
  return <div className="app-shell"><Sidebar screen={screen} name={name} historyCount={historyCount} onNavigate={onNavigate} onOpenProfile={onProfile} onNotify={onNotify} /><div className="main-column"><TopBar onLanguage={onLanguage} language={language} aiMode={aiMode} onProfile={onProfile} onNotify={onNotify} /><InstallControl onNotify={onNotify} /><OfflineBanner online={online ?? true} /><BetaNotice aiMode={aiMode} /><main className="main-content">{children}</main><nav className="mobile-nav" aria-label="Primary navigation">{navItems.map(item => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.short}</span></button>)}<button type="button" onClick={onProfile}><Icon name="person" size={19} /><span>Profile</span></button></nav><footer className="app-footer"><a href="/privacy">Privacy</a><a href="/terms">Beta Terms</a><a href="/community">Community Rules</a>{onDelete && <button type="button" className="delete-data-button" onClick={onDelete}>Delete my beta data</button>}</footer></div></div>
}

function AppShellV2({ children, screen, name, historyCount, onNavigate, onLanguage, language, aiMode, onNotify, online, onDelete, hasUnsavedDraft }: { children: ReactNode; screen: Screen; name: string; historyCount: number; onNavigate: (screen: Screen) => void; onLanguage: () => void; language: Language; aiMode: AiMode; onNotify: (message: string) => void; online?: boolean; onDelete?: () => void; hasUnsavedDraft?: boolean }) {
  const navItems = [{ id: 'home' as Screen, label: 'Home', icon: 'home' as IconName }, { id: 'explore' as Screen, label: 'Explore', icon: 'layers' as IconName }, { id: 'groups' as Screen, label: 'Groups', icon: 'users' as IconName }, { id: 'profile' as Screen, label: 'Profile', icon: 'person' as IconName }, { id: 'settings' as Screen, label: 'Settings', icon: 'settings' as IconName }]
  const update = useServiceWorkerUpdate()
  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><Logo /></div><div className="sidebar-section-label">YOUR SPACE</div><nav className="sidebar-nav" aria-label="Primary navigation">{navItems.map(item => <button type="button" key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.id === 'profile' && historyCount > 0 && <span className="nav-count">{historyCount}</span>}</button>)}</nav><div className="sidebar-section-label sidebar-modes-label">PLAY MODES</div><button type="button" className="nav-item" onClick={() => onNavigate('home')}><span className="mode-dot dot-coral" /><span>Classic</span></button><button type="button" className="nav-item" onClick={() => onNavigate('home')}><span className="mode-dot dot-lavender" /><span>SideSwitch</span><Tag tone="new">NEW</Tag></button><button type="button" className="nav-item" onClick={() => onNavigate('clash')}><span className="mode-dot dot-yellow" /><span>Friend Clash</span></button><button type="button" className="nav-item" onClick={() => onNavigate('team')}><span className="mode-dot dot-mint" /><span>Team Debate</span><Tag tone="new">NEW</Tag></button><div className="sidebar-spacer" /><div className="streak-card"><div className="streak-top"><span className="streak-icon"><Icon name="flame" size={16} /></span><span>{historyCount ? 'Keep your streak going' : 'Start your streak'}</span></div><p>Complete a debate or valid challenge response to count a day.</p></div><button type="button" className="profile-mini" onClick={() => onNavigate('profile')}><span className="avatar avatar-coral">{name.slice(0, 1).toUpperCase()}</span><span className="profile-mini-copy"><strong>{name || 'Your profile'}</strong><small>Private by default</small></span><Icon name="chevron" size={15} /></button></aside><div className="main-column"><TopBar onLanguage={onLanguage} language={language} aiMode={aiMode} onProfile={() => onNavigate('profile')} onNotify={onNotify} /><InstallControl onNotify={onNotify} /><OfflineBanner online={online ?? true} /><BetaNotice aiMode={aiMode} />{update.available && <div className="update-banner" role="status"><span>SideShift has a fresh build ready.</span><button type="button" className="text-link" onClick={() => { if (hasUnsavedDraft) onNotify('Finish or save your draft before updating.'); else update.apply() }}>Update when ready</button></div>}<main className="main-content">{children}</main><nav className="mobile-nav" aria-label="Primary navigation">{navItems.map(item => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.label}</span></button>)}</nav><footer className="app-footer"><a href="/privacy">Privacy</a><a href="/terms">Beta Terms</a><a href="/community">Community Rules</a>{onDelete && <button type="button" className="delete-data-button" onClick={onDelete}>Delete my beta data</button>}</footer></div></div>
}

function Home({ userName, language, interests, history, onBegin, onExplore, onClash, onNotify }: { userName: string; language: Language; interests: string[]; history: ResultData[]; onBegin: BeginHandler; onExplore: () => void; onClash: () => void; onNotify: (message: string) => void }) {
  const firstName = userName.split(' ')[0] || 'there'
  const personalized = personalizeTakes(interests)
  const worldTake = takes.find(take => take.id === 'society-media-age') || takes[0]
  const worldText = takeText(worldTake, language)
  return <div className="page home-page"><div className="page-heading home-heading"><div><span className="eyebrow">YOUR DAILY SHIFT</span><h1>Good morning, {firstName}<span className="heading-period">.</span></h1><p className="muted">Can you convincingly defend the side you disagree with?</p></div><div className="heading-actions"><button type="button" className="circle-action" aria-label="Search takes" onClick={onExplore}><Icon name="search" size={18} /></button><Button variant="secondary" icon="plus" onClick={onClash}>Challenge a friend</Button></div></div><section className="home-grid"><article className="world-card card-surface"><div className="world-card-main"><div className="card-topline"><Tag tone="dark">WORLD TAKE</Tag><span className="card-date"><Icon name="calendar" size={14} /> TODAY</span></div><div className="world-number">01</div><h2>{worldText.statement}</h2><p>{worldText.context}</p><div className="world-bottom"><div className="reaction-dots"><span className="dot-pink" /><span className="dot-purple" /><span className="dot-yellow" /><span className="dot-blue" /><small>Five minutes · private stance</small></div><Button variant="dark" icon="arrow" onClick={() => onBegin('sideswitch', worldTake)}>Take a side</Button></div></div><div className="world-card-art"><span className="art-label">TODAY'S<br />QUESTION</span><div className="art-orbit art-orbit-a" /><div className="art-orbit art-orbit-b" /><div className="art-word">MOVE<br /><em>A</em><br />MIND</div></div></article><aside className="signal-card card-surface"><div className="card-topline"><Tag tone="yellow">DAILY SIGNAL</Tag><button type="button" className="more-button" aria-label="Daily signal details" onClick={() => onNotify('The room stays broad and anonymous in this beta.') }><Icon name="more" size={18} /></button></div><div className="signal-visual"><div className="signal-ring"><span>52<span>%</span></span><small>agree</small></div><div className="signal-bars"><i style={{ height: '26%' }} /><i style={{ height: '42%' }} /><i style={{ height: '58%' }} /><i style={{ height: '82%' }} /><i style={{ height: '68%' }} /><i style={{ height: '91%' }} /><i style={{ height: '72%' }} /></div></div><h3>A split room</h3><p>Most people are undecided. That’s where the interesting conversations start.</p><button type="button" className="text-link" onClick={onExplore}>See the room <Icon name="arrow" size={15} /></button></aside></section><section className="section-block"><div className="section-heading"><div><span className="eyebrow">PICK YOUR NEXT</span><h2>Your take</h2></div><button type="button" className="text-link" onClick={onExplore}>View all <Icon name="arrow" size={15} /></button></div><div className="take-row">{personalized.slice(0, 3).map((take, index) => <TakeCard key={take.id} take={take} onBegin={onBegin} featured={index === 0} language={language} />)}</div></section><section className="section-block lower-section"><div className="section-heading"><div><span className="eyebrow">KEEP MOVING</span><h2>Recent shifts</h2></div><button type="button" className="text-link" onClick={onExplore}>View library <Icon name="arrow" size={15} /></button></div>{history.length ? <div className="recent-grid">{history.slice(0, 2).map(result => <RecentShift key={result.id} result={result} language={language} />)}<div className="mini-stats"><div><span className="mini-stat-icon mint"><Icon name="arrowUp" size={17} /></span><strong>{history[0]?.movement > 0 ? `+${history[0].movement}` : history[0]?.movement || '0'}</strong><small>latest perspective<br />movement</small></div><div><span className="mini-stat-icon yellow"><Icon name="target" size={17} /></span><strong>{history[0]?.score}%</strong><small>latest argument<br />score</small></div></div></div> : <div className="empty-state card-surface"><Icon name="spark" size={20} /><strong>Your first shift is waiting.</strong><span>Complete a debate and your private history will appear here.</span></div>}</section></div>
}

function TakeCard({ take, onBegin, onChooseDebate, featured = false, language }: { take: Take; onBegin: BeginHandler; onChooseDebate?: (take: Take) => void; featured?: boolean; language: Language }) {
  const text = takeText(take, language)
  const symbol = take.category === 'Football' ? '◉' : take.category.includes('Gaming') ? '◈' : '✦'
  return <article className={`take-card card-surface ${featured ? 'featured' : ''}`}><div className={`take-card-color color-${take.color}`}><span className="take-card-symbol">{symbol}</span><span className="take-card-index">{String(takes.findIndex(item => item.id === take.id) + 1).padStart(2, '0')}</span></div><div className="take-card-body"><div className="take-card-meta"><Tag tone={take.categoryClass.replace('category-', '')}>{text.category}</Tag><span><Icon name="clock" size={13} /> {take.time}</span></div><h3>{text.statement}</h3><div className="take-card-foot"><span className="difficulty"><i className={`difficulty-dot difficulty-${take.difficulty.toLowerCase()}`} /> {take.difficulty}</span><button type="button" className="round-arrow" aria-label={`Start ${text.statement}`} onClick={() => onChooseDebate ? onChooseDebate(take) : onBegin('classic', take)}><Icon name="arrow" size={15} /></button></div></div></article>
}

function DebateTypeChoice({ take, language, onBack, onAi, onPerson }: { take: Take; language: Language; onBack: () => void; onAi: () => void; onPerson: () => void }) {
  const text = takeText(take, language)
  return <div className="page debate-choice-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> Back</button><div className="page-heading"><div><span className="eyebrow">CHOOSE YOUR OPPONENT</span><h1>How do you want<br /><em>to debate?</em></h1><p className="muted">Start with “{text.statement}” and choose the kind of conversation you want.</p></div><Tag tone="coral">{text.category}</Tag></div><div className="debate-choice-grid"><button type="button" className="debate-choice-card debate-choice-ai" onClick={onAi}><span className="debate-choice-icon"><Icon name="spark" size={22} /></span><span className="eyebrow">AI OPPONENT</span><h2>Debate AI</h2><p>Choose an AI opponent, difficulty and debate length.</p><span className="debate-choice-action">Choose AI <Icon name="arrow" size={15} /></span></button><button type="button" className="debate-choice-card debate-choice-person" onClick={onPerson}><span className="debate-choice-icon"><Icon name="users" size={22} /></span><span className="eyebrow">HUMAN CHALLENGE</span><h2>Challenge a person</h2><p>Challenge another person and compare your arguments.</p><span className="debate-choice-action">Challenge someone <Icon name="arrow" size={15} /></span></button></div><p className="debate-choice-note"><Icon name="lock" size={14} /> Your choice is private. Person mode uses a secure challenge link; it is not live matchmaking.</p></div>
}

function DebateTypeChoiceExpanded({ take, language, onBack, onAi, onPerson, onTeam }: { take: Take; language: Language; onBack: () => void; onAi: () => void; onPerson: () => void; onTeam: () => void }) {
  const text = takeText(take, language)
  const modes = [
    { key: 'ai', label: 'Debate AI', eyebrow: 'AI OPPONENT', description: 'Choose an AI opponent, difficulty and debate length.', action: 'Choose AI', icon: 'spark' as IconName, onClick: onAi },
    { key: 'person', label: 'Challenge a person', eyebrow: 'HUMAN CHALLENGE', description: 'Challenge another person and compare your arguments.', action: 'Challenge someone', icon: 'users' as IconName, onClick: onPerson },
    { key: 'team', label: 'Team Debate', eyebrow: 'SHARED DEVICE', description: 'Set up 2–4 teams, turns and a facilitator-led room.', action: 'Set up teams', icon: 'users' as IconName, onClick: onTeam },
  ]
  return <div className="page debate-choice-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> Back</button><div className="page-heading"><div><span className="eyebrow">CHOOSE YOUR DEBATE MODE</span><h1>How do you want<br /><em>to debate?</em></h1><p className="muted">Start with &quot;{text.statement}&quot; and choose the kind of conversation you want.</p></div><Tag tone="coral">{text.category}</Tag></div><div className="debate-choice-grid debate-choice-grid-three">{modes.map(mode => <button type="button" className={`debate-choice-card debate-choice-${mode.key}`} onClick={mode.onClick} key={mode.key}><span className="debate-choice-icon"><Icon name={mode.icon} size={22} /></span><span className="eyebrow">{mode.eyebrow}</span><h2>{mode.label}</h2><p>{mode.description}</p><span className="debate-choice-action">{mode.action} <Icon name="arrow" size={15} /></span></button>)}</div><p className="debate-choice-note"><Icon name="lock" size={14} /> Your choice is private. Team Debate stays on the facilitator&apos;s device.</p></div>
}

function RecentShift({ result, language }: { result: ResultData; language: Language }) {
  const text = takeText(result.take, language)
  return <article className="recent-card card-surface"><span className="recent-icon lavender"><Icon name="spark" size={18} /></span><div><h3>{text.statement}</h3><p>{result.mode} · {new Date(result.completedAt).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-GB')}</p></div><strong>{result.score}<small>/100</small></strong><Icon name="chevron" size={17} /></article>
}

function Explore({ language, onBegin, onNotify }: { language: Language; onBegin: BeginHandler; onNotify: (message: string) => void }) {
  const [filter, setFilter] = useState('All takes')
  const filters = ['All takes', 'Gaming & internet', 'Football', 'Society & technology', 'Everyday life & relationships', 'Wildcard']
  const filtered = filter === 'All takes' ? takes : takes.filter(take => take.category === filter)
  return <div className="page explore-page"><div className="page-heading"><div><span className="eyebrow">THE TAKE LIBRARY</span><h1>Find your next<br /><em>good disagreement.</em></h1><p className="muted">Curated prompts with two defensible sides. No hot takes required.</p></div><div className="explore-count"><strong>{takes.length}</strong><span>balanced<br />takes</span></div></div><div className="filter-row">{filters.map(item => <button type="button" key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{item}</button>)}<button type="button" className="filter-filter" onClick={() => onNotify('Filters are curated by category in this beta.') }><Icon name="settings" size={15} /> More filters</button></div><div className="explore-grid">{filtered.map(take => <TakeCard key={take.id} take={take} onBegin={onBegin} featured={take.id === 'society-media-age'} language={language} />)}<article className="suggest-card"><span className="suggest-spark"><Icon name="spark" size={20} /></span><h3>Have a take<br />of your own?</h3><p>Public takes are not open yet. For now, challenge someone you know.</p><Button variant="secondary" icon="link" onClick={() => onNotify('Open Friend Clash to send a private challenge.')}>Create a challenge</Button></article></div></div>
}

function ModeCard({ mode, title, description, icon, accent, selected, badge, onClick }: { mode: Mode; title: string; description: string; icon: IconName; accent: string; selected: boolean; badge?: string; onClick: () => void }) {
  return <button type="button" className={`mode-card ${selected ? 'selected' : ''} accent-${accent}`} aria-pressed={selected} onClick={onClick}><span className="mode-icon"><Icon name={icon} size={21} /></span><span className="mode-copy"><strong>{title}</strong><small>{description}</small></span>{badge && <Tag tone="new">{badge}</Tag>}<span className="mode-check">{selected && <Icon name="check" size={14} />}</span></button>
}

function Debate({ activeTake, language, mode, step, setStep, stance, setStance, confidence, setConfidence, postStance, setPostStance, understanding, setUnderstanding, responses, setResponses, opponentMessages, setOpponentMessages, onModeChange, onComplete, onExit, onNotify, onReport, onPersistRound, aiMode, online }: { activeTake: Take; language: Language; mode: Mode; step: number; setStep: (step: number) => void; stance: Stance; setStance: (stance: Stance) => void; confidence: number; setConfidence: (value: number) => void; postStance: Stance; setPostStance: (stance: Stance) => void; understanding: string; setUnderstanding: (value: string) => void; responses: Record<number, string>; setResponses: React.Dispatch<React.SetStateAction<Record<number, string>>>; opponentMessages: Record<number, string>; setOpponentMessages: React.Dispatch<React.SetStateAction<Record<number, string>>>; onModeChange: (mode: Mode) => void; onComplete: () => Promise<void>; onExit: () => void; onNotify: (message: string) => void; onReport: (payload: ReportInput) => Promise<void>; onPersistRound?: (nextStep: number, response: string | null, opponentMessage: string) => Promise<void>; aiMode: AiMode; online?: boolean }) {
  const [modeChoice, setModeChoice] = useState(mode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  const takeTextValue = takeText(activeTake, language)
  const assignedSide = assignSide(stance, modeChoice, activeTake)
  const currentResponse = responses[step] || ''
  const previousOpponent = opponentMessages[step - 1] || ''
  const stage = step === 0 ? 'stance' : step === 6 ? 'post' : 'argument'
  const draftKey = `debate:${activeTake.id}:${modeChoice}:${step}`
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
    if (stage === 'argument' && currentResponse.trim() && !window.confirm('You have an unsent argument. Leave it saved and return later?')) return
    onExit()
  }
  async function advanceFromStance() {
    try { await onPersistRound?.(1, null, '') } catch { onNotify('The debate advanced locally; reconnect before refreshing to confirm the saved state.') }
    setStep(1)
  }
  async function saveResponse() {
    if (!isOnline) return setError('You are offline. Reconnect before sending the next round.')
    if (currentResponse.trim().length < 12 || busy) return
    const trimmed = currentResponse.trim()
    setBusy(true)
    setError('')
    setResponses(current => ({ ...current, [step]: trimmed }))
    trackEvent('debate_round_submitted', { round: step })
    const persistAdvance = async (nextStep: number, opponentMessage: string) => {
      try { await onPersistRound?.(nextStep, trimmed, opponentMessage) } catch { onNotify('The round was advanced locally; reconnect before refreshing to confirm the saved state.') }
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
      const opponentMessage = output.response + '\n\nQuestion: ' + output.question
      setOpponentMessages(current => ({ ...current, [step]: opponentMessage }))
      clearArgumentDraft(draftKey)
      await persistAdvance(step + 1, opponentMessage)
      setStep(step + 1)
    } catch {
      const fallback = createMockOpponent(activeTake, assignedSide, step, trimmed, language)
      const opponentMessage = fallback.response + '\n\nQuestion: ' + fallback.question
      setOpponentMessages(current => ({ ...current, [step]: opponentMessage }))
      clearArgumentDraft(draftKey)
      await persistAdvance(step + 1, opponentMessage)
      setStep(step + 1)
      onNotify('The AI service was unavailable, so development mock mode supplied a clearly labelled fallback.')
    } finally {
      setBusy(false)
    }
  }  async function complete() {
    if (!isOnline) return setError('You are offline. Reconnect before requesting a result.')
    if (busy) return
    setBusy(true)
    setError('')
    try { await onComplete() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Scoring failed. Try again.'); setBusy(false) }
  }
  async function reportIssue() {
    const reason = window.prompt('Report reason: harassment, hate, spam, privacy, or other', 'other')?.trim()
    if (!reason) return
    const details = window.prompt('Optional details (leave blank to skip):', '')?.trim() || null
    try { await onReport({ debateId: null, challengeId: null, reportedContentType: 'debate', reason, details }); onNotify('Report submitted and recorded for beta review.') } catch (caught) { onNotify(caught instanceof Error ? caught.message : 'Report could not be submitted. Try again.') }
  }
  return <div className="debate-page"><div className="debate-top"><button type="button" className="back-button" onClick={exitWithProtection}><Icon name="close" size={18} /> Exit debate</button><div className="debate-progress"><span>ROUND {Math.min(step + 1, 7)} OF 7</span><div className="progress-track"><i style={{ width: `${(step / 6) * 100}%` }} /></div></div><button type="button" className="report-button" onClick={() => void reportIssue()}><Icon name="shield" size={15} /> Report</button></div><div className="debate-layout"><aside className="debate-sidebar"><div className="debate-take-label"><Tag tone="dark">{modeChoice === 'sideswitch' ? 'SIDESWITCH' : modeChoice === 'blindside' ? 'BLINDSIDE' : 'CLASSIC'}</Tag><span><Icon name="clock" size={13} /> {activeTake.time}</span></div><h2>{takeTextValue.statement}</h2><div className="assignment-card"><span className="assignment-lock"><Icon name="lock" size={14} /></span><small>YOUR ASSIGNED SIDE</small><strong>{step === 0 ? 'Hidden until you commit' : assignedSide}</strong>{step === 0 ? <span className="assignment-hidden">Private first. Then we flip the script.</span> : <span className="assignment-note"><Icon name="spark" size={13} /> {modeChoice === 'sideswitch' ? 'You’re defending the opposite side' : 'You chose this side'}</span>}</div><div className="stage-list">{stageNames.map((name, index) => <div className={`stage-item ${index === step ? 'current' : ''} ${index < step ? 'completed' : ''}`} key={name}><span className="stage-marker">{index < step ? <Icon name="check" size={12} /> : index + 1}</span><span>{name}</span>{index === step && <i />}</div>)}</div><div className="debate-safety"><Icon name="shield" size={15} /><span>Structured, respectful debate.<br />{aiMode === 'mock' ? 'Development mock AI is active.' : 'Runtime: ' + aiRuntimeLabel(aiMode) + '.'}</span></div></aside><section className="debate-main">{stage === 'stance' && <StanceStage take={activeTake} language={language} mode={modeChoice} setMode={value => { setModeChoice(value); onModeChange(value) }} stance={stance} setStance={setStance} confidence={confidence} setConfidence={setConfidence} onContinue={() => void advanceFromStance()} />}{stage === 'argument' && <ArgumentStage step={step} message={previousOpponent} response={currentResponse} setResponse={value => setResponses(current => ({ ...current, [step]: value }))} busy={busy} error={error} onContinue={saveResponse} />}{stage === 'post' && <PostStage stance={stance} confidence={confidence} postStance={postStance} setPostStance={setPostStance} understanding={understanding} setUnderstanding={setUnderstanding} busy={busy} error={error} onComplete={complete} />}</section></div></div>
}

function StanceStage({ take, language, mode, setMode, stance, setStance, confidence, setConfidence, onContinue }: { take: Take; language: Language; mode: Mode; setMode: (mode: Mode) => void; stance: Stance; setStance: (stance: Stance) => void; confidence: number; setConfidence: (value: number) => void; onContinue: () => void }) {
  const labels = language === 'de' ? ['Stimme gar nicht zu', 'Stimme nicht zu', 'Unsicher', 'Stimme zu', 'Stimme voll zu'] : ['Strongly disagree', 'Disagree', 'Unsure', 'Agree', 'Strongly agree']
  const text = takeText(take, language)
  return <div className="stage-panel"><div className="stage-kicker"><span className="stage-number">01</span><span>BEFORE WE BEGIN</span></div><h1>Where do you actually<br /><em>stand?</em></h1><p className="stage-intro">This is private. We’ll use it to see if the conversation moved you — not to decide who is right.</p><div className="private-note"><Icon name="lock" size={16} /><span><strong>Your starting stance stays private</strong><small>Only you will see this until the result.</small></span></div><div className="stance-prompt"><span className="eyebrow">THE TAKE</span><h2>{text.statement}</h2></div><div className="stance-scale">{labels.map((label, index) => { const value = (index - 2) as Stance; return <button type="button" key={label} className={`stance-option stance-${index} ${stance === value ? 'selected' : ''}`} aria-pressed={stance === value} onClick={() => setStance(value)}><span className="stance-dot" /><span>{label}</span></button> })}</div><div className="confidence-row"><span>How confident are you?</span><div className="confidence-options">{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} className={confidence === value ? 'selected' : ''} aria-pressed={confidence === value} onClick={() => setConfidence(value)}>{value}</button>)}</div><span className="confidence-label">{confidence <= 2 ? 'Open-minded' : confidence === 3 ? 'On the fence' : 'Pretty sure'}</span></div><div className="mode-select"><span className="eyebrow">CHOOSE YOUR MODE</span><ModeCard mode="classic" title="Classic" description="Defend what you believe" icon="sun" accent="coral" selected={mode === 'classic'} onClick={() => setMode('classic')} /><ModeCard mode="sideswitch" title="SideSwitch" description="Defend the opposite side" icon="spark" accent="lavender" selected={mode === 'sideswitch'} badge="SIGNATURE" onClick={() => setMode('sideswitch')} /><ModeCard mode="blindside" title="Blindside" description="No prep. Find your footing." icon="bolt" accent="yellow" selected={mode === 'blindside'} onClick={() => setMode('blindside')} /></div><Button className="stage-continue" icon="arrow" onClick={onContinue}>Lock in my stance</Button></div>
}

function ArgumentStage({ step, message, response, setResponse, busy, error, onContinue }: { step: number; message: string; response: string; setResponse: (value: string) => void; busy: boolean; error: string; onContinue: () => void }) {
  const stageInfo: Record<number, { kicker: string; title: string; prompt: string; placeholder: string; limit: number }> = { 1: { kicker: 'MAKE YOUR CASE', title: 'Your strongest opening.', prompt: 'What is the clearest reason someone should see this your way?', placeholder: 'Start with the point you’d want someone to remember…', limit: 350 }, 2: { kicker: 'GO DEEPER', title: 'Rebut, don’t repeat.', prompt: 'Respond directly to the strongest point your opponent made.', placeholder: 'They said… but the part that misses is…', limit: 350 }, 3: { kicker: 'PRESSURE TEST', title: 'Answer the hard question.', prompt: 'What evidence or experience would change your mind?', placeholder: 'Be honest. A strong answer can still have a boundary…', limit: 280 }, 4: { kicker: 'STEELMAN', title: 'Show you get it.', prompt: 'State the strongest reasonable version of your opponent’s position.', placeholder: 'The best case for the other side is…', limit: 220 }, 5: { kicker: 'ONE LAST THOUGHT', title: 'Make it count.', prompt: 'Give the single strongest reason your side should prevail.', placeholder: 'If there is one thing to take away, it’s this…', limit: 220 } }
  const info = stageInfo[step]
  return <div className="stage-panel argument-panel"><div className="stage-kicker"><span className="stage-number">0{step + 1}</span><span>{info.kicker}</span></div><div className="argument-heading"><div><h1>{info.title}</h1><p className="stage-intro">{info.prompt}</p></div><div className="turn-badge"><span className="ai-pulse" /> {busy ? 'AI thinking' : step === 3 ? 'AI asks' : 'Your turn'}</div></div><div className="opponent-message"><div className="message-avatar"><span>AI</span><i /></div><div><div className="message-meta"><strong>{message ? 'Sharp Skeptic' : 'Your opening'}</strong><span>{message ? 'just now' : 'waiting for your first move'}</span></div><p>{message || 'Your opponent will respond to the argument you submit. No generic prompt is scored as a reply.'}</p>{message && <button type="button" className="message-more" onClick={() => window.alert('The response is generated from your latest argument and the selected side.')}>Why this response? <Icon name="help" size={13} /></button>}</div></div><div className="response-box"><div className="response-box-top"><span className="eyebrow">{step === 4 ? 'YOUR STEELMAN' : step === 3 ? 'YOUR RESPONSE' : 'YOUR ARGUMENT'}</span><span className={response.length >= info.limit ? 'counter over' : 'counter'}>{response.length} / {info.limit}</span></div><textarea aria-label={info.title} autoFocus value={response} onChange={event => setResponse(event.target.value.slice(0, info.limit))} placeholder={info.placeholder} disabled={busy} /><div className="response-box-bottom"><span><Icon name="info" size={14} /> Keep it specific and respectful.</span><Button icon="arrow" onClick={onContinue} disabled={response.trim().length < 12 || busy}>{busy ? 'Thinking…' : step === 5 ? 'See my shift' : 'Send response'}</Button></div>{error && <p className="form-error" role="alert">{error}</p>}</div><div className="argument-footer"><span><Icon name="lock" size={13} /> Only your opponent sees this</span><span>Character limits prevent duplicate effort</span></div></div>
}

function PostStage({ stance, confidence, postStance, setPostStance, understanding, setUnderstanding, busy, error, onComplete }: { stance: Stance; confidence: number; postStance: Stance; setPostStance: (value: Stance) => void; understanding: string; setUnderstanding: (value: string) => void; busy: boolean; error: string; onComplete: () => void }) {
  const labels = ['Strongly disagree', 'Disagree', 'Unsure', 'Agree', 'Strongly agree']
  const moved = movementBetween(stance, postStance)
  return <div className="stage-panel post-panel"><div className="stage-kicker"><span className="stage-number">07</span><span>THE MOMENT OF TRUTH</span></div><h1>Did anything<br /><em>shift?</em></h1><p className="stage-intro">No pressure to change your mind. Better understanding counts too.</p><div className="post-compare"><div><span className="eyebrow">BEFORE</span><strong>{labels[stance + 2]}</strong><small>Confidence {confidence} / 5</small></div><span className="compare-arrow"><Icon name="arrow" size={18} /></span><div className="post-value"><span className="eyebrow">AFTER</span><strong>{labels[postStance + 2]}</strong><small>{moved === 0 ? 'Same place, new context' : `${Math.abs(moved)} step${Math.abs(moved) > 1 ? 's' : ''} moved`}</small></div></div><div className="post-stance"><span className="eyebrow">YOUR POSITION NOW</span><div className="stance-scale post-scale">{labels.map((label, index) => { const value = (index - 2) as Stance; return <button type="button" key={label} className={`stance-option stance-${index} ${postStance === value ? 'selected' : ''}`} aria-pressed={postStance === value} onClick={() => setPostStance(value)}><span className="stance-dot" /><span>{label}</span></button> })}</div></div><div className="understanding"><span className="eyebrow">DO YOU UNDERSTAND THE OTHER SIDE BETTER?</span><div className="understanding-options"><button type="button" className={understanding === 'yes' ? 'selected' : ''} onClick={() => setUnderstanding('yes')}><Icon name="check" size={15} /> Definitely</button><button type="button" className={understanding === 'maybe' ? 'selected' : ''} onClick={() => setUnderstanding('maybe')}><Icon name="more" size={15} /> A little</button><button type="button" className={understanding === 'no' ? 'selected' : ''} onClick={() => setUnderstanding('no')}><Icon name="x" size={15} /> Not yet</button></div></div>{error && <p className="form-error" role="alert">{error}</p>}<Button className="stage-continue" icon="spark" onClick={onComplete} disabled={busy}>{busy ? 'Scoring…' : 'Show me the result'}</Button></div>
}

function Results({ result, language, onBegin, onClash, onNotify }: { result: ResultData; language: Language; onBegin: BeginHandler; onClash: () => void; onNotify: (message: string) => void }) {
  const text = takeText(result.take, language)
  const move = movementLabel(result.movement)
  const [shareBusy, setShareBusy] = useState(false)
  useEffect(() => { trackEvent('result_viewed', { score: result.score, movement: result.movement }) }, [result.id, result.movement, result.score])
  async function shareResult() {
    if (shareBusy) return
    setShareBusy(true)
    window.setTimeout(() => setShareBusy(false), 2000)
    trackEvent('share_attempted', { surface: 'result' })
    const shareData = { title: 'My SideShift result', text: `I scored ${result.score}/100 defending a different side on SideShift. Can you move a mind?` }
    try { if (await shareWithNative(shareData)) return } catch { /* fall through to web share */ }
    try { if (await shareCardFile(result, language)) return } catch { /* fall through to text share */ }
    if (navigator.share) { try { await navigator.share(shareData); return } catch { return } }
    try { await downloadShareCard(result, language); onNotify('Shift card downloaded.'); return } catch { /* use caption fallback */ }
    onNotify(await copyText(shareData.text) ? 'Caption copied — the share sheet is unavailable in this browser.' : 'Sharing is unavailable in this browser.')
  }
  async function copyCaption() { onNotify(await copyText(`I just defended a different side on SideShift and scored ${result.score}/100. Can you move a mind?`) ? 'Caption copied.' : 'Clipboard access is unavailable.') }
  return <div className="page results-page"><div className="results-intro"><div><button type="button" className="back-link" onClick={() => onBegin('classic', result.take)}><Icon name="arrow" size={15} /> Do another take</button><span className="eyebrow">DEBATE COMPLETE · {result.mode.toUpperCase()}</span><h1>That was a <em>good one.</em></h1><p className="muted">You defended “{result.assignedSide}”. Here’s what moved — and what stayed yours.</p></div><div className="result-score-hero"><span>ARGUMENT<br />SCORE</span><strong>{result.score}</strong><small>/ 100</small><div className="score-orbit" /></div></div><section className="result-grid"><div className="score-breakdown card-surface"><div className="card-topline"><div><span className="eyebrow">HOW YOU ARGUED</span><h2>The good stuff, broken down.</h2></div><Tag tone="mint"><Icon name="spark" size={13} /> AI evaluation</Tag></div>{result.scores.map(item => <div className="score-row" key={item.label}><div className="score-label"><strong>{item.label}</strong><span>{item.explanation}</span></div><div className="score-bar"><i style={{ width: `${(item.score / 20) * 100}%` }} /></div><b>{item.score}<small>/20</small></b></div>)}<p className="ai-disclaimer"><Icon name="info" size={14} /> Argument technique, not a judgement that one belief is correct. Scores are bounded and explainable.</p></div><div className="movement-card card-surface"><div className="card-topline"><span className="eyebrow">PERSPECTIVE MOVEMENT</span><span className="movement-icon"><Icon name="arrowUp" size={16} /></span></div><h2>{Math.abs(result.movement)} step{Math.abs(result.movement) === 1 ? '' : 's'}<br /><em>{move}.</em></h2><div className="movement-line"><span>DISAGREE</span><div><i /><b style={{ left: `${((result.movement + 2) / 4) * 100}%` }} /></div><span>AGREE</span></div><p>{result.movement === 0 ? 'Staying put is useful data too. You can understand a position without adopting it.' : 'A shift is not the only win. Understanding the other side is the part worth keeping.'}</p><Tag tone="lavender"><Icon name="check" size={13} /> {result.understanding === 'yes' ? 'Understanding victory' : 'Reflection recorded'}</Tag></div></section><section className="result-lower"><div className="shift-card-wrap"><div className="section-heading"><div><span className="eyebrow">YOUR SHAREABLE RESULT</span><h2>The Shift Card</h2></div><button type="button" className="text-link" aria-label="Share card details" onClick={() => onNotify('The share card is private until you share or copy it.') }><Icon name="more" size={17} /></button></div><ShiftCard result={result} language={language} /><div className="share-actions"><Button variant="dark" icon="share" onClick={shareResult}>Share result</Button><Button variant="secondary" icon="copy" onClick={copyCaption}>Copy caption</Button></div></div><aside className="next-move"><span className="eyebrow">WHAT NEXT?</span><h3>Keep the<br /><em>conversation</em><br />moving.</h3><button type="button" onClick={onClash} className="next-move-link"><span className="next-move-icon"><Icon name="link" size={18} /></span><span><strong>Challenge a friend</strong><small>Send this take to someone who’ll disagree.</small></span><Icon name="arrow" size={16} /></button><button type="button" onClick={() => onBegin('sideswitch', result.take)} className="next-move-link"><span className="next-move-icon lavender"><Icon name="spark" size={18} /></span><span><strong>Try the opposite side</strong><small>Run it back with a new angle.</small></span><Icon name="arrow" size={16} /></button></aside></section></div>
}

function ShiftCard({ result, language }: { result: ResultData; language: Language }) {
  const text = takeText(result.take, language)
  return <div className="shift-card"><div className="shift-card-header"><Logo compact /><span><Icon name="spark" size={14} /> MY SHIFT</span></div><div className="shift-card-statement">“{text.statement}”</div><div className="shift-card-divider" /><div className="shift-card-data"><div><small>MODE</small><strong>{result.mode.toUpperCase()}</strong></div><div><small>ARGUMENT SCORE</small><strong>{result.score}<i>/100</i></strong></div><div><small>THE TAKEAWAY</small><strong>{result.understanding === 'yes' ? 'UNDERSTANDING IS A WIN' : 'REFLECTION IS A WIN'}</strong></div></div><div className="shift-card-footer"><span>CAN YOU MOVE A MIND?</span><span>SIDESHIFT</span></div></div>
}

type CreatedChallenge = { id: string; token: string | null; url: string | null; expiresAt: string; take: Take; argument: string; status: 'open' | 'completed' | 'expired' | 'revoked'; response: string | null; result: { total: number } | null }

function FriendClash({ userId, language, repository, onBack, onBegin, onNotify, online, initialTake }: { userId: string; language: Language; repository: AppRepository; onBack: () => void; onBegin: BeginHandler; onNotify: (message: string) => void; online?: boolean; initialTake?: Take }) {
  const [argument, setArgument] = useState('')
  const [created, setCreated] = useState<CreatedChallenge | null>(null)
  const [copied, setCopied] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState('')
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  const challengeTake = initialTake || takes.find(take => take.id === 'society-media-age') || takes[0]
  useEffect(() => { let active = true; repository.listChallenges(userId).then(items => { const item = items[0]; if (!active || !item) return; setCreated({ ...item, token: null, url: null, take: getTake(item.takeId) }); setResponse(item.response) }).catch(() => undefined); return () => { active = false } }, [repository, userId])
  useEffect(() => { if (!created) return; let active = true; const check = async () => { try { const current = created.token ? await repository.loadChallenge(created.token) : (await repository.listChallenges(userId)).find(item => item.id === created.id); if (!active || !current) return; setResponse(current.response); setCreated(previous => previous ? { ...previous, status: current.status, response: current.response, result: current.result } : previous) } catch { /* polling is best effort */ } }; void check(); const timer = window.setInterval(check, 5000); return () => { active = false; window.clearInterval(timer) } }, [created?.id, created?.token, repository, userId])
  async function createChallenge() { if (!isOnline) return setError('You are offline. Reconnect before creating a challenge.'); if (argument.trim().length < 12) return; setError(''); try { const output = await repository.createChallenge(userId, { takeId: challengeTake.id, argument: argument.trim(), mode: 'classic', creatorSide: challengeTake.supportLabel }); setCreated({ ...output, take: challengeTake }); setResponse(null); trackEvent('challenge_created', { mode: 'classic' }) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Challenge creation failed.') } }
  async function shareChallenge() { if (!created?.token || !created.url) return onNotify('The secure link is only available in the browser that created it. Create a new challenge to share again.'); const url = appUrl(created.url); trackEvent('share_attempted', { surface: 'challenge' }); if (navigator.share) { try { await navigator.share({ title: 'Take my SideShift challenge', text: 'Take my SideShift challenge and send your strongest counterpoint.', url }); return } catch { return } } onNotify(await copyText(url) ? 'Challenge link copied.' : 'Clipboard access is unavailable.') }
  const url = created?.token && created.url ? appUrl(created.url) : ''
  return <div className="page clash-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> Back to today</button>{!created ? <div className="clash-layout"><div className="clash-copy"><Tag tone="yellow">FRIEND CLASH</Tag><h1>Make your<br /><em>case.</em></h1><p className="stage-intro">Pick a take, write one argument, and send a secure seven-day link to the person most likely to disagree.</p><div className="clash-steps"><div><span>01</span><strong>You open</strong><small>Choose your side and make your point.</small></div><div><span>02</span><strong>They counter</strong><small>Your friend responds once without an account.</small></div><div><span>03</span><strong>Get the read</strong><small>Both browsers can retrieve the completed challenge.</small></div></div></div><div className="clash-form card-surface"><div className="card-topline"><span className="eyebrow">CHOOSE A TAKE</span><Tag tone="mint"><Icon name="lock" size={12} /> Secure link</Tag></div><button type="button" className="clash-take-picker" onClick={() => onBegin('classic', challengeTake)}><span className="take-picker-icon coral">✦</span><span><small>WORLD TAKE · SOCIETY & TECH</small><strong>{challengeTake.statement}</strong></span><Icon name="chevron" size={17} /></button><div className="clash-form-divider" /><label className="field-label" htmlFor="clash-argument">Your opening argument</label><textarea id="clash-argument" className="clash-textarea" value={argument} onChange={event => setArgument(event.target.value.slice(0, 350))} placeholder="The strongest reason I think this is…" /><div className="response-box-bottom"><span className="counter">{argument.length} / 350</span><Button icon="link" onClick={createChallenge} disabled={argument.trim().length < 12}>Create challenge</Button></div>{error && <p className="form-error" role="alert">{error}</p>}<p className="onboarding-footnote"><Icon name="shield" size={14} /> The token is random, expires in seven days, and can be answered once.</p></div></div> : <div className="created-challenge"><div className="created-icon"><Icon name="link" size={27} /></div><span className="eyebrow">CHALLENGE READY</span><h1>Now send it<br /><em>to someone.</em></h1><p className="stage-intro">One link. One response. No account needed for your friend.</p><div className="generated-link"><span><Icon name="globe" size={16} /> {url}</span><button type="button" onClick={async () => { setCopied(await copyText(url)); if (!navigator.clipboard) onNotify('Copy the link from the address shown above.') }}>{copied ? <><Icon name="check" size={15} /> Copied</> : <><Icon name="copy" size={15} /> Copy</>}</button></div><div className="challenge-preview card-surface"><div><Tag tone="yellow">YOUR TAKE</Tag><h3>{created.take.statement}</h3></div><div className="preview-quote">“{created.argument}”</div><div className="preview-footer"><span><Icon name="clock" size={13} /> Expires {new Date(created.expiresAt).toLocaleDateString()}</span><span><Icon name="users" size={13} /> {response ? 'Counter received' : 'Waiting for a counter'}</span></div>{response && <p className="challenge-response" role="status"><strong>Friend response:</strong> {response}</p>}</div><div className="created-actions"><Button variant="dark" icon="share" onClick={shareChallenge}>Share challenge</Button><Button variant="secondary" icon="arrow" onClick={onBack}>Done</Button></div></div>}</div>
}

type ChallengeView = ChallengeResolved & { take: Take }

function ChallengeRecipient({ token, repository, userId, online }: { token: string; repository: AppRepository; userId: string; online?: boolean }) {
  const [challenge, setChallenge] = useState<ChallengeView | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  useEffect(() => { repository.loadChallenge(token).then(value => { setChallenge({ ...value, take: getTake(value.takeId) }); trackEvent('challenge_opened', { status: value.status }) }).catch(caught => setError(caught instanceof Error ? caught.message : 'Challenge unavailable.')).finally(() => setLoading(false)) }, [repository, token])
  async function submit() { if (!isOnline) return setError('You are offline. Reconnect before sending your counter.'); if (answer.trim().length < 12 || !challenge) return; setLoading(true); setError(''); try { const output = await repository.respondToChallenge(token, answer.trim(), userId); setResult(output.result); setChallenge({ ...output, take: getTake(output.takeId) }); trackEvent('challenge_completed', { score: output.result?.total || 0 }) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Response could not be submitted.') } finally { setLoading(false) } }
  if (loading && !challenge) return <div className="onboarding-page"><div className="created-challenge"><span className="eyebrow">FRIEND CLASH</span><h1>Loading challenge…</h1></div></div>
  if (error && !challenge) return <div className="onboarding-page"><div className="created-challenge"><Tag tone="coral">CHALLENGE UNAVAILABLE</Tag><h1>This link<br /><em>needs a reset.</em></h1><p className="stage-intro" role="alert">{error}</p></div></div>
  if (!challenge) return null
  return <div className="onboarding-page"><div className="created-challenge challenge-recipient"><Tag tone="yellow">FRIEND CLASH</Tag><h1>Can you answer<br /><em>this case?</em></h1><p className="stage-intro">A friend opened with a position. Respond once, make your strongest counterpoint, and see the read.</p><div className="challenge-preview card-surface"><Tag tone="yellow">THE TAKE</Tag><h3>{challenge.take.statement}</h3><p className="muted">{challenge.take.context}</p><div className="preview-quote">“{challenge.argument}”</div></div>{result || challenge.response ? <div className="created-icon"><Icon name="check" size={27} /></div> : <div className="clash-form card-surface"><label className="field-label" htmlFor="challenge-response">Your response</label><textarea id="challenge-response" className="clash-textarea" value={answer} onChange={event => setAnswer(event.target.value.slice(0, 350))} placeholder="The strongest counterpoint is…" disabled={loading} /><Button className="full-width" icon="send" onClick={submit} disabled={answer.trim().length < 12 || loading}>{loading ? 'Submitting…' : 'Send my counter'}</Button>{error && <p className="form-error" role="alert">{error}</p>}</div>}{result && <p className="recipient-result" role="status">Challenge complete. Argument read: <strong>{result.total}/100</strong></p>}{challenge.response && !result && <p className="recipient-result" role="status">This challenge has already been answered.</p>}</div></div>
}

function Profile({ name, history, onBack, onNotify }: { name: string; history: ResultData[]; onBack: () => void; onNotify: (message: string) => void }) {
  const scored = history.filter(result => typeof result.score === 'number')
  const average = scored.length ? Math.round(scored.reduce((sum, result) => sum + (result.score || 0), 0) / scored.length) : 0
  return <div className="page profile-page"><div className="page-heading"><div><span className="eyebrow">YOUR SPACE</span><h1>{name}<span className="heading-period">.</span></h1><p className="muted">Curious challenger · Private by default</p></div><Button variant="secondary" icon="settings" onClick={() => onNotify('Profile settings are intentionally limited in this beta.')}>Settings</Button></div><div className="profile-grid"><div className="profile-hero card-surface"><div className="profile-avatar-large">{name.slice(0, 1).toUpperCase()}<span className="online-dot" /></div><h2>Keep asking better questions.</h2><p>Your profile is about how you think, not what you believe.</p><div className="profile-tags"><Tag tone="coral">CURIOUS</Tag><Tag tone="lavender">OPEN-MINDED</Tag><Tag tone="yellow">{history.length} SHIFTS</Tag></div></div><div className="profile-stats card-surface"><span className="eyebrow">YOUR DEBATE DNA</span><div className="dna-chart"><div className="dna-ring"><strong>{average}</strong><small>average</small></div><div className="dna-legend"><span><i className="legend-coral" /> Clarity <b>{average || '—'}</b></span><span><i className="legend-lavender" /> Fairness <b>{history.length ? 'recorded' : '—'}</b></span><span><i className="legend-yellow" /> Curiosity <b>{history.length ? 'active' : '—'}</b></span><span><i className="legend-blue" /> Rebuttal <b>{history.length ? 'practising' : '—'}</b></span></div></div></div></div><div className="profile-footer"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> Back to today</button><span><Icon name="lock" size={13} /> Your profile is private by default</span></div></div>
}

function avatarGlyph(preset: UserProfile['avatarPreset']): string {
  return ({ orbit: '◌', spark: '✦', wave: '≈', sun: '☼', leaf: '⌁' } as const)[preset]
}

function categoryMatches(take: Take, category: string): boolean {
  if (category === 'All topics') return true
  const aliases: Record<string, string[]> = {
    Gaming: ['Gaming', 'Gaming & internet'],
    'AI and Technology': ['AI and Technology', 'Society & technology', 'Technology'],
    'Movies and Series': ['Movies and Series', 'Films'],
    'School and Education': ['School and Education', 'School'],
    Wildcards: ['Wildcards', 'Wildcard'],
  }
  return (aliases[category] || [category]).includes(take.category) || (aliases[category] || [category]).includes(take.categoryDe)
}

function StreakSummary({ stats }: { stats: PersonalStats }) {
  return <div className="streak-summary card-surface"><div className="streak-summary-icon"><Icon name="flame" size={20} /></div><div><span className="eyebrow">CURRENT STREAK</span><strong>{stats.currentStreak} day{stats.currentStreak === 1 ? '' : 's'}</strong><small>{stats.totalActiveDays} active day{stats.totalActiveDays === 1 ? '' : 's'} · best {stats.bestStreak}</small></div></div>
}

function PersonalHome({ userName, language, interests, history, stats, activeDebate, lastResult, preferredMode, onBegin, onChooseDebate, onResume, onExplore, onClash, onProfile, onSettings, onNotify }: { userName: string; language: Language; interests: string[]; history: ResultData[]; stats: PersonalStats; activeDebate: boolean; lastResult: ResultData | null; preferredMode: Mode; onBegin: BeginHandler; onChooseDebate: (take?: Take) => void; onResume: () => void; onExplore: () => void; onClash: () => void; onProfile: () => void; onSettings: () => void; onNotify: (message: string) => void }) {
  const firstName = userName.split(' ')[0] || 'there'
  const recentIds = history.map(result => result.take.id)
  const personalized = selectPersonalizedTakes(interests, recentIds, 3)
  const worldTake = takes.find(take => take.id === 'society-media-age') || takes[0]
  const worldText = takeText(worldTake, language)
  return <div className="page home-page personal-home"><div className="page-heading home-heading"><div><span className="eyebrow">YOUR DAILY SHIFT</span><h1>Good morning, {firstName}<span className="heading-period">.</span></h1><p className="muted">A private place to test your reasoning, not your identity.</p></div><div className="heading-actions"><Button variant="primary" icon="arrow" onClick={() => onChooseDebate(worldTake)}>Start a debate</Button><Button variant="secondary" icon="settings" onClick={onSettings}>Settings</Button><Button variant="dark" icon="plus" onClick={onClash}>Challenge a friend</Button></div></div><section className="home-grid"><article className="world-card card-surface"><div className="world-card-main"><div className="card-topline"><Tag tone="dark">WORLD TAKE</Tag><span className="card-date"><Icon name="globe" size={14} /> GLOBAL</span></div><div className="world-number">01</div><h2>{worldText.statement}</h2><p>{worldText.context}</p><div className="world-bottom"><div className="reaction-dots"><span className="dot-pink" /><span className="dot-purple" /><span className="dot-yellow" /><span className="dot-blue" /><small>{worldText.category} · private stance</small></div><Button variant="dark" icon="arrow" onClick={() => onBegin(preferredMode, worldTake)}>Take a side</Button></div></div><div className="world-card-art"><span className="art-label">TODAY'S<br />QUESTION</span><div className="art-orbit art-orbit-a" /><div className="art-orbit art-orbit-b" /><div className="art-word">MOVE<br /><em>A</em><br />MIND</div></div></article><aside className="home-side-stack"><StreakSummary stats={stats} />{activeDebate ? <button type="button" className="continue-card card-surface" onClick={onResume}><span className="continue-icon"><Icon name="arrow" size={18} /></span><span><span className="eyebrow">IN PROGRESS</span><strong>Continue your debate</strong><small>Your draft is saved privately.</small></span><Icon name="chevron" size={17} /></button> : <div className="home-note card-surface"><Icon name="shield" size={19} /><strong>Private by default</strong><span>Interests and stances are content preferences, not a public identity profile.</span></div>}<button type="button" className="recent-result-card card-surface" onClick={lastResult ? onProfile : onExplore}>{lastResult ? <><span className="eyebrow">LATEST RESULT</span><strong>{lastResult.score}/100 argument score</strong><small>{takeText(lastResult.take, language).category} · {lastResult.mode}</small></> : <><span className="eyebrow">START EXPLORING</span><strong>Find a good disagreement</strong><small>Browse {takes.length} balanced takes.</small></>}</button></aside></section><section className="section-block"><div className="section-heading"><div><span className="eyebrow">PERSONALIZED FOR YOU</span><h2>Your take</h2></div><button type="button" className="text-link" onClick={onExplore}>View all <Icon name="arrow" size={15} /></button></div><div className="take-row">{personalized.map((take, index) => <TakeCard key={take.id} take={take} onBegin={onBegin} featured={index === 0} language={language} />)}</div><div className="category-shortcuts"><span className="eyebrow">YOUR CATEGORIES</span>{(interests.length ? interests : ['Wildcards']).slice(0, 5).map(category => <button type="button" key={category} onClick={onExplore}>{category}</button>)}<button type="button" className="shortcut-more" onClick={onSettings}>Edit interests <Icon name="settings" size={13} /></button></div></section><section className="section-block lower-section"><div className="section-heading"><div><span className="eyebrow">KEEP MOVING</span><h2>Recent shifts</h2></div><button type="button" className="text-link" onClick={onProfile}>View profile <Icon name="arrow" size={15} /></button></div>{history.length ? <div className="recent-grid">{history.slice(0, 2).map(result => <RecentShift key={result.id} result={result} language={language} />)}<div className="mini-stats"><div><span className="mini-stat-icon mint"><Icon name="arrowUp" size={17} /></span><strong>{stats.debatesCompleted}</strong><small>debates<br />completed</small></div><div><span className="mini-stat-icon yellow"><Icon name="target" size={17} /></span><strong>{stats.averageScore}</strong><small>average<br />score</small></div></div></div> : <div className="empty-state card-surface"><Icon name="spark" size={20} /><strong>Your first shift is waiting.</strong><span>Complete a debate and your private history will appear here.</span></div>}</section></div>
}

function PersonalExplore({ language, interests, recentIds, onBegin, onChooseDebate, onNotify }: { language: Language; interests: string[]; recentIds: string[]; onBegin: BeginHandler; onChooseDebate: (take?: Take) => void; onNotify: (message: string) => void }) {
  const [filter, setFilter] = useState('All topics')
  const [spotlight, setSpotlight] = useState<Take | null>(null)
  const filtered = takes.filter(take => categoryMatches(take, filter))
  function anotherTake() {
    const next = selectPersonalizedTakes(interests, [...recentIds, ...(spotlight ? [spotlight.id] : [])], 1)[0]
    setSpotlight(next || takes[0])
    onNotify('Another take selected from your private interests.')
  }
  return <div className="page explore-page"><div className="page-heading"><div><span className="eyebrow">THE TAKE LIBRARY</span><h1>Find your next<br /><em>good disagreement.</em></h1><p className="muted">Curated prompts with two defensible sides. No hot takes required.</p></div><div className="explore-heading-actions"><div className="explore-count"><strong>{filtered.length}</strong><span>{filter === 'All topics' ? 'balanced' : 'in this topic'}</span></div><Button variant="primary" icon="arrow" onClick={() => onChooseDebate(filtered[0] || takes[0])}>Start a debate</Button></div></div><div className="filter-row explore-topic-filters"><button type="button" className={filter === 'All topics' ? 'filter active' : 'filter'} onClick={() => setFilter('All topics')}>All topics</button>{interestOptions.map(item => <button type="button" key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{item}</button>)}<Button variant="secondary" icon="spark" onClick={anotherTake}>Another take</Button></div>{spotlight && <article className="explore-spotlight card-surface"><div><span className="eyebrow">YOUR NEXT TAKE</span><Tag tone="coral">{takeText(spotlight, language).category}</Tag><h2>{takeText(spotlight, language).statement}</h2><p>{takeText(spotlight, language).context}</p></div><Button variant="dark" icon="arrow" onClick={() => onChooseDebate(spotlight)}>Start this take</Button></article>}<div className="explore-grid">{filtered.map(take => <TakeCard key={take.id} take={take} onBegin={onBegin} onChooseDebate={onChooseDebate} featured={take.id === 'society-media-age'} language={language} />)}<article className="suggest-card"><span className="suggest-spark"><Icon name="spark" size={20} /></span><h3>Keep it private,<br />keep it curious.</h3><p>Every take has two defensible sides and stays inside your private beta space.</p><Button variant="secondary" icon="settings" onClick={() => onNotify('Open Settings to update your private interests.')}>Edit interests</Button></article></div></div>
}

function PersonalProfile({ profile, language, stats, history, onSettings, onBack }: { profile: UserProfile; language: Language; stats: PersonalStats; history: ResultData[]; onSettings: () => void; onBack: () => void }) {
  const name = profile.displayName || 'Curious challenger'
  const firstScore = history[0]?.scores[0]?.score || 0
  return <div className="page profile-page personal-profile"><div className="page-heading"><div><span className="eyebrow">YOUR PRIVATE PROFILE</span><h1>{name}<span className="heading-period">.</span></h1><p className="muted">{profile.bio || 'Your profile is about how you think, not what you believe.'}</p></div><Button variant="secondary" icon="settings" onClick={onSettings}>Edit profile</Button></div><div className="profile-overview"><section className="profile-hero card-surface"><div className={`profile-avatar-large avatar-${profile.avatarPreset}`}>{avatarGlyph(profile.avatarPreset)}<span className="online-dot" /></div><h2>Keep asking better questions.</h2><p>Private by default. Your interests and debate history are not public.</p><div className="profile-tags"><Tag tone="coral">PRIVATE</Tag><Tag tone="lavender">{stats.currentStreak} DAY STREAK</Tag><Tag tone="yellow">{stats.debatesCompleted} DEBATES</Tag></div></section><section className="profile-stats card-surface"><span className="eyebrow">YOUR DEBATE DNA</span><div className="dna-chart"><div className="dna-ring"><strong>{stats.averageScore || '—'}</strong><small>avg score</small></div><div className="dna-legend"><span><i className="legend-coral" /> Strongest <b>{stats.strongestDimension}</b></span><span><i className="legend-lavender" /> Current streak <b>{stats.currentStreak} days</b></span><span><i className="legend-yellow" /> Categories <b>{stats.categoriesExplored}</b></span><span><i className="legend-blue" /> Latest signal <b>{firstScore || '—'}</b></span></div></div><p className="ai-disclaimer"><Icon name="info" size={14} /> AI scores are experimental argument feedback, not intelligence or ideological correctness.</p></section></div><section className="profile-metric-grid"><div className="metric-card"><strong>{stats.bestStreak}</strong><span>best streak</span></div><div className="metric-card"><strong>{stats.sideSwitchCompleted}</strong><span>SideSwitch</span></div><div className="metric-card"><strong>{stats.classicCompleted}</strong><span>Classic</span></div><div className="metric-card"><strong>{stats.challengeResponses}</strong><span>challenge responses</span></div><div className="metric-card"><strong>{stats.challengeCreated}</strong><span>challenges created</span></div></section><section className="section-block profile-history"><div className="section-heading"><div><span className="eyebrow">PRIVATE HISTORY</span><h2>Recent shifts</h2></div><span className="muted">{stats.totalActiveDays} active days</span></div>{history.length ? <div className="recent-grid">{history.slice(0, 5).map(result => <RecentShift key={result.id} result={result} language={language} />)}</div> : <div className="empty-state card-surface"><strong>No completed debates yet.</strong><span>Your first result will appear here.</span></div>}</section><div className="profile-footer"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> Back to today</button><span><Icon name="lock" size={13} /> Private by default</span></div></div>
}

function AiDefaultsSection({ preferences, onChange }: { preferences: UserPreferences; onChange: (patch: Partial<UserPreferences>) => void }) {
  return <section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">AI DEBATE DEFAULTS</span><h2>Set the starting point</h2></div><Icon name="spark" size={21} /></div><p className="field-help settings-intro">These defaults only affect your private AI debate setup. You can change them before every debate.</p><div className="settings-fields-grid"><label className="field-label">Preferred opponent<select className="settings-select" value={preferences.preferredOpponentType} onChange={event => onChange({ preferredOpponentType: event.target.value as UserPreferences['preferredOpponentType'] })}><option value="ask">Ask every time</option><option value="ai">AI opponent</option><option value="person">Person or friend</option></select></label><label className="field-label">AI family<select className="settings-select" value={preferences.preferredAiFamily} onChange={event => onChange({ preferredAiFamily: event.target.value as UserPreferences['preferredAiFamily'] })}><option value="Gemini">Gemini</option><option value="Claude">Claude</option><option value="GPT">GPT</option><option value="DeepSeek">DeepSeek</option></select></label><label className="field-label">Model quality<select className="settings-select" value={preferences.aiQuality} onChange={event => onChange({ aiQuality: event.target.value as UserPreferences['aiQuality'] })}><option value="fast">Fast</option><option value="balanced">Balanced</option><option value="maximum">Maximum</option></select></label><label className="field-label">Response length<select className="settings-select" value={preferences.aiResponseLength} onChange={event => onChange({ aiResponseLength: event.target.value as UserPreferences['aiResponseLength'] })}><option value="concise">Concise</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label></div><label className="toggle-row"><input type="checkbox" checked={preferences.showModelDetails} onChange={event => onChange({ showModelDetails: event.target.checked })} /><span>Show model details during AI debates</span><small>When off, the debate stays focused and only displays a compact provider label.</small></label></section>
}

function BetaFeedbackForm({ language, surface, screen, aiModelId, onSubmit }: { language: Language; surface: BetaFeedbackInput['surface']; screen: string; aiModelId?: string | null; onSubmit: (payload: BetaFeedbackInput) => Promise<void> }) {
  const german = language === 'de'
  const [category, setCategory] = useState<BetaFeedbackCategory>('suggestion')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const labels: Array<[BetaFeedbackCategory, string]> = german ? [['broken', 'Funktion kaputt'], ['ai_quality', 'KI-Qualität'], ['design_usability', 'Design / Bedienung'], ['missing_topic', 'Thema fehlt'], ['suggestion', 'Vorschlag'], ['other', 'Sonstiges']] : [['broken', 'Something is broken'], ['ai_quality', 'AI quality'], ['design_usability', 'Design / usability'], ['missing_topic', 'Missing topic'], ['suggestion', 'Suggestion'], ['other', 'Other']]
  async function submit() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({ category, message: message.trim() || null, surface, screen, aiModelId: aiModelId || null, appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0-beta' })
      setSent(true); setMessage('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : (german ? 'Feedback konnte nicht gesendet werden.' : 'Feedback could not be sent.'))
    } finally { setBusy(false) }
  }
  return <section className="settings-section card-surface beta-feedback"><div className="settings-section-heading"><div><span className="eyebrow">{german ? 'PRIVATE BETA' : 'PRIVATE BETA'}</span><h2>{german ? 'Feedback geben' : 'Share beta feedback'}</h2></div><Icon name="message" size={21} /></div><p className="field-help">{german ? 'Hilf uns mit einer kurzen Rückmeldung. Keine Debatte oder Rohdaten werden mitgesendet.' : 'Tell us what to improve. Your transcript and raw debate text are never included.'}</p><div className="feedback-options" role="group" aria-label={german ? 'Feedbacktyp' : 'Feedback type'}>{labels.map(([value, label]) => <button type="button" key={value} className={category === value ? 'selected' : ''} aria-pressed={category === value} onClick={() => { setCategory(value); setSent(false) }}>{label}</button>)}</div><label className="field-label" htmlFor={`beta-feedback-${surface}`}>{german ? 'Kurze Nachricht (optional)' : 'Short note (optional)'}</label><textarea id={`beta-feedback-${surface}`} className="settings-textarea" maxLength={600} value={message} onChange={event => { setMessage(event.target.value); setSent(false); setError('') }} placeholder={german ? 'Was ist passiert oder was wünschst du dir?' : 'What happened or what would you like to see?'} /><div className="feedback-submit-row"><small>{message.length} / 600</small><Button variant="secondary" onClick={() => void submit()} disabled={busy}>{busy ? (german ? 'Senden…' : 'Sending…') : (german ? 'Feedback senden' : 'Send feedback')}</Button></div>{error && <p className="form-error" role="alert">{error}</p>}{sent && <p className="form-success" role="status">{german ? 'Danke. Dein Feedback wurde privat gespeichert.' : 'Thanks. Your feedback was saved privately.'}</p>}</section>
}

function SettingsScreen(props: { profile: UserProfile; preferences: UserPreferences; aiMode: AiMode; backendLabel: string; onSaveProfile: (value: UserProfile) => Promise<void>; onSavePreferences: (value: UserPreferences) => Promise<void>; onDelete: () => void; onBack: () => void; onNotify: (message: string) => void; onSubmitFeedback: (payload: BetaFeedbackInput) => Promise<void> }) {
  const [draftPreferences, setDraftPreferences] = useState(props.preferences)
  useEffect(() => { setDraftPreferences(props.preferences) }, [props.preferences])
  const saveWithAiDefaults = (next: UserPreferences) => props.onSavePreferences({ ...next, preferredOpponentType: draftPreferences.preferredOpponentType, preferredAiFamily: draftPreferences.preferredAiFamily, preferredAiModelId: draftPreferences.preferredAiModelId, aiQuality: draftPreferences.aiQuality, aiResponseLength: draftPreferences.aiResponseLength, showModelDetails: draftPreferences.showModelDetails })
  async function resetAppearance() {
    const next = normalizePreferences({ ...props.preferences, theme: 'system', accent: 'coral', textSize: 'comfortable', reducedMotion: false })
    setDraftPreferences(next)
    await props.onSavePreferences(next)
    props.onNotify('Appearance reset to SideShift defaults.')
  }
  return <><div className="page settings-page settings-defaults-wrapper"><AiDefaultsSection preferences={draftPreferences} onChange={patch => setDraftPreferences(current => ({ ...current, ...patch }))} /></div><LegacySettingsScreen {...props} onSavePreferences={saveWithAiDefaults} /><div className="page settings-page settings-micro-polish"><button type="button" className="button button-ghost" onClick={() => void resetAppearance()}>Reset appearance defaults</button><button type="button" className="button button-ghost" onClick={() => window.dispatchEvent(new Event('sideshift-open-guide'))}>How SideShift works</button><BetaFeedbackForm language={props.profile.interfaceLanguage} surface="settings" screen="settings" onSubmit={props.onSubmitFeedback} /></div></>
}

function LegacySettingsScreen({ profile, preferences, aiMode, backendLabel, onSaveProfile, onSavePreferences, onDelete, onBack, onNotify, onSubmitFeedback }: { profile: UserProfile; preferences: UserPreferences; aiMode: AiMode; backendLabel: string; onSaveProfile: (value: UserProfile) => Promise<void>; onSavePreferences: (value: UserPreferences) => Promise<void>; onDelete: () => void; onBack: () => void; onNotify: (message: string) => void; onSubmitFeedback: (payload: BetaFeedbackInput) => Promise<void> }) {
  const [draftProfile, setDraftProfile] = useState(profile)
  const [draftPreferences, setDraftPreferences] = useState(preferences)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraftProfile(profile); setDraftPreferences(preferences) }, [profile, preferences])
  async function save() {
    setSaving(true)
    try { const nextProfile = normalizeProfile(draftProfile); const nextPreferences = normalizePreferences(draftPreferences); await onSaveProfile(nextProfile); await onSavePreferences(nextPreferences); onNotify('Settings saved privately.') } catch (caught) { onNotify(caught instanceof Error ? caught.message : 'Settings could not be saved.') } finally { setSaving(false) }
  }
  return <div className="page settings-page"><div className="page-heading"><div><span className="eyebrow">YOUR CONTROL ROOM</span><h1>Settings<span className="heading-period">.</span></h1><p className="muted">Personalize the room without making your beliefs public.</p></div><Button variant="dark" icon="check" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button></div><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">ACCOUNT & PROFILE</span><h2>How you appear</h2></div><Icon name="person" size={21} /></div><label className="field-label" htmlFor="settings-name">Display name</label><input id="settings-name" className="text-input" maxLength={24} value={draftProfile.displayName || ''} onChange={event => setDraftProfile(current => ({ ...current, displayName: event.target.value }))} /><label className="field-label" htmlFor="settings-bio">Short bio <span>({(draftProfile.bio || '').length}/160)</span></label><textarea id="settings-bio" className="settings-textarea" maxLength={160} value={draftProfile.bio || ''} onChange={event => setDraftProfile(current => ({ ...current, bio: event.target.value }))} placeholder="A sentence about what you like to explore" /><span className="field-help">Optional. This is private unless you choose to show profile details in a challenge.</span><span className="field-label">Preset avatar</span><div className="avatar-options">{avatarPresets.map(preset => <button type="button" key={preset} className={`avatar-option avatar-${preset} ${draftProfile.avatarPreset === preset ? 'selected' : ''}`} aria-label={`Choose ${preset} avatar`} aria-pressed={draftProfile.avatarPreset === preset} onClick={() => setDraftProfile(current => ({ ...current, avatarPreset: preset }))}>{avatarGlyph(preset)}<small>{preset}</small></button>)}</div></section><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">CONTENT PREFERENCES</span><h2>What you want to explore</h2></div><Icon name="layers" size={21} /></div><p className="field-help settings-intro">These are private content preferences. They do not describe your identity or political ideology.</p><div className="settings-interest-grid">{interestOptions.map(interest => <button type="button" key={interest} className={`interest-chip ${draftPreferences.topicPreferences.includes(interest) ? 'selected' : ''}`} aria-pressed={draftPreferences.topicPreferences.includes(interest)} onClick={() => setDraftPreferences(current => ({ ...current, topicPreferences: current.topicPreferences.includes(interest) ? current.topicPreferences.filter(item => item !== interest) : [...current.topicPreferences, interest] }))}>{draftPreferences.topicPreferences.includes(interest) && <Icon name="check" size={14} />}{interest}</button>)}</div><div className="settings-fields-grid"><label className="field-label">Interface language<select className="settings-select" value={draftProfile.interfaceLanguage} onChange={event => setDraftProfile(current => ({ ...current, interfaceLanguage: event.target.value as Language }))}><option value="en">English</option><option value="de">Deutsch</option></select></label><label className="field-label">Debate language<select className="settings-select" value={draftPreferences.debateLanguages[0]} onChange={event => setDraftPreferences(current => ({ ...current, debateLanguages: [event.target.value as Language] }))}><option value="en">English</option><option value="de">Deutsch</option></select></label><label className="field-label">Debate intensity<select className="settings-select" value={draftPreferences.intensity || 'balanced'} onChange={event => setDraftPreferences(current => ({ ...current, intensity: event.target.value }))}><option value="gentle">Gentle</option><option value="balanced">Balanced</option><option value="rigorous">Rigorous</option></select></label><label className="field-label">Default mode<select className="settings-select" value={draftPreferences.preferredMode} onChange={event => setDraftPreferences(current => ({ ...current, preferredMode: event.target.value as Mode }))}><option value="sideswitch">SideSwitch</option><option value="classic">Classic</option><option value="blindside">Blindside</option><option value="commonground">CommonGround</option></select></label><label className="field-label">AI style<select className="settings-select" value={draftPreferences.preferredAiStyle || 'sharp-skeptic'} onChange={event => setDraftPreferences(current => ({ ...current, preferredAiStyle: event.target.value }))}><option value="sharp-skeptic">Sharp Skeptic</option><option value="curious-coach">Curious Coach</option><option value="fair-moderator">Fair Moderator</option></select></label></div></section><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">APPEARANCE</span><h2>Make it yours</h2></div><Icon name="sun" size={21} /></div><div className="settings-fields-grid"><label className="field-label">Theme<select className="settings-select" value={draftPreferences.theme} onChange={event => setDraftPreferences(current => ({ ...current, theme: event.target.value as UserPreferences['theme'] }))}>{Object.entries(appearanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-label">Text size<select className="settings-select" value={draftPreferences.textSize} onChange={event => setDraftPreferences(current => ({ ...current, textSize: event.target.value as UserPreferences['textSize'] }))}>{Object.entries(textSizeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><span className="field-label">Accent theme</span><div className="accent-options">{accentThemes.map(accent => <button type="button" key={accent} className={`accent-option accent-${accent} ${draftPreferences.accent === accent ? 'selected' : ''}`} aria-pressed={draftPreferences.accent === accent} onClick={() => setDraftPreferences(current => ({ ...current, accent }))}><i />{accent}</button>)}</div><label className="toggle-row"><input type="checkbox" checked={draftPreferences.reducedMotion} onChange={event => setDraftPreferences(current => ({ ...current, reducedMotion: event.target.checked }))} /><span>Reduce motion</span><small>Also respects your operating-system preference.</small></label></section><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">PRIVACY & DATA</span><h2>Keep control</h2></div><Icon name="shield" size={21} /></div><label className="toggle-row"><input type="checkbox" checked={!draftPreferences.shareRealStance} onChange={event => setDraftPreferences(current => ({ ...current, shareRealStance: !event.target.checked }))} /><span>Keep real stance private on share cards</span><small>Recommended default. Share cards show argument feedback, not your private starting position.</small></label><label className="toggle-row"><input type="checkbox" checked={draftProfile.challengeShowName} onChange={event => setDraftProfile(current => ({ ...current, challengeShowName: event.target.checked }))} /><span>Show my name and avatar to challenge recipients</span><small>Off by default; challenge links still work without profile details.</small></label><div className="settings-links"><a href="/privacy">Privacy information</a><a href="/terms">Beta terms</a><a href="/community">Community rules</a></div><Button variant="secondary" onClick={onDelete}>Delete beta data</Button></section><section className="settings-section card-surface beta-settings"><div className="settings-section-heading"><div><span className="eyebrow">PRIVATE BETA</span><h2>About this build</h2></div><Icon name="info" size={21} /></div><div className="beta-facts"><span><strong>Backend</strong>{backendLabel}</span><span><strong>AI status</strong>{aiRuntimeLabel(aiMode)}</span><span><strong>Version</strong>SideShift beta</span></div><p className="field-help">Scores are experimental feedback on argument technique, not measures of intelligence or ideological correctness.</p></section><div className="settings-footer"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> Back to today</button><Button variant="dark" icon="check" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button></div></div>
}

function BackendGate({ title, message, action }: { title: string; message: string; action?: { label: string; onClick: () => void } }) {
  return <div className="onboarding-page"><div className="created-challenge"><Tag tone="coral">PRIVATE BETA</Tag><h1>{title}</h1><p className="stage-intro" role="alert">{message}</p>{action && <Button onClick={action.onClick}>{action.label}</Button>}</div></div>
}

function App() {
  const auth = useAuth()
  const repository = auth.repository
  const userId = auth.userId
  const online = useOnlineStatus()
  const challengeToken = typeof window !== 'undefined' ? window.location.pathname.match(/^\/challenge\/([A-Za-z0-9_-]+)$/)?.[1] : undefined
  const groupPathId = typeof window !== 'undefined' ? window.location.pathname.match(/^\/group\/([A-Za-z0-9-]+)$/)?.[1] : undefined
  const legalPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const [hasOnboarded, setHasOnboarded] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [userName, setUserName] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [language, setLanguage] = useState<Language>('en')
  const [profileData, setProfileData] = useState<UserProfile>(defaultProfile(''))
  const [preferencesData, setPreferencesData] = useState<UserPreferences>(defaultPreferences(''))
  const [statsSnapshot, setStatsSnapshot] = useState<UserStatsSnapshot>(emptyStatsSnapshot)
  const [activeTake, setActiveTake] = useState(takes[0])
  const [activeMode, setActiveMode] = useState<Mode>('sideswitch')
  const [debateId, setDebateId] = useState('')
  const [debateStep, setDebateStep] = useState(0)
  const [stance, setStance] = useState<Stance>(1)
  const [postStance, setPostStance] = useState<Stance>(1)
  const [confidence, setConfidence] = useState(4)
  const [understanding, setUnderstanding] = useState('yes')
  const [responses, setResponses] = useState<Record<number, string>>({})
  const [opponentMessages, setOpponentMessages] = useState<Record<number, string>>({})
  const [lastResult, setLastResult] = useState<ResultData | null>(null)
  const [history, setHistory] = useState<ResultData[]>([])
  const [toast, setToast] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const mockAi = import.meta.env.VITE_AI_MOCK === 'true'
  const [aiRuntime, setAiRuntime] = useState<AiRuntimeSnapshot>(() => createAiRuntimeSnapshot({ mock: mockAi, puterStatus: 'disconnected', basicServerAvailable: false }))
  const aiMode = aiRuntime.primary
  const mockAiProvider = useMemo<AiProvider>(() => createMockAiProvider({ streamDelayMs: 1 }), [])
  const [liveAiProvider, setLiveAiProvider] = useState<AiProvider | null>(null)
  const aiProvider = mockAi ? mockAiProvider : liveAiProvider || mockAiProvider
  const [aiTake, setAiTake] = useState<Take>(takes[0])
  const [aiConfig, setAiConfig] = useState<AiStartConfig | null>(null)
  const [aiSnapshot, setAiSnapshot] = useState<AiDebateData | null>(null)
  const [aiPreset, setAiPreset] = useState<Partial<AiStartConfig> | undefined>()
  const [teamSession, setTeamSession] = useState<TeamDebateSession | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [teamInitialTopic, setTeamInitialTopic] = useState<{ statement: string; context: string; takeId: string | null; custom: boolean } | undefined>()
  const aiCompletionRef = useRef(new Set<string>())
  const teamCompletionRef = useRef(new Set<string>())
  const personalStats = useMemo(() => calculatePersonalStats(history, statsSnapshot), [history, statsSnapshot])
  const debateSaveQueueRef = useRef(Promise.resolve())
  const latestQueuedDebateRef = useRef<{ id: string; step: number } | null>(null)

  async function queueClassicDebateSave(snapshot: DebateSnapshot) {
    if (!repository || !userId) return
    const latest = latestQueuedDebateRef.current
    if (latest?.id === snapshot.id && snapshot.step < latest.step) return
    latestQueuedDebateRef.current = { id: snapshot.id, step: snapshot.step }
    const save = debateSaveQueueRef.current.catch(() => undefined).then(() => repository.saveDebate(userId, snapshot))
    debateSaveQueueRef.current = save.catch(() => undefined)
    await save
  }

  function notify(message: string) { setToast(message) }
  useEffect(() => { registerServiceWorker(); void initializeCapacitorBridge() }, [])
  useEffect(() => {
    const handleNativeBack = () => setScreen(current => current === 'aiDebate' || current === 'debate' || current === 'team' || current === 'groups' ? 'home' : current === 'aiSetup' || current === 'debateChoice' || current === 'clash' ? 'home' : current)
    window.addEventListener('sideshift-native-back', handleNativeBack)
    return () => window.removeEventListener('sideshift-native-back', handleNativeBack)
  }, [])
  useEffect(() => { setAnalyticsAccessToken(auth.accessToken) }, [auth.accessToken])
  useEffect(() => { if (dataError) trackEvent('recoverable_error_encountered', { surface: 'private_data' }) }, [dataError])
  useEffect(() => {
    if (typeof window === 'undefined' || window.sessionStorage.getItem('sideshift-landing-tracked')) return
    window.sessionStorage.setItem('sideshift-landing-tracked', '1')
    trackEvent('landing_viewed', { environment: import.meta.env.MODE })
  }, [])
  useEffect(() => { if (!hasOnboarded && repository) trackEvent('onboarding_started') }, [hasOnboarded, repository])
  useEffect(() => { if (toast) { const timeout = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timeout) } }, [toast])
  useEffect(() => { applyTheme(preferencesData) }, [preferencesData])
  useEffect(() => {
    const handleDebateEntry = () => beginDebateEntry(activeTake)
    window.addEventListener('sideshift-debate-entry', handleDebateEntry)
    return () => window.removeEventListener('sideshift-debate-entry', handleDebateEntry)
  }, [activeTake])
  useEffect(() => {
    const handleGuide = () => setShowGuide(true)
    window.addEventListener('sideshift-open-guide', handleGuide)
    return () => window.removeEventListener('sideshift-open-guide', handleGuide)
  }, [])
  useEffect(() => {
    if (hasOnboarded && hydratedUserId === userId && !hasSeenFirstUseGuide()) setShowGuide(true)
  }, [hasOnboarded, hydratedUserId, userId])

  useEffect(() => {
    if (mockAi || !['aiSetup', 'aiDebate', 'aiResults'].includes(screen)) return
    let active = true
    void import('./lib/ai/puterProvider').then(({ createPuterProvider }) => {
      if (active) setLiveAiProvider(current => current || createPuterProvider())
    }).catch(() => { if (active) setDataError('Live AI could not be loaded.') })
    return () => { active = false }
  }, [mockAi, screen])

  useEffect(() => {
    if (!repository || !userId) return
    let active = true
    setHydratedUserId(null)
    setDataError(null)
    Promise.all([repository.loadProfile(userId), repository.loadPreferences(userId), repository.loadDebate(userId), repository.loadResult(userId), repository.loadHistory(userId), repository.loadTeamSession(userId)]).then(([profile, preferences, debate, result, storedHistory, storedTeamSession]) => {
      if (!active) return
      const nextProfile = profile ? normalizeProfile(profile) : defaultProfile(userId)
      const nextPreferences = preferences ? normalizePreferences(preferences) : defaultPreferences(userId)
      const nextLanguage = profile?.interfaceLanguage || preferences?.debateLanguages[0] || 'en'
      setProfileData(nextProfile)
      setPreferencesData(nextPreferences)
      setUserName(nextProfile.displayName || '')
      setInterests(nextPreferences.topicPreferences)
      setLanguage(nextLanguage)
      setHasOnboarded(nextPreferences.onboardingCompleted)
      const storedTake = result?.take || getTake(debate?.takeId || takes[0].id)
      const restoredTake = debate?.ai?.customMotion ? privateTake(debate.ai.customMotion, storedTake) : storedTake
      setActiveTake(restoredTake)
      if (debate?.ai) {
        setAiTake(restoredTake)
        setAiSnapshot(debate.ai)
        setAiConfig(hydratedAiConfig(debate.ai))
      } else if (result?.ai) {
        setAiTake(restoredTake)
        setAiSnapshot(null)
        setAiConfig(hydratedResultAiConfig(result))
      } else {
        setAiSnapshot(null)
        setAiConfig(null)
      }
      setActiveMode(debate?.mode || result?.mode || nextPreferences.preferredMode)
      setDebateId(debate?.id || '')
      setDebateStep(debate?.step || 0)
      setStance(debate?.stance ?? 1)
      setPostStance(debate?.postStance ?? debate?.stance ?? 1)
      setConfidence(debate?.confidence ?? 4)
      setUnderstanding(debate?.understanding || 'yes')
      setResponses(debate?.responses || {})
      setOpponentMessages(debate?.opponentMessages || {})
      setLastResult(result)
      setHistory(storedHistory)
      setTeamSession(storedTeamSession)
      setActiveGroupId(storedTeamSession?.groupId || null)
      const setupDraft = loadAiSetupDraft()
      if (!debate && !result && setupDraft?.takeId) {
        const setupTake = getTake(setupDraft.takeId)
        setActiveTake(setupTake)
        setAiTake(setupTake)
        setScreen('aiSetup')
      } else setScreen(groupPathId ? 'groups' : storedTeamSession ? 'team' : debate?.status === 'active' ? (debate.ai ? 'aiDebate' : 'debate') : result?.ai ? 'aiResults' : result ? 'results' : 'home')
      setHydratedUserId(userId)
    }).catch(caught => { if (active) setDataError(caught instanceof Error ? caught.message : 'Private data could not be loaded.') })
    return () => { active = false }
  }, [repository, userId])

  useEffect(() => {
    if (!repository || !userId || hydratedUserId !== userId) return
    void repository.loadStats(userId).then(setStatsSnapshot).catch(caught => setDataError(caught instanceof Error ? caught.message : 'Private statistics could not be loaded.'))
  }, [hydratedUserId, repository, screen, userId])

  useEffect(() => {
    if (!repository || !userId || hydratedUserId !== userId || screen !== 'debate' || !debateId) return
    const debate: DebateSnapshot = { id: debateId, takeId: activeTake.id, mode: activeMode, step: debateStep, stance, postStance, confidence, understanding, responses, opponentMessages, assignedSide: assignSide(stance, activeMode, activeTake), language, status: 'active', updatedAt: new Date().toISOString() }
    void queueClassicDebateSave(debate).catch(caught => setDataError(caught instanceof Error ? caught.message : 'Private debate data could not be saved.'))
  }, [activeMode, activeTake.id, debateId, debateStep, hydratedUserId, language, opponentMessages, postStance, repository, responses, screen, stance, confidence, understanding, userId])

  useEffect(() => {
    if (!repository || !userId || hydratedUserId !== userId || screen !== 'aiDebate' || !debateId || !aiConfig || !aiSnapshot) return
    if (aiCompletionRef.current.has(debateId)) return
    const currentDebateId = debateId
    const timeout = window.setTimeout(() => {
      if (aiCompletionRef.current.has(currentDebateId)) return
      const debate: DebateSnapshot = { id: debateId, takeId: activeTake.id, mode: 'classic', step: aiSnapshot.roundLimit, stance: 1, postStance: 1, confidence: 4, understanding: 'yes', responses: {}, opponentMessages: {}, assignedSide: aiConfig.userSide, language, status: 'active', updatedAt: new Date().toISOString(), ai: aiSnapshot }
      void repository.saveDebate(userId, debate).catch(caught => setDataError(caught instanceof Error ? caught.message : 'Private AI debate data could not be saved.'))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [activeTake.id, aiConfig, aiSnapshot, debateId, hydratedUserId, language, repository, screen, userId])

  useEffect(() => {
    let active = true
    if (mockAi) {
      setAiRuntime(createAiRuntimeSnapshot({ mock: true, puterStatus: 'disconnected', basicServerAvailable: false }))
      return () => { active = false }
    }
    setAiRuntime(createAiRuntimeSnapshot({ mock: false, puterStatus: 'disconnected', basicServerAvailable: false }))
    Promise.allSettled([
      apiFetch<{ persistence: string; ai?: { basicServerAvailable?: boolean } }>('/api/health'),
      aiProvider.getStatus(),
    ]).then(([health, puter]) => {
      if (!active) return
      const basicServerAvailable = health.status === 'fulfilled' && health.value.ai?.basicServerAvailable === true
      const puterStatus = puter.status === 'fulfilled' ? puter.value : 'failed'
      setAiRuntime(createAiRuntimeSnapshot({ mock: false, puterStatus, basicServerAvailable }))
      if (health.status === 'fulfilled' && repository && health.value.persistence && health.value.persistence !== repository.backend) setDataError('Frontend and API backends disagree: ' + repository.backend + ' vs ' + health.value.persistence + '.')
    })
    return () => { active = false }
  }, [aiProvider, mockAi, repository])

  async function completeOnboarding(name: string, nextInterests: string[]) {
    if (!online) throw new Error('You are offline. Reconnect before saving your private setup.')
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    const nextProfile = normalizeProfile({ ...profileData, id: userId, displayName: name, interfaceLanguage: language })
    const nextPreferences = normalizePreferences({ ...preferencesData, userId, topicPreferences: nextInterests, debateLanguages: [language], onboardingCompleted: true })
    await repository.saveProfile(nextProfile)
    await repository.savePreferences(nextPreferences)
    setProfileData(nextProfile); setPreferencesData(nextPreferences); setUserName(name); setInterests(nextInterests); setHasOnboarded(true); setScreen('home'); trackEvent('onboarding_completed', { interests_count: nextInterests.length }); notify('Preferences saved to your private account.')
  }

  async function saveProfileSettings(next: UserProfile) {
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    const normalized = normalizeProfile({ ...next, id: userId })
    await repository.saveProfile(normalized)
    setProfileData(normalized); setUserName(normalized.displayName || '')
  }

  async function savePreferenceSettings(next: UserPreferences) {
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    const normalized = normalizePreferences({ ...next, userId })
    await repository.savePreferences(normalized)
    clearAiSetupDraft()
    setPreferencesData(normalized); setInterests(normalized.topicPreferences); setLanguage(normalized.debateLanguages[0]); setActiveMode(normalized.preferredMode)
  }

  function beginAiSetup(take = activeTake, preset?: Partial<AiStartConfig>) {
    setAiTake(take)
    setAiPreset(preset)
    setScreen('aiSetup')
  }

  function beginDebateChoice(take = activeTake) {
    setActiveTake(take)
    setScreen('debateChoice')
  }

  function beginDebateEntry(take = activeTake) {
    if (preferencesData.preferredOpponentType === 'ai') return beginAiSetup(take)
    if (preferencesData.preferredOpponentType === 'person') { setActiveTake(take); setScreen('clash'); return }
    beginDebateChoice(take)
  }

  async function saveTeamSession(next: TeamDebateSession) {
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    const owned = next.facilitatorId === userId ? next : { ...next, facilitatorId: userId }
    setTeamSession(owned)
    await repository.saveTeamSession(userId, owned)
    if (owned.status === 'completed' && owned.groupId && !teamCompletionRef.current.has(owned.id)) {
      teamCompletionRef.current.add(owned.id)
      await repository.recordGroupParticipation(userId, owned.groupId, 20).catch(caught => notify(caught instanceof Error ? caught.message : 'Group points could not be recorded.'))
    }
  }

  async function startTeamSession(next: TeamDebateSession) {
    if (!userId) throw new Error('Authentication is not ready yet.')
    teamCompletionRef.current.delete(next.id)
    setActiveGroupId(next.groupId)
    setTeamInitialTopic(undefined)
    await saveTeamSession({ ...next, facilitatorId: userId })
    setScreen('team')
    trackEvent('debate_started', { mode: 'team', team_count: next.teams.length, team_format: next.format })
  }

  function openTeamDebate(topic?: GroupTopic | null, group?: GroupSummary) {
    setActiveGroupId(group?.id || null)
    if (topic) {
      setActiveTake(privateTake(topic.statement, activeTake))
      setTeamInitialTopic({ statement: topic.statement, context: topic.context, takeId: null, custom: true })
    } else {
      setTeamInitialTopic(undefined)
    }
    setTeamSession(null)
    setScreen('team')
  }

  async function startAiDebate(config: AiStartConfig, take: Take) {
    if (!online) throw new Error('Reconnect before starting an AI debate.')
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    if (!config.opponent.model) throw new Error('The selected AI model is no longer available. Refresh the opponent list.')
    const nextPreferences = normalizePreferences({ ...preferencesData, preferredAiFamily: config.opponent.family, preferredOpponentId: config.opponent.id, preferredAiModelId: config.opponent.model?.id || null, aiDifficulty: config.difficulty, aiRoundLength: config.roundLength, aiQuality: config.quality, aiResponseLength: config.responseLength })
    setPreferencesData(nextPreferences)
    void repository.savePreferences(nextPreferences).catch(caught => setDataError(caught instanceof Error ? caught.message : 'AI preferences could not be saved.'))
    const id = makeUuid()
    const snapshot: AiDebateData = { opponentId: config.opponent.id, family: config.opponent.family, modelId: config.opponent.model.id, difficulty: config.difficulty, roundLength: config.roundLength, quality: config.quality, responseLength: config.responseLength, modelSelection: config.modelSelection, roundLimit: aiRoundLimit(config.roundLength), userSide: config.userSide, aiSide: config.aiSide, customMotion: config.customMotion, transcript: [], partialResponse: '', interrupted: false, completionReason: null }
    const debate: DebateSnapshot = { id, takeId: take.id, mode: 'classic', step: 0, stance: 1, postStance: 1, confidence: 4, understanding: 'yes', responses: {}, opponentMessages: {}, assignedSide: config.userSide, language, status: 'active', updatedAt: new Date().toISOString(), ai: snapshot }
    await repository.saveDebate(userId, debate)
    setActiveTake(take); setAiTake(take); setAiConfig(config); setAiSnapshot(snapshot); setActiveMode('classic'); setDebateId(id); setDebateStep(0); setLastResult(null); setScreen('aiDebate')
    trackEvent(history.length ? 'second_debate_started' : 'debate_started', { mode: 'classic', ai_opponent: config.opponent.id, ai_round_length: config.roundLength })
  }

  async function completeAiDebate(transcript: AiDebateData['transcript']) {
    if (!repository || !userId || !debateId || !aiConfig || !aiSnapshot) throw new Error('The active AI debate is not available.')
    const currentDebateId = debateId
    if (aiCompletionRef.current.has(currentDebateId)) return
    aiCompletionRef.current.add(currentDebateId)
    const currentSnapshot = aiSnapshot
    const contextTranscript = transcript.map(turn => ({ role: turn.role === 'opponent' ? 'assistant' as const : 'user' as const, round: turn.round, content: turn.content }))
    let evaluation: AiEvaluationData | undefined
    try {
      const response = await aiProvider.evaluate(buildEvaluationContext({ motion: currentSnapshot.customMotion || takeText(aiTake, language).statement, userSide: aiConfig.userSide, aiSide: aiConfig.aiSide, language, transcript: contextTranscript }), currentSnapshot.modelId)
      evaluation = response
    } catch (caught) {
      notify(`AI review unavailable: ${caught instanceof Error ? caught.message : 'the review request failed.'}`)
    }
    const now = new Date().toISOString()
    const scoreRows = evaluation ? [
      { label: 'Clarity', score: evaluation.clarity, explanation: evaluation.strongestPoint },
      { label: 'Relevance', score: evaluation.relevance, explanation: evaluation.missedCounterargument },
      { label: 'Reasoning', score: evaluation.reasoning, explanation: evaluation.weakestAssumption },
      { label: 'Rebuttal', score: evaluation.rebuttal, explanation: evaluation.missedCounterargument },
      { label: 'Fairness', score: evaluation.fairness, explanation: evaluation.argumentDna },
    ] : []
    const completedSnapshot: AiDebateData = { ...currentSnapshot, transcript, partialResponse: '', interrupted: false, completionReason: 'completed' }
    const result: ResultData = { id: makeUuid(), debateId: currentDebateId, score: evaluation ? scoreRows.reduce((sum, item) => sum + item.score, 0) : null, movement: 0, understanding: 'yes', mode: 'classic', take: aiTake, assignedSide: aiConfig.userSide, transcript: transcript.map(turn => ({ role: turn.role, round: turn.round, content: turn.content })), scores: scoreRows, coaching: evaluation?.argumentDna || 'AI review unavailable. Your completed debate was preserved without an invented score.', completedAt: now, ai: { opponentId: aiConfig.opponent.id, family: aiConfig.opponent.family, modelId: currentSnapshot.modelId, difficulty: aiConfig.difficulty, roundLength: aiConfig.roundLength, quality: aiConfig.quality, responseLength: aiConfig.responseLength, modelSelection: aiConfig.modelSelection, roundLimit: currentSnapshot.roundLimit, customMotion: currentSnapshot.customMotion, evaluationAvailable: Boolean(evaluation), evaluation } }
    const completedDebate: DebateSnapshot = { id: currentDebateId, takeId: aiTake.id, mode: 'classic', step: currentSnapshot.roundLimit, stance: 1, postStance: 1, confidence: 4, understanding: 'yes', responses: {}, opponentMessages: {}, assignedSide: aiConfig.userSide, language, status: 'completed', updatedAt: now, ai: completedSnapshot }
    try {
      await repository.saveDebate(userId, completedDebate)
      await repository.saveResult(userId, result)
      const nextHistory = [result, ...history.filter(item => item.id !== result.id)].slice(0, 20)
      setLastResult(result); setHistory(nextHistory); setAiSnapshot(completedSnapshot); setDebateId(''); setScreen('aiResults'); setStatsSnapshot(current => ({ ...current, activityDates: [...current.activityDates, now] })); trackEvent('debate_completed', { score: result.score, movement: 0, ai_opponent: aiConfig.opponent.id })
    } catch (caught) {
      aiCompletionRef.current.delete(currentDebateId)
      notify(caught instanceof Error ? 'AI result could not be saved: ' + caught.message : 'AI result could not be saved. Try again.')
    }
  }

  async function exitAiDebate() {
    if (repository && userId && debateId && aiConfig && aiSnapshot) {
      await repository.saveDebate(userId, { id: debateId, takeId: aiTake.id, mode: 'classic', step: aiSnapshot.roundLimit, stance: 1, postStance: 1, confidence: 4, understanding: 'yes', responses: {}, opponentMessages: {}, assignedSide: aiConfig.userSide, language, status: 'active', updatedAt: new Date().toISOString(), ai: aiSnapshot }).catch(() => undefined)
    }
    setScreen('home')
  }

  async function recordAiFeedback(feedbackType: AiFeedbackType) {
    if (!repository || !userId || !debateId || !aiConfig) return
    try { await repository.recordAiFeedback(userId, { debateId, opponentId: aiConfig.opponent.id, modelId: aiConfig.opponent.model?.id || '', feedbackType }); notify('Thanks — your private AI quality feedback was saved.') } catch (caught) { notify(caught instanceof Error ? caught.message : 'AI quality feedback could not be saved.') }
  }

  async function persistDebateRound(nextStep: number, response: string | null, opponentMessage: string) {
    if (!repository || !userId || !debateId) return
    const responseStep = nextStep - 1
    const nextResponses = response ? { ...responses, [responseStep]: response } : responses
    const nextOpponentMessages = opponentMessage ? { ...opponentMessages, [responseStep]: opponentMessage } : opponentMessages
    const snapshot: DebateSnapshot = { id: debateId, takeId: activeTake.id, mode: activeMode, step: nextStep, stance, postStance, confidence, understanding, responses: nextResponses, opponentMessages: nextOpponentMessages, assignedSide: assignSide(stance, activeMode, activeTake), language, status: 'active', updatedAt: new Date().toISOString() }
    await queueClassicDebateSave(snapshot)
  }
  async function beginDebate(mode: Mode, take = activeTake) {
    if (!online) return notify('Reconnect before starting a debate.')
    if (!repository || !userId) return
    const id = makeUuid()
    const snapshot: DebateSnapshot = { id, takeId: take.id, mode, step: 0, stance: 1, postStance: 1, confidence: 4, understanding: 'yes', responses: {}, opponentMessages: {}, assignedSide: assignSide(1, mode, take), language, status: 'active', updatedAt: new Date().toISOString() }
    try {
      await queueClassicDebateSave(snapshot)
      setActiveTake(take); setActiveMode(mode); setDebateId(id); setDebateStep(0); setStance(1); setPostStance(1); setConfidence(4); setUnderstanding('yes'); setResponses({}); setOpponentMessages({}); setLastResult(null); setScreen('debate'); trackEvent(history.length ? 'second_debate_started' : 'debate_started', { mode })
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'The debate could not be started. Try again.') }
  }

  async function completeDebate() {
    if (!online) throw new Error('You are offline. Reconnect before requesting a result.')
    if (!repository || !userId || !debateId) throw new Error('The active debate is not available.')
    const transcript = Object.keys(responses).sort((a, b) => Number(a) - Number(b)).flatMap(key => { const round = Number(key); const user = responses[round] ? [{ role: 'user' as const, round, content: responses[round] }] : []; const opponent = opponentMessages[round] ? [{ role: 'opponent' as const, round, content: opponentMessages[round] }] : []; return [...user, ...opponent] })
    let judge: ReturnType<typeof calculateMockScore>
    try {
      judge = await apiFetch<ReturnType<typeof calculateMockScore>>('/api/ai/judge', { method: 'POST', body: JSON.stringify({ transcript, language }) })
    } catch {
      setAiRuntime(current => ({ ...current, primary: 'basic_server_unavailable', basicServer: 'basic_server_unavailable' }))
      if (import.meta.env.MODE === 'production') throw new Error('Server AI scoring is unavailable. No simulated score was added.')
      judge = calculateMockScore(responses, understanding, movementBetween(stance, postStance))
      notify('Development mock scoring was used because server AI was unavailable.')
    }
    const now = new Date().toISOString()
    const result: ResultData = { id: makeUuid(), debateId, score: judge.total, movement: movementBetween(stance, postStance), understanding, mode: activeMode, take: activeTake, assignedSide: assignSide(stance, activeMode, activeTake), transcript, scores: judge.scores, coaching: judge.coaching, completedAt: now }
    const completedDebate: DebateSnapshot = { id: debateId, takeId: activeTake.id, mode: activeMode, step: 6, stance, postStance, confidence, understanding, responses, opponentMessages, assignedSide: assignSide(stance, activeMode, activeTake), language, status: 'completed', updatedAt: now }
    await queueClassicDebateSave(completedDebate)
    await repository.saveResult(userId, result)
    const nextHistory = [result, ...history.filter(item => item.id !== result.id)].slice(0, 20)
    await repository.saveHistory(userId, nextHistory)
    setLastResult(result); setHistory(nextHistory); setDebateId(''); setDebateStep(0); setScreen('results'); trackEvent('debate_completed', { score: result.score, movement: result.movement })
    setStatsSnapshot(current => ({ ...current, activityDates: [...current.activityDates, now] }))
  }

  async function submitReport(payload: ReportInput) {
    if (!online) throw new Error('You are offline. Reconnect before submitting a report.')
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    await repository.submitReport(userId, { ...payload, debateId: payload.debateId || debateId || null })
    trackEvent('report_submitted', { content_type: payload.reportedContentType })
  }

  async function submitBetaFeedback(payload: BetaFeedbackInput) {
    if (!online) throw new Error('Reconnect before sending beta feedback.')
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    await repository.submitBetaFeedback(userId, payload)
  }

  async function deleteBetaData() {
    if (!repository || !userId) return
    if (!window.confirm('Delete your SideShift beta data? This removes your profile, preferences, debates, results, challenges, reports, and local rate-limit records. A friend’s challenge answer is retained without your identity.')) return
    try {
      await repository.deleteMyBetaData(userId)
      notify('Your beta data was deleted. Signing you out now.')
      await auth.resetSession()
      if (repository.backend === 'local') window.location.reload()
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Your beta data could not be deleted.') }
  }

  if (auth.loading) return <BackendGate title="Connecting…" message="Establishing your private SideShift session." />
  if (auth.error) return <BackendGate title="Private session unavailable" message={auth.error} action={{ label: 'Retry connection', onClick: auth.retry }} />
  if (legalPath === '/privacy') return <LegalPage kind="privacy" />
  if (legalPath === '/terms') return <LegalPage kind="terms" />
  if (legalPath === '/community') return <LegalPage kind="community" />
  if (!repository || !userId) return <BackendGate title="Backend unavailable" message="SideShift could not establish an authenticated data path." action={{ label: 'Retry connection', onClick: auth.retry }} />
  if (challengeToken) return <ChallengeRecipient token={challengeToken} repository={repository} userId={userId} />
  if (dataError) return <BackendGate title="Private data unavailable" message={dataError} action={{ label: 'Retry session', onClick: auth.retry }} />
  if (hydratedUserId !== userId) return <BackendGate title="Loading your space…" message="Restoring your private debates and preferences." />
  if (!hasOnboarded) return <Onboarding onComplete={completeOnboarding} />
  const hasUnsavedDraft = screen === 'debate' ? Boolean(responses[debateStep]?.trim()) : screen === 'aiDebate' ? hasArgumentDraft(`ai:${debateId}`) || Boolean(aiSnapshot?.partialResponse) : false
  function navigate(next: Screen) {
    if (next === 'results' && !lastResult) return notify('Complete a debate to unlock your shifts.')
    if (next === screen) return
    if (hasUnsavedDraft && !window.confirm('You have an unsent argument. Leave it saved and return later?')) return
    setScreen(next)
  }
  const legacyChildren = screen === 'aiSetup' ? <AiSetup provider={aiProvider} take={aiTake} language={language} preferences={preferencesData} preset={aiPreset} mock={mockAi} onStart={startAiDebate} onBack={() => setScreen('home')} /> : screen === 'aiDebate' && aiConfig && aiSnapshot ? <AiDebate provider={aiProvider} take={aiTake} language={language} config={aiConfig} snapshot={aiSnapshot} draftId={debateId} onSnapshot={setAiSnapshot} onComplete={completeAiDebate} onExit={() => void exitAiDebate()} onFeedback={recordAiFeedback} onNotify={notify} /> : screen === 'aiResults' && lastResult ? <><AiResults result={lastResult} onRematch={() => beginAiSetup(aiTake, aiConfig ? { ...aiConfig } : undefined)} onSwap={() => { if (aiConfig) void startAiDebate({ ...aiConfig, userSide: aiConfig.aiSide, aiSide: aiConfig.userSide }, aiTake).catch(caught => notify(caught instanceof Error ? caught.message : 'The AI rematch could not start.')) }} onChangeOpponent={() => beginAiSetup(aiTake)} onAnotherTake={() => beginAiSetup(selectPersonalizedTakes(interests, history.map(result => result.take.id), 1)[0] || takes[0])} /><BetaFeedbackForm language={language} surface="debate_result" screen="aiResults" aiModelId={lastResult.ai?.modelId} onSubmit={submitBetaFeedback} /></> : screen === 'debateChoice' ? <DebateTypeChoice take={activeTake} language={language} onBack={() => setScreen('home')} onAi={() => beginAiSetup(activeTake)} onPerson={() => setScreen('clash')} /> : screen === 'home' ? <PersonalHome userName={userName} language={language} interests={interests} history={history} stats={personalStats} activeDebate={Boolean(debateId)} lastResult={lastResult} preferredMode={preferencesData.preferredMode} onBegin={beginDebate} onChooseDebate={beginDebateChoice} onResume={() => setScreen(aiSnapshot && aiConfig ? 'aiDebate' : 'debate')} onExplore={() => setScreen('explore')} onClash={() => setScreen('clash')} onProfile={() => setScreen('profile')} onSettings={() => setScreen('settings')} onNotify={notify} /> : screen === 'explore' ? <PersonalExplore language={language} interests={interests} recentIds={history.map(result => result.take.id)} onBegin={beginDebate} onChooseDebate={beginDebateChoice} onNotify={notify} /> : screen === 'debate' ? <Debate activeTake={activeTake} language={language} mode={activeMode} step={debateStep} setStep={setDebateStep} stance={stance} setStance={setStance} confidence={confidence} setConfidence={setConfidence} postStance={postStance} setPostStance={setPostStance} understanding={understanding} setUnderstanding={setUnderstanding} responses={responses} setResponses={setResponses} opponentMessages={opponentMessages} setOpponentMessages={setOpponentMessages} onModeChange={setActiveMode} onComplete={completeDebate} onExit={() => setScreen('home')} onNotify={notify} onReport={submitReport} onPersistRound={persistDebateRound} aiMode={aiMode} /> : screen === 'results' && lastResult ? <><Results result={lastResult} language={language} onBegin={beginDebate} onClash={() => setScreen('clash')} onNotify={notify} /><BetaFeedbackForm language={language} surface="debate_result" screen="results" onSubmit={submitBetaFeedback} /></> : screen === 'clash' ? <FriendClash userId={userId} language={language} repository={repository} initialTake={activeTake} onBack={() => setScreen('home')} onBegin={beginDebate} onNotify={notify} /> : screen === 'profile' ? <PersonalProfile profile={profileData} language={language} stats={personalStats} history={history} onSettings={() => setScreen('settings')} onBack={() => setScreen('home')} /> : <SettingsScreen profile={profileData} preferences={preferencesData} aiMode={aiMode} backendLabel={repository.backend === 'supabase' ? 'Private cloud beta' : 'Device-only development'} onSaveProfile={saveProfileSettings} onSavePreferences={savePreferenceSettings} onDelete={() => void deleteBetaData()} onBack={() => setScreen('home')} onNotify={notify} onSubmitFeedback={submitBetaFeedback} />
// Active tree: App -> AppShellV2 -> screen-specific children. Legacy variants remain compatibility code; they are not the active shell path.
  const children = screen === 'groups' ? <Groups userId={userId} language={language} repository={repository} initialGroupId={groupPathId} onStartTeam={openTeamDebate} onBack={() => setScreen('home')} onNotify={notify} /> : screen === 'team' ? <TeamDebate userId={userId} language={language} initialTake={activeTake} initialTopic={teamInitialTopic} groupId={activeGroupId} session={teamSession} onStart={startTeamSession} onSave={saveTeamSession} onBack={() => setScreen('home')} onNotify={notify} /> : screen === 'debateChoice' ? <DebateTypeChoiceExpanded take={activeTake} language={language} onBack={() => setScreen('home')} onAi={() => beginAiSetup(activeTake)} onPerson={() => setScreen('clash')} onTeam={() => openTeamDebate()} /> : legacyChildren
  return <AppShellV2 screen={screen} name={userName} historyCount={history.length} onNavigate={navigate} onLanguage={() => { setLanguage(current => current === 'en' ? 'de' : 'en'); notify(language === 'en' ? 'German take text enabled.' : 'English take text enabled.') }} language={language} aiMode={aiMode} onNotify={notify} online={online} onDelete={() => void deleteBetaData()} hasUnsavedDraft={hasUnsavedDraft}>{repository.backend === 'local' && <div className="backend-warning" role="status">Development only: local persistence is active.</div>}{children}{toast && <div className="toast" role="status"><Icon name="info" size={15} /> {toast}</div>}{showGuide && <FirstUseGuide language={language} onClose={() => { markFirstUseGuideSeen(); setShowGuide(false) }} />}</AppShellV2>
}

export default App
