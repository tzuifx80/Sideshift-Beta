import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, Icon, Logo, Tag, type IconName } from './components/SideShiftUI'
import { AvatarPhotoPicker } from './components/AvatarPhotoPicker'
import { ProfileAvatar } from './components/ProfileAvatar'
import { getProfileAvatarSnapshot, publishProfileAvatar, subscribeToProfileAvatar } from './profileAvatarStore'
import {
  assignSide,
  calculateMockScore,
  getTake,
  makeUuid,
  movementBetween,
  personalizeTakes,
  selectPersonalizedTakes,
  takeText,
  takes,
  interestOptions,
  type DebateSnapshot,
  type AiDebateData,
  type Language,
  type Mode,
  type ResultData,
  type Stance,
  type Take,
} from './domain'
import { AiDebate, AiResults, AiSetup } from './AiMode'
import { buildEvaluationContext } from './lib/ai/contextBuilder'
import { aiDebateMotion, createAiDebateCompletionGuard, runAiDebateCompletion } from './aiDebateCompletion'
import { createMockAiProvider, createUnavailableAiProvider } from './lib/ai/provider'
import { getOpponent } from './lib/ai/opponents'
import { createBasicAiProvider } from './lib/ai/basicProvider'
import { aiRuntimeLabel, createAiRuntimeSnapshot } from './lib/ai/runtimeStatus'
import type { AiFeedbackType, AiModel, AiProvider, AiRuntimeSnapshot, AiStartConfig, ResolvedOpponent } from './lib/ai/types'
import { useAuth } from './auth/useAuth'
import type { AppRepository, BetaFeedbackCategory, BetaFeedbackInput, ReportInput } from './data/repository'
import type { UserPreferences, UserProfile, UserStatsSnapshot } from './data/types'
import { accentThemes, appearanceLabels, avatarPresets, defaultProfileFieldVisibility, normalizePreferences, normalizeProfile, textSizeLabels } from './profile'
import { calculatePersonalStats, type PersonalStats } from './stats'
import { applyTheme } from './theme'
import { setAnalyticsAccessToken, trackEvent } from './analytics'
import { registerServiceWorker, useInstallPrompt, useOnlineStatus, useServiceWorkerUpdate } from './pwa'
import { clearAiSetupDraft, hasArgumentDraft, loadAiSetupDraft } from './drafts'
import { FirstUseGuide, hasSeenFirstUseGuide, markFirstUseGuideSeen } from './FirstUseGuide'
import { initializeCapacitorBridge } from './capacitor'
import { Groups } from './Groups'
import { Friends } from './Friends'
import { TeamDebate } from './TeamDebate'
import { WorldPulsePanel } from './features/world-pulse/WorldPulsePanel'
import { buildWorldPulseTake, type WorldPulseItem } from './worldPulse'
import { apiFetch } from './data/api'
import type { GroupSummary, GroupTopic, TeamDebateSession } from './collaboration'
import { getInitialLanguage, greetingKey, localizeInterest, localeLabels, persistLanguage, readStoredLanguage, supportedLanguages, translate, useTranslations } from './i18n'
import { onboardingStorageKey, parseOnboardingProgress, serializeOnboardingProgress } from './lib/onboardingProgress'
import { ProfileSettings } from './ProfileSettings'
import { ProfileViewScreen } from './ProfileView'
import { EmailOtpFlow } from './auth/EmailOtpFlow'

const ClassicDebateSetup = lazy(async () => ({ default: (await import('./features/classic-debate/ClassicDebateSetup')).ClassicDebateSetup }))
const ClassicDebateSession = lazy(async () => ({ default: (await import('./features/classic-debate/ClassicDebateSession')).ClassicDebateSession }))
const ClassicDebateResult = lazy(async () => ({ default: (await import('./features/results/ClassicDebateResult')).ClassicDebateResult }))
const FriendClashSetup = lazy(async () => ({ default: (await import('./features/friend-clash/FriendClashSetup')).FriendClashSetup }))
const FriendClashRecipient = lazy(async () => ({ default: (await import('./features/friend-clash/ChallengeRecipient')).ChallengeRecipient }))
const WorldPulseAdmin = lazy(async () => ({ default: (await import('./features/world-pulse/WorldPulseAdmin')).WorldPulseAdmin }))

type Screen = 'home' | 'explore' | 'friends' | 'groups' | 'team' | 'debateChoice' | 'debate' | 'results' | 'clash' | 'profile' | 'profileView' | 'settings' | 'aiSetup' | 'aiDebate' | 'aiResults'
type AiMode = AiRuntimeSnapshot['primary']
type BeginHandler = (mode: Mode, take?: Take) => void | Promise<void>

function FeatureLoading({ language }: { language: Language }) {
  return <div className="page"><p className="muted">{translate(language, 'common.loading')}</p></div>
}


function defaultProfile(id: string): UserProfile {
  return { id, displayName: null, bio: null, avatarPreset: 'orbit', interfaceLanguage: 'en', challengeShowName: false, shareRealStance: false, publicProfileKey: null, handle: null, friendCode: null, avatarPath: null, profileAccent: 'coral', profileVisibility: 'friends', avatarVisibility: 'private', fieldVisibility: { ...defaultProfileFieldVisibility }, visibleStats: { debates: true, sideSwitches: true, constructive: true, argumentDna: false }, socialLinks: [] }
}

function defaultPreferences(userId: string): UserPreferences {
  return { userId, topicPreferences: [], debateLanguages: ['en'], intensity: 'balanced', preferredMode: 'sideswitch', preferredAiStyle: 'sharp-skeptic', preferredOpponentType: 'ask', preferredAiFamily: 'GPT', preferredOpponentId: 'gpt-logician', preferredAiModelId: null, aiDifficulty: 'intermediate', aiRoundLength: 'standard', aiQuality: 'balanced', aiResponseLength: 'standard', showModelDetails: false, theme: 'system', accent: 'coral', reducedMotion: false, textSize: 'comfortable', shareRealStance: false, onboardingCompleted: false, onboardingStage: 0, onboardingGoal: 'reasoning', onboardingDismissed: false, hideSensitiveWorldPulse: false }
}

const emptyStatsSnapshot: UserStatsSnapshot = { challengeCreated: 0, challengeResponses: 0, activityDates: [] }

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

function OfflineBanner({ online, language }: { online: boolean; language: Language }) {
  const t = useTranslations(language)
  return online ? null : <div className="offline-banner" role="status"><Icon name="info" size={15} /> {t('classic.offline')}</div>
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

/* Legacy four-stage onboarding removed. The live route below is the three-stage mobile flow.
function OnboardingV3({ userId, language, initialProgress, onProgress, onComplete, onLanguageChange, onFirstAction, online }: { userId: string; language: Language; initialProgress?: { stage: number; goal: UserPreferences['onboardingGoal']; name: string; selected: string[] }; onProgress?: (stage: number, goal: UserPreferences['onboardingGoal'], name: string, selected: string[]) => Promise<void>; onComplete: (name: string, interests: string[], goal: UserPreferences['onboardingGoal']) => Promise<void>; onLanguageChange?: (language: Language) => void; onFirstAction?: (action: 'person' | 'team') => void; online?: boolean }) {
  const t = useTranslations(language)
  const key = onboardingStorageKey(userId)
  const savedProgress = parseOnboardingProgress(window.localStorage.getItem(key))
  const serverProgress = initialProgress && (initialProgress.stage > 0 || initialProgress.name || initialProgress.selected.length) ? { step: initialProgress.stage, name: initialProgress.name, selected: initialProgress.selected, goal: initialProgress.goal } : savedProgress
  const [step, setStep] = useState(serverProgress.step)
  const [name, setName] = useState(serverProgress.name || '')
  const [selected, setSelected] = useState(serverProgress.selected?.length ? serverProgress.selected : ['Politics and Democracy', 'Football', 'AI and Technology'])
  const [goal, setGoal] = useState(serverProgress.goal || 'reasoning')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  useEffect(() => { window.localStorage.setItem(key, serializeOnboardingProgress({ step, name, selected, goal })) }, [goal, key, name, selected, step])
  async function saveStep(next: number) { setStep(next); window.localStorage.setItem(key, serializeOnboardingProgress({ step: next, name, selected, goal })); try { await onProgress?.(next, goal as UserPreferences['onboardingGoal'], name, selected) } catch (caught) { setError(caught instanceof Error ? caught.message : t('onboarding.saveError')) } }
  async function finish(action: 'basic' | 'person' | 'team' | 'skip' = 'skip') {
    if (!isOnline) return setError(t('onboarding.offline'))
    if (name.trim().length < 2) return setError(t('onboarding.nameTooShort'))
    if (selected.length < 3) return setError(t('onboarding.interestsTooFew'))
    setBusy(true); setError('')
    try { await onComplete(name.trim(), selected, goal as UserPreferences['onboardingGoal']); window.localStorage.removeItem(key); if (action === 'basic') window.dispatchEvent(new Event('sideshift-basic-entry')); else if (action !== 'skip') onFirstAction?.(action) } catch (caught) { setError(caught instanceof Error ? caught.message : t('onboarding.saveError')) } finally { setBusy(false) }
  }
  const goals = [['reasoning', t('onboarding.goalReasoning')], ['school', t('onboarding.goalSchool')], ['friends', t('onboarding.goalFriends')], ['perspectives', t('onboarding.goalPerspectives')], ['fun', t('onboarding.goalFun')]] as const
  return <div className="onboarding-page"><div className="onboarding-top"><Logo /><span className="onboarding-meta"><Icon name="lock" size={14} /> {t('onboarding.privateByDefault')}</span></div><div className="onboarding-layout"><section className="onboarding-copy"><Tag tone="coral">{t('onboarding.eyebrow')}</Tag><h1>{step === 0 ? t('onboarding.welcomeTitle') : t('onboarding.title')}</h1><p className="onboarding-lede">{t('onboarding.welcomeBody')}</p><small className="step-count">{step + 1} / 4</small></section><section className="onboarding-card" aria-live="polite">{step === 0 && <><span className="eyebrow">{t('onboarding.stageWelcome')}</span><h2>{t('onboarding.welcomeTitle')}</h2><p className="muted">{t('onboarding.welcomeBody')}</p><label className="field-label" htmlFor="onboarding-language">{t('settings.interfaceLanguage')}</label><select id="onboarding-language" className="settings-select" value={language} onChange={event => { const next = event.target.value as Language; persistLanguage(next); onLanguageChange?.(next); window.dispatchEvent(new Event('sideshift-onboarding-language')) }}>{supportedLanguages.map(item => <option value={item} key={item}>{localeLabels[item]}</option>)}</select><Button className="full-width" icon="arrow" onClick={() => saveStep(1)}>{t('common.continue')}</Button></>}{step === 1 && <><span className="eyebrow">{t('onboarding.stagePersonalize')}</span><h2>{t('onboarding.callYou')}</h2><label className="field-label" htmlFor="onboarding-name">{t('onboarding.displayName')}</label><input id="onboarding-name" className="text-input" value={name} onChange={event => setName(event.target.value)} maxLength={24} autoComplete="nickname" /><div className="setup-divider" /><span className="field-label">{t('onboarding.arenas')}</span><div className="interest-grid">{interestOptions.map(interest => <button type="button" key={interest} className={`interest-chip ${selected.includes(interest) ? 'selected' : ''}`} aria-pressed={selected.includes(interest)} onClick={() => setSelected(current => current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest])}>{localizeInterest(interest, language)}</button>)}</div><span className="field-label">{t('onboarding.goal')}</span><div className="interest-grid">{goals.map(([value, label]) => <button type="button" key={value} className={`interest-chip ${goal === value ? 'selected' : ''}`} aria-pressed={goal === value} onClick={() => setGoal(value)}>{label}</button>)}</div><Button className="full-width" icon="arrow" onClick={() => selected.length >= 3 && name.trim().length >= 2 ? saveStep(2) : setError(selected.length < 3 ? t('onboarding.interestsTooFew') : t('onboarding.nameTooShort'))}>{t('common.continue')}</Button></>}{step === 2 && <><span className="eyebrow">{t('onboarding.stageChoose')}</span><h2>{t('onboarding.chooseStart')}</h2><p className="muted">{t('onboarding.chooseStartBody')}</p><div className="onboarding-choice-list"><p><strong>{t('ai.basicTitle')}</strong> — {t('ai.basicBody')}</p><p><strong>{t('ai.connectPuter')}</strong> — {t('ai.puterBody')}</p><p><strong>{t('onboarding.personChoice')}</strong> — {t('onboarding.personChoiceBody')}</p><p><strong>{t('onboarding.teamChoice')}</strong> — {t('onboarding.teamChoiceBody')}</p></div><Button className="full-width" icon="arrow" onClick={() => saveStep(3)}>{t('common.continue')}</Button></>}{step === 3 && <><span className="eyebrow">{t('onboarding.stageAction')}</span><h2>{t('onboarding.firstAction')}</h2><p className="muted">{t('onboarding.firstActionBody')}</p><div className="onboarding-actions"><Button icon="spark" onClick={() => void finish('basic')} disabled={busy}>{t('onboarding.practiceBasic')}</Button><Button variant="secondary" onClick={() => void finish('person')} disabled={busy}>{t('onboarding.createChallenge')}</Button><Button variant="secondary" onClick={() => void finish('team')} disabled={busy}>{t('onboarding.startTeam')}</Button></div></>}{error && <p className="form-error" role="alert">{error}</p>}<button type="button" className="text-link" onClick={() => void finish()} disabled={busy}>{t('onboarding.skip')}</button></section></div></div>
}

*/
type OnboardingProps = { userId: string; language: Language; initialProgress?: { stage: number; goal: UserPreferences['onboardingGoal']; name: string; selected: string[] }; onProgress?: (stage: number, goal: UserPreferences['onboardingGoal'], name: string, selected: string[]) => Promise<void>; onComplete: (name: string, interests: string[], goal: UserPreferences['onboardingGoal']) => Promise<void>; onLanguageChange?: (language: Language) => void; onFirstAction?: (action: 'person' | 'team') => void; online?: boolean }

function MobileOnboarding({ userId, language, initialProgress, onProgress, onComplete, onLanguageChange, online }: OnboardingProps) {
  const t = useTranslations(language)
  const key = onboardingStorageKey(userId)
  const saved = parseOnboardingProgress(window.localStorage.getItem(key))
  const server = initialProgress && (initialProgress.stage > 0 || initialProgress.name || initialProgress.selected.length) ? { step: initialProgress.stage, name: initialProgress.name, selected: initialProgress.selected, goal: initialProgress.goal } : saved
  const [step, setStep] = useState(server.step)
  const [name, setName] = useState(server.name)
  const [selected, setSelected] = useState(server.selected.length ? server.selected : ['Politics and Democracy', 'Football', 'AI and Technology'])
  const [goal, setGoal] = useState(server.goal as UserPreferences['onboardingGoal'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  useEffect(() => { window.localStorage.setItem(key, serializeOnboardingProgress({ step, name, selected, goal })) }, [goal, key, name, selected, step])
  async function move(next: number) { setError(''); setStep(next); try { await onProgress?.(next, goal, name, selected) } catch (caught) { setError(caught instanceof Error ? caught.message : t('onboarding.saveError')) } }
  async function finish() {
    if (!isOnline) return setError(t('onboarding.offline'))
    if (name.trim().length < 2) return setError(t('onboarding.nameTooShort'))
    if (selected.length < 3) return setError(t('onboarding.interestsTooFew'))
    setBusy(true); setError('')
    try { await onComplete(name.trim(), selected, goal); window.localStorage.removeItem(key); window.dispatchEvent(new Event('sideshift-basic-entry')) } catch (caught) { setError(caught instanceof Error ? caught.message : t('onboarding.saveError')) } finally { setBusy(false) }
  }
  async function skip() {
    if (!isOnline) return setError(t('onboarding.offline'))
    setBusy(true); setError('')
    try { await onComplete(name.trim() || t('onboarding.yourName'), selected.length >= 3 ? selected : ['Politics and Democracy', 'Football', 'AI and Technology'], goal); window.localStorage.removeItem(key) } catch (caught) { setError(caught instanceof Error ? caught.message : t('onboarding.saveError')) } finally { setBusy(false) }
  }
  const goals = [['reasoning', t('onboarding.goalReasoning')], ['school', t('onboarding.goalSchool')], ['friends', t('onboarding.goalFriends')], ['perspectives', t('onboarding.goalPerspectives')], ['fun', t('onboarding.goalFun')]] as const
  return <div className="onboarding-page onboarding-mobile"><div className="onboarding-top"><Logo /><span className="onboarding-meta"><Icon name="lock" size={14} /> {t('onboarding.privateByDefault')}</span></div><div className="onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label={t('onboarding.progress', { current: step + 1, total: 3 })}>{[0, 1, 2].map(item => <span key={item} className={item <= step ? 'active' : ''} />)}</div><main className="onboarding-mobile-main" aria-live="polite"><Tag tone="coral">{t('onboarding.eyebrow')}</Tag>{step === 0 && <section className="onboarding-mobile-panel"><div className="onboarding-visual" aria-hidden="true"><span>↗</span><i /><b /></div><span className="eyebrow">01 · {t('onboarding.privateByDefault')}</span><h1>{t('onboarding.welcomeTitle')}</h1><p>{t('onboarding.welcomeBody')}</p><label className="field-label" htmlFor="onboarding-language">{t('settings.interfaceLanguage')}</label><select id="onboarding-language" className="settings-select" value={language} onChange={event => { const next = event.target.value as Language; persistLanguage(next); onLanguageChange?.(next); window.dispatchEvent(new Event('sideshift-onboarding-language')) }}>{supportedLanguages.map(item => <option value={item} key={item}>{localeLabels[item]}</option>)}</select><Button className="full-width" icon="arrow" onClick={() => void move(1)}>{t('common.continue')}</Button></section>}{step === 1 && <section className="onboarding-mobile-panel"><span className="eyebrow">02 · SIDESWITCH</span><h1>{t('onboarding.switchTitle')}</h1><p>{t('onboarding.switchBody')}</p><div className="onboarding-example"><span className="eyebrow">SIDE A → SIDE B</span><strong>{t('onboarding.switchExample')}</strong></div><p className="onboarding-benefits">{t('onboarding.switchBenefits')}</p><Button className="full-width" icon="arrow" onClick={() => void move(2)}>{t('common.continue')}</Button></section>}{step === 2 && <section className="onboarding-mobile-panel"><span className="eyebrow">03 · {t('onboarding.personalizeTitle')}</span><h1>{t('onboarding.personalizeTitle')}</h1><p>{t('onboarding.personalizeBody')}</p><label className="field-label" htmlFor="onboarding-name">{t('onboarding.displayName')}</label><input id="onboarding-name" className="text-input" value={name} onChange={event => { setName(event.target.value); setError('') }} maxLength={24} autoComplete="nickname" placeholder={t('onboarding.yourName')} /><span className="field-label">{t('onboarding.arenas')}</span><div className="interest-grid">{interestOptions.map(interest => <button type="button" key={interest} className={`interest-chip ${selected.includes(interest) ? 'selected' : ''}`} aria-pressed={selected.includes(interest)} onClick={() => setSelected(current => current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest])}>{localizeInterest(interest, language)}</button>)}</div><span className="field-label">{t('onboarding.goal')}</span><div className="interest-grid">{goals.map(([value, label]) => <button type="button" key={value} className={`interest-chip ${goal === value ? 'selected' : ''}`} aria-pressed={goal === value} onClick={() => setGoal(value)}>{label}</button>)}</div><Button className="full-width" icon="arrow" onClick={() => void finish()} disabled={busy}>{busy ? t('common.loading') : t('onboarding.startMyFirstDebate')}</Button></section>}{error && <p className="form-error" role="alert">{error}</p>}<div className="onboarding-mobile-actions">{step > 0 && <button type="button" className="text-link" onClick={() => void move(step - 1)} disabled={busy}><Icon name="arrow" size={14} /> {t('common.back')}</button>}<button type="button" className="text-link" onClick={() => void skip()} disabled={busy}>{t('onboarding.skipShort')}</button></div></main></div>
}

function Onboarding({ userId, language, initialProgress, onProgress, onComplete, onLanguageChange, onFirstAction, online }: OnboardingProps) {
  return <MobileOnboarding userId={userId} language={language} initialProgress={initialProgress} onProgress={onProgress} onComplete={onComplete} onLanguageChange={onLanguageChange} onFirstAction={onFirstAction} online={online} />
  /* Legacy markup removed from the render path.
  const t = useTranslations(language)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(['Politics and Democracy', 'Football', 'AI and Technology'])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  async function submit() {
    if (!isOnline) return setError(t('onboarding.offline'))
    const trimmed = name.trim()
    if (trimmed.length < 2) return setError(t('onboarding.nameTooShort'))
    if (selected.length < 3) return setError(t('onboarding.interestsTooFew'))
    setBusy(true)
    try { await onComplete(trimmed, selected, 'reasoning') } catch (caught) { setError(caught instanceof Error ? caught.message : t('onboarding.saveError')) } finally { setBusy(false) }
  }
  return <div className="onboarding-page"><div className="onboarding-top"><Logo /><span className="onboarding-meta"><Icon name="lock" size={14} /> {t('onboarding.privateByDefault')}</span></div><div className="onboarding-layout"><section className="onboarding-copy"><Tag tone="coral">{t('onboarding.eyebrow')}</Tag><h1>{t('onboarding.title')}</h1><p className="onboarding-lede">{t('onboarding.body')}</p></section><section className="onboarding-card"><div className="onboarding-card-head"><span className="eyebrow">{t('onboarding.setup')}</span><span className="step-count">01 / 01</span></div><h2>{t('onboarding.callYou')}</h2><p className="muted">{t('onboarding.profilePrivate')}</p><label className="field-label" htmlFor="display-name">{t('onboarding.displayName')}</label><input id="display-name" className="text-input" value={name} onChange={event => { setName(event.target.value); setError('') }} placeholder={t('onboarding.yourName')} maxLength={24} autoComplete="nickname" /><div className="setup-divider" /><div className="onboarding-card-head"><span className="eyebrow">{t('onboarding.arenas')}</span><span className="step-count">{t('onboarding.chooseThree')}</span></div><div className="interest-grid">{interestOptions.map(interest => <button type="button" key={interest} className={`interest-chip ${selected.includes(interest) ? 'selected' : ''}`} aria-pressed={selected.includes(interest)} onClick={() => setSelected(current => current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest])}>{selected.includes(interest) && <Icon name="check" size={14} />}{localizeInterest(interest, language)}</button>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<Button className="full-width onboarding-submit" icon="arrow" onClick={() => void submit()} disabled={busy}>{busy ? t('common.loading') : t('onboarding.enter')}</Button><p className="onboarding-footnote"><Icon name="shield" size={14} /> {t('onboarding.stancePrivate')}</p></section></div></div>
}

  */
}

function Sidebar({ screen, name, historyCount, onNavigate, onOpenProfile, onNotify }: { screen: Screen; name: string; historyCount: number; onNavigate: (screen: Screen) => void; onOpenProfile: () => void; onNotify: (message: string) => void }) {
  return <aside className="sidebar"><div className="sidebar-brand"><Logo /></div><div className="sidebar-section-label">YOUR SPACE</div><nav className="sidebar-nav">{[{ id: 'home' as Screen, label: 'Today', icon: 'home' as IconName }, { id: 'explore' as Screen, label: 'Explore takes', icon: 'layers' as IconName }, { id: 'results' as Screen, label: 'Your shifts', icon: 'spark' as IconName }].map(item => <button type="button" key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.id === 'results' && historyCount > 0 && <span className="nav-count">{historyCount}</span>}</button>)}</nav><div className="sidebar-section-label sidebar-modes-label">PLAY MODES</div><button type="button" className="nav-item" onClick={() => onNavigate('home')}><span className="mode-dot dot-coral" /><span>Classic</span></button><button type="button" className="nav-item" onClick={() => onNavigate('home')}><span className="mode-dot dot-lavender" /><span>SideSwitch</span><Tag tone="new">NEW</Tag></button><button type="button" className="nav-item" onClick={() => onNavigate('clash')}><span className="mode-dot dot-yellow" /><span>Friend Clash</span></button><div className="sidebar-spacer" /><div className="streak-card"><div className="streak-top"><span className="streak-icon"><Icon name="flame" size={16} /></span><span>{historyCount ? `${Math.min(historyCount, 3)} day streak` : 'Start your streak'}</span></div><div className="streak-dots"><i className={historyCount ? 'filled' : ''} /><i className={historyCount > 1 ? 'filled' : ''} /><i className={historyCount > 2 ? 'filled' : ''} /><i /><i /><i /><i /></div><p>Keep your thinking<br />in motion.</p></div><button type="button" className="profile-mini" onClick={onOpenProfile}><span className="avatar avatar-coral">{name.slice(0, 1).toUpperCase()}</span><span className="profile-mini-copy"><strong>{name}</strong><small>Curious challenger</small></span><span aria-label="Profile options" onClick={event => { event.stopPropagation(); onNotify('Profile settings are coming after beta.') }}><Icon name="more" size={16} /></span></button></aside>
}

function TopBar({ onLanguage, language, aiMode, onProfile, onNotify }: { onLanguage: () => void; language: Language; aiMode: AiMode; onProfile: () => void; onNotify: (message: string) => void }) {
  const t = useTranslations(language)
  const avatar = useSyncExternalStore(subscribeToProfileAvatar, getProfileAvatarSnapshot, getProfileAvatarSnapshot)
  return <header className="topbar"><div className="mobile-logo"><Logo compact /></div><div className="breadcrumb"><span>{t('nav.home')}</span><span className="breadcrumb-dot">·</span><strong>{t('common.private')}</strong></div><div className="topbar-actions"><button type="button" className="language-button" onClick={onLanguage} aria-label={t('shell.switchLanguage', { language: localeLabels[language] })}><Icon name="globe" size={15} /> {language.toUpperCase()} <Icon name="chevron" size={12} /></button><button type="button" className="icon-button" aria-label={t('shell.help')} onClick={() => onNotify(t('shell.helpMessage'))}><Icon name="help" size={18} /></button><button type="button" className="icon-button notification-button" aria-label={t('shell.notifications')} onClick={() => onNotify(t('shell.noNotifications'))}><Icon name="spark" size={17} /><i /></button><button type="button" className="top-avatar" onClick={onProfile} aria-label={t('common.viewProfile')}>{avatar ? <ProfileAvatar profile={avatar.profile} repository={avatar.repository} userId={avatar.userId} revision={avatar.revision} /> : 'A'}</button></div></header>
}

function AppShellV2({ children, screen, name, historyCount, onNavigate, onLanguage, language, aiMode, onNotify, online, onDelete, hasUnsavedDraft }: { children: ReactNode; screen: Screen; name: string; historyCount: number; onNavigate: (screen: Screen) => void; onLanguage: () => void; language: Language; aiMode: AiMode; onNotify: (message: string) => void; online?: boolean; onDelete?: () => void; hasUnsavedDraft?: boolean }) {
  const t = useTranslations(language)
  const navItems = [{ id: 'home' as Screen, label: t('nav.home'), icon: 'home' as IconName }, { id: 'explore' as Screen, label: t('nav.explore'), icon: 'layers' as IconName }, { id: 'friends' as Screen, label: t('friends.title'), icon: 'person' as IconName }, { id: 'groups' as Screen, label: t('nav.groups'), icon: 'users' as IconName }, { id: 'profile' as Screen, label: t('nav.profile'), icon: 'person' as IconName }]
  const update = useServiceWorkerUpdate()
  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><Logo /></div><div className="sidebar-section-label">{t('shell.yourSpace')}</div><nav className="sidebar-nav" aria-label={t('nav.home')}>{navItems.map(item => <button type="button" key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.id === 'profile' && historyCount > 0 && <span className="nav-count">{historyCount}</span>}</button>)}</nav><div className="sidebar-section-label sidebar-modes-label">{t('shell.playModes')}</div><button type="button" className="nav-item" onClick={() => onNavigate('home')}><span className="mode-dot dot-coral" /><span>{t('shell.classic')}</span></button><button type="button" className="nav-item" onClick={() => onNavigate('home')}><span className="mode-dot dot-lavender" /><span>{t('shell.sideSwitch')}</span><Tag tone="new">{t('shell.new')}</Tag></button><button type="button" className="nav-item" onClick={() => onNavigate('clash')}><span className="mode-dot dot-yellow" /><span>{t('shell.personChallenge')}</span></button><button type="button" className="nav-item" onClick={() => onNavigate('team')}><span className="mode-dot dot-mint" /><span>{t('shell.teamDebate')}</span><Tag tone="new">{t('shell.new')}</Tag></button><div className="sidebar-spacer" /><div className="streak-card"><div className="streak-top"><span className="streak-icon"><Icon name="flame" size={16} /></span><span>{historyCount ? t('shell.keepStreak') : t('shell.startStreak')}</span></div><p>{t('shell.streakBody')}</p></div><button type="button" className="profile-mini" onClick={() => onNavigate('profile')}><span className="avatar avatar-coral">{name.slice(0, 1).toUpperCase()}</span><span className="profile-mini-copy"><strong>{name || t('common.viewProfile')}</strong><small>{t('shell.privateByDefault')}</small></span><Icon name="chevron" size={15} /></button></aside><div className="main-column"><TopBar onLanguage={onLanguage} language={language} aiMode={aiMode} onProfile={() => onNavigate('profile')} onNotify={onNotify} /><InstallControl onNotify={onNotify} /><OfflineBanner online={online ?? true} language={language} />{update.available && <div className="update-banner" role="status"><span>{t('shell.updateReady')}</span><button type="button" className="text-link" onClick={() => { if (hasUnsavedDraft) onNotify(t('common.save')); else update.apply() }}>{t('shell.updateReady')}</button></div>}<main className="main-content">{children}</main><nav className="mobile-nav" aria-label={t('nav.home')}>{navItems.map(item => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.label}</span></button>)}</nav><footer className="app-footer"><a href="/privacy">{t('shell.privacy')}</a><a href="/terms">{t('shell.betaTerms')}</a><a href="/community">{t('shell.communityRules')}</a>{onDelete && <button type="button" className="delete-data-button" onClick={onDelete}>{t('shell.deleteData')}</button>}</footer></div></div>
}

function TakeCard({ take, onBegin, onChooseDebate, featured = false, language }: { take: Take; onBegin: BeginHandler; onChooseDebate?: (take: Take) => void; featured?: boolean; language: Language }) {
  const text = takeText(take, language)
  const t = useTranslations(language)
  const difficultyKey = take.difficulty === 'Easy' ? 'take.difficulty.easy' : take.difficulty === 'Hard' ? 'take.difficulty.hard' : 'take.difficulty.medium'
  return <article className={`take-card card-surface ${featured ? 'featured' : ''}`}><div className={`take-card-color color-${take.color}`} aria-hidden="true" /><div className="take-card-body"><div className="take-card-meta"><Tag tone={take.categoryClass.replace('category-', '')}>{text.category}</Tag><span className="take-card-index">{String(takes.findIndex(item => item.id === take.id) + 1).padStart(2, '0')}</span><span><Icon name="clock" size={13} /> {take.time}</span></div><h3>{text.statement}</h3>{text.sourceLanguage && <small className="take-source-note">{t('take.sourceEnglish')}</small>}<div className="take-card-foot"><span className="difficulty"><i className={`difficulty-dot difficulty-${take.difficulty.toLowerCase()}`} /> {t(difficultyKey)}</span><button type="button" className="round-arrow" aria-label={`${t('take.start')}: ${text.statement}`} onClick={() => onChooseDebate ? onChooseDebate(take) : onBegin('classic', take)}><Icon name="arrow" size={15} /></button></div></div></article>
}

function RecentShift({ result, language }: { result: ResultData; language: Language }) {
  const text = takeText(result.take, language)
  return <article className="recent-card card-surface"><span className="recent-icon lavender"><Icon name="spark" size={18} /></span><div><h3>{text.statement}</h3><p>{translate(language, result.mode === 'sideswitch' ? 'profile.sideSwitch' : 'profile.classic')} · {new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : language === 'it' ? 'it-IT' : 'en-GB').format(new Date(result.completedAt))}</p></div><strong>{result.score}<small>/100</small></strong><Icon name="chevron" size={17} /></article>
}

function avatarGlyph(preset: UserProfile['avatarPreset']): ReactNode {
  const avatar = getProfileAvatarSnapshot()
  if (avatar?.profile.avatarPath) return <ProfileAvatar profile={avatar.profile} repository={avatar.repository} userId={avatar.userId} revision={avatar.revision} className="profile-avatar-large-image" />
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

function StreakSummary({ stats, language }: { stats: PersonalStats; language: Language }) {
  const t = useTranslations(language)
  return <div className="streak-summary card-surface"><div className="streak-summary-icon"><Icon name="flame" size={20} /></div><div><span className="eyebrow">{t('profile.currentStreak')}</span><strong>{stats.currentStreak}</strong><small>{stats.totalActiveDays} {t('profile.activeDays')} · {t('profile.bestStreak')} {stats.bestStreak}</small></div></div>
}

function PersonalHomeBase({ userName, language, interests, history, stats, activeDebate, lastResult, preferredMode, onBegin, onChooseDebate, onResume, onExplore, onClash, onProfile, onSettings, onNotify }: { userName: string; language: Language; interests: string[]; history: ResultData[]; stats: PersonalStats; activeDebate: boolean; lastResult: ResultData | null; preferredMode: Mode; onBegin: BeginHandler; onChooseDebate: (take?: Take) => void; onResume: () => void; onExplore: () => void; onClash: () => void; onProfile: () => void; onSettings: () => void; onNotify: (message: string) => void }) {
  const firstName = userName.split(' ')[0] || 'there'
  const t = useTranslations(language)
  const recentIds = history.map(result => result.take.id)
  const personalized = selectPersonalizedTakes(interests, recentIds, 3)
  const worldTake = takes.find(take => take.id === 'society-media-age') || takes[0]
  const worldText = takeText(worldTake, language)
  return <div className="page home-page personal-home"><div className="page-heading home-heading"><div><span className="eyebrow">{t('home.eyebrow')}</span><h1>{t(greetingKey(), { name: firstName })}<span className="heading-period">.</span></h1><p className="muted">{t('home.valueStatement')}</p></div><div className="heading-actions"><Button variant="primary" icon="arrow" onClick={() => onChooseDebate(worldTake)}>{t('common.startDebate')}</Button><Button variant="dark" icon="plus" onClick={onClash}>{t('home.challengePerson')}</Button></div></div><section className="home-grid"><article className="world-card card-surface"><div className="world-card-main"><div className="card-topline"><Tag tone="dark">{t('home.worldTake')}</Tag><span className="card-date"><Icon name="globe" size={14} /> {t('common.global')}</span></div><div className="world-number">01</div><h2>{worldText.statement}</h2><p>{worldText.context}</p><div className="world-bottom"><div className="reaction-dots"><span className="dot-pink" /><span className="dot-purple" /><span className="dot-yellow" /><span className="dot-blue" /><small>{worldText.category} · {t('common.private')}</small></div><Button variant="dark" icon="arrow" onClick={() => onBegin(preferredMode, worldTake)}>{t('common.takeASide')}</Button></div></div><div className="world-card-art"><span className="art-label">{t('home.dailyQuestion')}</span><div className="art-orbit art-orbit-a" /><div className="art-orbit art-orbit-b" /><div className="art-word">MOVE<br /><em>A</em><br />MIND</div></div></article><aside className="home-side-stack"><StreakSummary stats={stats} language={language} />{activeDebate ? <button type="button" className="continue-card card-surface" onClick={onResume}><span className="continue-icon"><Icon name="arrow" size={18} /></span><span><span className="eyebrow">{t('home.inProgress')}</span><strong>{t('home.continueDebate')}</strong><small>{t('home.draftSaved')}</small></span><Icon name="chevron" size={17} /></button> : <div className="home-note card-surface"><Icon name="shield" size={19} /><strong>{t('common.privateByDefault')}</strong><span>{t('home.valueStatement')}</span></div>}<button type="button" className="recent-result-card card-surface" onClick={lastResult ? onProfile : onExplore}>{lastResult ? <><span className="eyebrow">{t('home.latestResult')}</span><strong>{lastResult.score}/100 {t('home.argumentScore')}</strong><small>{takeText(lastResult.take, language).category} · {translate(language, lastResult.mode === 'sideswitch' ? 'profile.sideSwitch' : 'profile.classic')}</small></> : <><span className="eyebrow">{t('home.startExploring')}</span><strong>{t('home.findDisagreement')}</strong><small>{t('home.browseTakes', { count: takes.length })}</small></>}</button></aside></section><section className="section-block"><div className="section-heading"><div><span className="eyebrow">{t('home.personalized')}</span><h2>{t('home.yourTake')}</h2></div><button type="button" className="text-link" onClick={onExplore}>{t('common.viewAll')} <Icon name="arrow" size={15} /></button></div><div className="take-row">{personalized.map((take, index) => <TakeCard key={take.id} take={take} onBegin={onBegin} featured={index === 0} language={language} />)}</div><div className="category-shortcuts"><span className="eyebrow">{t('home.categories')}</span>{(interests.length ? interests : ['Wildcards']).slice(0, 5).map(category => <button type="button" key={category} onClick={onExplore}>{localizeInterest(category, language)}</button>)}<button type="button" className="shortcut-more" onClick={onSettings}>{t('home.editInterests')} <Icon name="settings" size={13} /></button></div></section><section className="section-block lower-section"><div className="section-heading"><div><span className="eyebrow">{t('home.keepMoving')}</span><h2>{t('home.recentShifts')}</h2></div><button type="button" className="text-link" onClick={onProfile}>{t('common.viewProfile')} <Icon name="arrow" size={15} /></button></div>{history.length ? <div className="recent-grid">{history.slice(0, 2).map(result => <RecentShift key={result.id} result={result} language={language} />)}<div className="mini-stats"><div><span className="mini-stat-icon mint"><Icon name="arrowUp" size={17} /></span><strong>{stats.debatesCompleted}</strong><small>{t('home.debatesCompleted')}</small></div><div><span className="mini-stat-icon yellow"><Icon name="target" size={17} /></span><strong>{stats.averageScore}</strong><small>{t('home.averageScore')}</small></div></div></div> : <div className="empty-state card-surface"><Icon name="spark" size={20} /><strong>{t('home.firstShift')}</strong><span>{t('home.firstShiftBody')}</span></div>}</section></div>
}

function PersonalHome(props: Parameters<typeof PersonalHomeBase>[0]) {
  const auth = useAuth()
  const t = useTranslations(props.language)
  const [pulse, setPulse] = useState<WorldPulseItem | null>(null)
  useEffect(() => {
    if (!auth.repository || !auth.userId) return
    let active = true
    void auth.repository.listWorldPulse(auth.userId, { language: props.language, includeSensitive: false }).then(items => { if (active) setPulse(items[0] || null) }).catch(() => { if (active) setPulse(null) })
    return () => { active = false }
  }, [auth.repository, auth.userId, props.language])
  return <><PersonalHomeBase {...props} />{pulse && <section className="home-pulse-retention card-surface"><div><span className="eyebrow">{t('worldPulse.title')}</span><h2>{pulse.debateStatement}</h2><p>{pulse.neutralContext}</p><small>{t('worldPulse.sources', { count: pulse.sourceCount })} · {t('worldPulse.reviewed')}: {new Date(pulse.lastReviewedAt).toLocaleDateString(props.language)}</small></div><Button variant="dark" onClick={() => props.onChooseDebate(buildWorldPulseTake(pulse, props.language))}>{t('worldPulse.start')}</Button></section>}</>
}

function PersonalExploreBase({ language, interests, recentIds, onBegin, onChooseDebate, onNotify }: { language: Language; interests: string[]; recentIds: string[]; onBegin: BeginHandler; onChooseDebate: (take?: Take) => void; onNotify: (message: string) => void }) {
  const t = useTranslations(language)
  const [filter, setFilter] = useState('All topics')
  const [spotlight, setSpotlight] = useState<Take | null>(null)
  const filtered = takes.filter(take => categoryMatches(take, filter))
  function anotherTake() {
    const next = selectPersonalizedTakes(interests, [...recentIds, ...(spotlight ? [spotlight.id] : [])], 1)[0]
    setSpotlight(next || takes[0])
    onNotify(t('common.anotherTake'))
  }
  return <div className="page explore-page"><div className="page-heading"><div><span className="eyebrow">{t('explore.eyebrow')}</span><h1>{t('explore.title')}</h1><p className="muted">{t('explore.body')}</p></div><div className="explore-heading-actions"><div className="explore-count"><strong>{filtered.length}</strong><span>{filter === 'All topics' ? t('explore.balanced') : t('explore.inTopic')}</span></div><Button variant="primary" icon="arrow" onClick={() => onChooseDebate(filtered[0] || takes[0])}>{t('common.startDebate')}</Button></div></div><div className="filter-row explore-topic-filters"><button type="button" className={filter === 'All topics' ? 'filter active' : 'filter'} onClick={() => setFilter('All topics')}>{t('explore.allTopics')}</button>{interestOptions.map(item => <button type="button" key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{localizeInterest(item, language)}</button>)}<Button variant="secondary" icon="spark" onClick={anotherTake}>{t('common.anotherTake')}</Button></div>{spotlight && <article className="explore-spotlight card-surface"><div><span className="eyebrow">{t('explore.nextTake')}</span><Tag tone="coral">{takeText(spotlight, language).category}</Tag><h2>{takeText(spotlight, language).statement}</h2><p>{takeText(spotlight, language).context}</p></div><Button variant="dark" icon="arrow" onClick={() => onChooseDebate(spotlight)}>{t('common.startThisTake')}</Button></article>}<div className="explore-grid">{filtered.map(take => <TakeCard key={take.id} take={take} onBegin={onBegin} onChooseDebate={onChooseDebate} featured={take.id === 'society-media-age'} language={language} />)}<article className="suggest-card"><span className="suggest-spark"><Icon name="spark" size={20} /></span><h3>{t('explore.keepPrivate')}<br />{t('explore.keepCurious')}</h3><p>{t('explore.privateBody')}</p><Button variant="secondary" icon="settings" onClick={() => onNotify(t('common.editInterests'))}>{t('common.editInterests')}</Button></article></div></div>
}

function PersonalExplore(props: { language: Language; interests: string[]; recentIds: string[]; onBegin: BeginHandler; onChooseDebate: (take?: Take) => void; onNotify: (message: string) => void }) {
  const auth = useAuth()
  const [items, setItems] = useState<WorldPulseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hideSensitive, setHideSensitive] = useState(false)
  useEffect(() => {
    if (!auth.repository || !auth.userId) return
    let active = true
    setLoading(true)
    void auth.repository.listWorldPulse(auth.userId, { language: props.language }).then(next => { if (active) setItems(next) }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [auth.repository, auth.userId, props.language])
  useEffect(() => { if (!auth.repository || !auth.userId) return; void auth.repository.loadPreferences(auth.userId).then(preferences => setHideSensitive(preferences?.hideSensitiveWorldPulse === true)).catch(() => undefined) }, [auth.repository, auth.userId])
  async function persistSensitive(value: boolean) { setHideSensitive(value); if (!auth.repository || !auth.userId) return; const preferences = await auth.repository.loadPreferences(auth.userId); if (preferences) await auth.repository.savePreferences({ ...preferences, hideSensitiveWorldPulse: value }) }
  return <><WorldPulsePanel language={props.language} items={items} loading={loading} error={error} hideSensitiveDefault={hideSensitive} onHideSensitiveChange={value => { void persistSensitive(value) }} onChooseDebate={take => props.onChooseDebate(take)} /><PersonalExploreBase {...props} /></>
}

function PersonalProfileBase({ profile, language, stats, history, onSettings, onBack }: { profile: UserProfile; language: Language; stats: PersonalStats; history: ResultData[]; onSettings: () => void; onBack: () => void }) {
  const t = useTranslations(language)
  const name = profile.displayName || 'Curious challenger'
  const firstScore = history[0]?.scores[0]?.score || 0
  return <div className="page profile-page personal-profile"><div className="page-heading"><div><span className="eyebrow">{t('profile.eyebrow')}</span><h1>{name}<span className="heading-period">.</span></h1><p className="muted">{profile.bio || t('profile.privateBody')}</p></div><Button variant="secondary" icon="settings" onClick={onSettings}>{t('common.editProfile')}</Button></div><div className="profile-overview"><section className="profile-hero card-surface"><div className={`profile-avatar-large avatar-${profile.avatarPreset}`}>{avatarGlyph(profile.avatarPreset)}<span className="online-dot" /></div><h2>{t('profile.keepQuestions')}</h2><p>{t('profile.privateBody')}</p><div className="profile-tags"><Tag tone="coral">{t('common.private')}</Tag><Tag tone="lavender">{stats.currentStreak} {t('profile.currentStreak')}</Tag><Tag tone="yellow">{stats.debatesCompleted} {t('home.debatesCompleted')}</Tag></div></section><section className="profile-stats card-surface"><span className="eyebrow">{t('profile.debateDna')}</span><div className="dna-chart"><div className="dna-ring"><strong>{stats.averageScore || '—'}</strong><small>{t('profile.averageScore')}</small></div><div className="dna-legend"><span><i className="legend-coral" /> {t('profile.strongest')} <b>{stats.strongestDimension}</b></span><span><i className="legend-lavender" /> {t('profile.currentStreak')} <b>{stats.currentStreak}</b></span><span><i className="legend-yellow" /> {t('profile.categories')} <b>{stats.categoriesExplored}</b></span><span><i className="legend-blue" /> {t('profile.latestSignal')} <b>{firstScore || '—'}</b></span></div></div><p className="ai-disclaimer"><Icon name="info" size={14} /> {t('profile.aiDisclaimer')}</p></section></div><section className="profile-metric-grid"><div className="metric-card"><strong>{stats.bestStreak}</strong><span>{t('profile.bestStreak')}</span></div><div className="metric-card"><strong>{stats.sideSwitchCompleted}</strong><span>{t('profile.sideSwitch')}</span></div><div className="metric-card"><strong>{stats.classicCompleted}</strong><span>{t('profile.classic')}</span></div><div className="metric-card"><strong>{stats.challengeResponses}</strong><span>{t('profile.challengeResponses')}</span></div><div className="metric-card"><strong>{stats.challengeCreated}</strong><span>{t('profile.challengesCreated')}</span></div></section><section className="section-block profile-history"><div className="section-heading"><div><span className="eyebrow">{t('profile.history')}</span><h2>{t('home.recentShifts')}</h2></div><span className="muted">{stats.totalActiveDays} {t('profile.activeDays')}</span></div>{history.length ? <div className="recent-grid">{history.slice(0, 5).map(result => <RecentShift key={result.id} result={result} language={language} />)}</div> : <div className="empty-state card-surface"><strong>{t('profile.noDebates')}</strong><span>{t('profile.firstResult')}</span></div>}</section><div className="profile-footer"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('common.back')}</button><span><Icon name="lock" size={13} /> {t('profile.privateDefault')}</span></div></div>
}

function PersonalProfile(props: Parameters<typeof PersonalProfileBase>[0]) {
  const t = useTranslations(props.language)
  return <><PersonalProfileBase {...props} /><section className="profile-identity-addendum"><div><span className="eyebrow">{t('profile.eyebrow')}</span>{props.profile.handle && <p className="profile-handle">@{props.profile.handle}</p>}{props.profile.socialLinks.length > 0 && <div className="profile-social-list">{props.profile.socialLinks.map(link => <a href={link.url} target="_blank" rel="noopener noreferrer" key={`${link.provider}-${link.url}`}>{link.label || link.provider}<Icon name="link" size={13} /></a>)}</div>}</div><Button variant="secondary" icon="settings" onClick={props.onSettings}>{t('common.settings')}</Button></section></>
}

function AiDefaultsSection({ language, preferences, onChange }: { language: Language; preferences: UserPreferences; onChange: (patch: Partial<UserPreferences>) => void }) {
  const t = useTranslations(language)
  return <section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('settings.aiDefaults')}</span><h2>{t('settings.preferredOpponent')}</h2></div><Icon name="spark" size={21} /></div><p className="field-help settings-intro">{t('settings.aiDefaultsBody')}</p><div className="settings-fields-grid"><label className="field-label">{t('settings.preferredOpponent')}<select className="settings-select" value={preferences.preferredOpponentType} onChange={event => onChange({ preferredOpponentType: event.target.value as UserPreferences['preferredOpponentType'] })}><option value="ask">{t('settings.askEveryTime')}</option><option value="ai">{t('settings.aiOpponent')}</option><option value="person">{t('settings.personOpponent')}</option></select></label><label className="field-label">{t('settings.aiFamily')}<select className="settings-select" value={preferences.preferredAiFamily} onChange={event => onChange({ preferredAiFamily: event.target.value as UserPreferences['preferredAiFamily'] })}><option value="Gemini">Gemini</option><option value="Claude">Claude</option><option value="GPT">GPT</option><option value="DeepSeek">DeepSeek</option></select></label><label className="field-label">{t('settings.modelQuality')}<select className="settings-select" value={preferences.aiQuality} onChange={event => onChange({ aiQuality: event.target.value as UserPreferences['aiQuality'] })}><option value="fast">{t('shell.classic')}</option><option value="balanced">{t('explore.balanced')}</option><option value="maximum">{t('settings.modelQuality')}</option></select></label><label className="field-label">{t('settings.responseLength')}<select className="settings-select" value={preferences.aiResponseLength} onChange={event => onChange({ aiResponseLength: event.target.value as UserPreferences['aiResponseLength'] })}><option value="concise">Concise</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label></div><label className="toggle-row"><input type="checkbox" checked={preferences.showModelDetails} onChange={event => onChange({ showModelDetails: event.target.checked })} /><span>{t('settings.showModelDetails')}</span><small>{t('settings.modelDetailsHelp')}</small></label></section>
}

function BetaFeedbackForm({ language, surface, screen, aiModelId, onSubmit }: { language: Language; surface: BetaFeedbackInput['surface']; screen: string; aiModelId?: string | null; onSubmit: (payload: BetaFeedbackInput) => Promise<void> }) {
  const t = useTranslations(language)
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
  return <section className="settings-section card-surface beta-feedback"><div className="settings-section-heading"><div><span className="eyebrow">PRIVATE BETA</span><h2>{t('feedback.title')}</h2></div><Icon name="message" size={21} /></div><p className="field-help">{t('feedback.body')}</p><div className="feedback-options" role="group" aria-label={t('feedback.type')}>{labels.map(([value, label]) => <button type="button" key={value} className={category === value ? 'selected' : ''} aria-pressed={category === value} onClick={() => { setCategory(value); setSent(false) }}>{label}</button>)}</div><label className="field-label" htmlFor={`beta-feedback-${surface}`}>{t('feedback.shortNote')}</label><textarea id={`beta-feedback-${surface}`} className="settings-textarea" maxLength={600} value={message} onChange={event => { setMessage(event.target.value); setSent(false); setError('') }} placeholder={t('feedback.placeholder')} /><div className="feedback-submit-row"><small>{message.length} / 600</small><Button variant="secondary" onClick={() => void submit()} disabled={busy}>{busy ? t('common.sending') : t('common.sendFeedback')}</Button></div>{error && <p className="form-error" role="alert">{error}</p>}{sent && <p className="form-success" role="status">{t('feedback.thanks')}</p>}</section>
}

function ProfileSocialPanel({ profile, userId, repository, onProfile, onNotify }: { profile: UserProfile; userId: string; repository: AppRepository; onProfile: (value: UserProfile, forceAvatarRevision?: boolean) => Promise<void>; onNotify: (message: string) => void }) {
  const t = useTranslations(profile.interfaceLanguage)
  const [draft, setDraft] = useState(profile)
  const [busy, setBusy] = useState(false)
  useEffect(() => setDraft(profile), [profile])
  async function save() { setBusy(true); try { await onProfile(normalizeProfile(draft)); onNotify(t('settings.saved')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('friends.unavailable')) } finally { setBusy(false) } }
  async function upload(file: Blob) { setBusy(true); try { const path = await repository.uploadAvatar(userId, file, 'image/webp'); const next = { ...draft, avatarPath: path, avatarRevision: (draft.avatarRevision || 0) + 1 }; setDraft(next); await onProfile(next, true); onNotify(t('settings.saved')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('friends.unavailable')) } finally { setBusy(false) } }
  async function remove() { setBusy(true); try { await repository.removeAvatar(userId); const next = { ...draft, avatarPath: null, avatarRevision: (draft.avatarRevision || 0) + 1 }; setDraft(next); await onProfile(next, true); onNotify(t('settings.saved')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('friends.unavailable')) } finally { setBusy(false) } }
  return <section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('friends.eyebrow')}</span><h2>{t('friends.photo')}</h2></div><Icon name="shield" size={21} /></div><p className="field-help">{t('friends.photoHelp')}</p><AvatarPhotoPicker language={profile.interfaceLanguage} hasAvatar={Boolean(draft.avatarPath)} busy={busy} onUpload={upload} onRemove={remove} onNotify={onNotify} /><label className="field-label">{t('friends.handle')}<input className="text-input" maxLength={24} value={draft.handle || ''} onChange={event => setDraft(current => ({ ...current, handle: event.target.value }))} placeholder="@handle" /></label><label className="field-label">{t('friends.visibility')}<select className="settings-select" value={draft.profileVisibility} onChange={event => setDraft(current => ({ ...current, profileVisibility: event.target.value as UserProfile['profileVisibility'] }))}><option value="friends">{t('friends.friendsOnly')}</option><option value="shared_groups">{t('friends.sharedGroups')}</option><option value="private">{t('friends.private')}</option></select></label><span className="field-label">{t('friends.stats')}</span>{(['debates', 'sideSwitches', 'constructive', 'argumentDna'] as const).map(stat => <label className="toggle-row" key={stat}><input type="checkbox" checked={draft.visibleStats[stat]} onChange={event => setDraft(current => ({ ...current, visibleStats: { ...current.visibleStats, [stat]: event.target.checked } }))} /><span>{({ debates: t('friends.statDebates'), sideSwitches: t('friends.statSideSwitches'), constructive: t('friends.statConstructive'), argumentDna: t('friends.statArgumentDna') } as const)[stat]}</span></label>)}<Button variant="dark" onClick={() => void save()} disabled={busy}>{t('common.save')}</Button></section>
}

function SettingsScreen(props: { profile: UserProfile; preferences: UserPreferences; aiMode: AiMode; backendLabel: string; repository: AppRepository; userId: string; onSaveProfile: (value: UserProfile) => Promise<void>; onSavePreferences: (value: UserPreferences) => Promise<void>; onDelete: () => void; onBack: () => void; onNotify: (message: string) => void; onSubmitFeedback: (payload: BetaFeedbackInput) => Promise<void> }) {
  return <><LocalizedSettingsScreen {...props} /><ProfileSocialPanel profile={props.profile} userId={props.userId} repository={props.repository} onProfile={props.onSaveProfile} onNotify={props.onNotify} /><AvatarPrivacyPanel profile={props.profile} onSave={props.onSaveProfile} onNotify={props.onNotify} /></>
}

function AvatarPrivacyPanel({ profile, onSave, onNotify }: { profile: UserProfile; onSave: (value: UserProfile) => Promise<void>; onNotify: (message: string) => void }) {
  const t = useTranslations(profile.interfaceLanguage)
  const [visibility, setVisibility] = useState(profile.avatarVisibility)
  const [busy, setBusy] = useState(false)
  useEffect(() => setVisibility(profile.avatarVisibility), [profile.avatarVisibility])
  async function save() { setBusy(true); try { await onSave({ ...profile, avatarVisibility: visibility }); onNotify(t('settings.saved')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('friends.unavailable')) } finally { setBusy(false) } }
  return <section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('friends.photo')}</span><h2>{t('friends.visibility')}</h2></div><Icon name="lock" size={21} /></div><label className="field-label">{t('friends.photo')}<select className="settings-select" value={visibility} onChange={event => setVisibility(event.target.value as UserProfile['avatarVisibility'])}><option value="friends">{t('friends.friendsOnly')}</option><option value="shared_groups">{t('friends.sharedGroups')}</option><option value="private">{t('friends.private')}</option></select></label><Button variant="secondary" onClick={() => void save()} disabled={busy}>{t('common.save')}</Button></section>
}

function LocalizedSettingsScreen({ profile, preferences, aiMode, backendLabel, onSaveProfile, onSavePreferences, onDelete, onBack, onNotify, onSubmitFeedback }: { profile: UserProfile; preferences: UserPreferences; aiMode: AiMode; backendLabel: string; onSaveProfile: (value: UserProfile) => Promise<void>; onSavePreferences: (value: UserPreferences) => Promise<void>; onDelete: () => void; onBack: () => void; onNotify: (message: string) => void; onSubmitFeedback: (payload: BetaFeedbackInput) => Promise<void> }) {
  const t = useTranslations(profile.interfaceLanguage)
  const [draftProfile, setDraftProfile] = useState(profile)
  const [draftPreferences, setDraftPreferences] = useState(preferences)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (saving) return; setDraftProfile(profile); setDraftPreferences(preferences) }, [preferences, profile, saving])
  async function save() {
    setSaving(true)
    try {
      const nextProfile = normalizeProfile(draftProfile)
      const nextPreferences = normalizePreferences({ ...draftPreferences, debateLanguages: [nextProfile.interfaceLanguage] })
      await onSaveProfile(nextProfile)
      await onSavePreferences(nextPreferences)
      onNotify(t('settings.saved'))
    } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('settings.deleteError')) } finally { setSaving(false) }
  }
  async function resetAppearance() {
    const next = normalizePreferences({ ...draftPreferences, theme: 'system', accent: 'coral', textSize: 'comfortable', reducedMotion: false })
    setDraftPreferences(next)
    await onSavePreferences(next)
    onNotify(t('settings.resetAppearance'))
  }
  return <div className="page settings-page"><div className="page-heading"><div><span className="eyebrow">{t('settings.eyebrow')}</span><h1>{t('settings.title')}<span className="heading-period">.</span></h1><p className="muted">{t('settings.body')}</p></div><Button variant="dark" icon="check" onClick={() => void save()} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button></div><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('settings.account')}</span><h2>{t('settings.shortBio')}</h2></div><Icon name="person" size={21} /></div><label className="field-label" htmlFor="settings-name">{t('onboarding.displayName')}</label><input id="settings-name" className="text-input" maxLength={24} value={draftProfile.displayName || ''} onChange={event => setDraftProfile(current => ({ ...current, displayName: event.target.value }))} /><label className="field-label" htmlFor="settings-bio">{t('settings.shortBio')} <span>({(draftProfile.bio || '').length}/160)</span></label><textarea id="settings-bio" className="settings-textarea" maxLength={160} value={draftProfile.bio || ''} onChange={event => setDraftProfile(current => ({ ...current, bio: event.target.value }))} placeholder={t('settings.bioPlaceholder')} /><span className="field-help">{t('settings.bioHelp')}</span><span className="field-label">{t('settings.presetAvatar')}</span><div className="avatar-options">{avatarPresets.map(preset => <button type="button" key={preset} className={`avatar-option avatar-${preset} ${draftProfile.avatarPreset === preset ? 'selected' : ''}`} aria-label={`${t('settings.presetAvatar')}: ${preset}`} aria-pressed={draftProfile.avatarPreset === preset} onClick={() => setDraftProfile(current => ({ ...current, avatarPreset: preset }))}>{avatarGlyph(preset)}<small>{preset}</small></button>)}</div></section><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('settings.preferences')}</span><h2>{t('settings.contentBody')}</h2></div><Icon name="layers" size={21} /></div><div className="settings-interest-grid">{interestOptions.map(interest => <button type="button" key={interest} className={`interest-chip ${draftPreferences.topicPreferences.includes(interest) ? 'selected' : ''}`} aria-pressed={draftPreferences.topicPreferences.includes(interest)} onClick={() => setDraftPreferences(current => ({ ...current, topicPreferences: current.topicPreferences.includes(interest) ? current.topicPreferences.filter(item => item !== interest) : [...current.topicPreferences, interest] }))}>{draftPreferences.topicPreferences.includes(interest) && <Icon name="check" size={14} />}{localizeInterest(interest, profile.interfaceLanguage)}</button>)}</div><div className="settings-fields-grid"><label className="field-label">{t('settings.interfaceLanguage')}<select className="settings-select" value={draftProfile.interfaceLanguage} onChange={event => { const next = event.target.value as Language; setDraftProfile(current => ({ ...current, interfaceLanguage: next })) }}>{supportedLanguages.map(item => <option value={item} key={item}>{localeLabels[item]}</option>)}</select></label><label className="field-label">{t('settings.debateLanguage')}<select className="settings-select" value={draftPreferences.debateLanguages[0]} onChange={event => setDraftPreferences(current => ({ ...current, debateLanguages: [event.target.value as Language] }))}>{supportedLanguages.map(item => <option value={item} key={item}>{localeLabels[item]}</option>)}</select></label><label className="field-label">{t('settings.intensity')}<select className="settings-select" value={draftPreferences.intensity || 'balanced'} onChange={event => setDraftPreferences(current => ({ ...current, intensity: event.target.value }))}><option value="gentle">Gentle</option><option value="balanced">Balanced</option><option value="rigorous">Rigorous</option></select></label><label className="field-label">{t('settings.defaultMode')}<select className="settings-select" value={draftPreferences.preferredMode} onChange={event => setDraftPreferences(current => ({ ...current, preferredMode: event.target.value as Mode }))}><option value="sideswitch">SideSwitch</option><option value="classic">Classic</option><option value="blindside">Blindside</option><option value="commonground">CommonGround</option></select></label><label className="field-label">{t('settings.aiStyle')}<select className="settings-select" value={draftPreferences.preferredAiStyle || 'sharp-skeptic'} onChange={event => setDraftPreferences(current => ({ ...current, preferredAiStyle: event.target.value }))}><option value="sharp-skeptic">Sharp Skeptic</option><option value="curious-coach">Curious Coach</option><option value="fair-moderator">Fair Moderator</option></select></label></div></section><AiDefaultsSection language={profile.interfaceLanguage} preferences={draftPreferences} onChange={patch => setDraftPreferences(current => ({ ...current, ...patch }))} /><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('settings.appearance')}</span><h2>{t('settings.theme')}</h2></div><Icon name="sun" size={21} /></div><div className="settings-fields-grid"><label className="field-label">{t('settings.theme')}<select className="settings-select" value={draftPreferences.theme} onChange={event => setDraftPreferences(current => ({ ...current, theme: event.target.value as UserPreferences['theme'] }))}>{Object.entries(appearanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-label">{t('settings.textSize')}<select className="settings-select" value={draftPreferences.textSize} onChange={event => setDraftPreferences(current => ({ ...current, textSize: event.target.value as UserPreferences['textSize'] }))}>{Object.entries(textSizeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><span className="field-label">{t('settings.accent')}</span><div className="accent-options">{accentThemes.map(accent => <button type="button" key={accent} className={`accent-option accent-${accent} ${draftPreferences.accent === accent ? 'selected' : ''}`} aria-pressed={draftPreferences.accent === accent} onClick={() => setDraftPreferences(current => ({ ...current, accent }))}><i />{accent}</button>)}</div><label className="toggle-row"><input type="checkbox" checked={draftPreferences.reducedMotion} onChange={event => setDraftPreferences(current => ({ ...current, reducedMotion: event.target.checked }))} /><span>{t('settings.reduceMotion')}</span><small>{t('settings.reduceMotionHelp')}</small></label><button type="button" className="button button-ghost" onClick={() => void resetAppearance()}>{t('settings.resetAppearance')}</button><button type="button" className="button button-ghost" onClick={() => window.dispatchEvent(new Event('sideshift-open-onboarding'))}>{t('settings.guide')}</button></section><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('settings.privacyData')}</span><h2>{t('settings.privacyData')}</h2></div><Icon name="shield" size={21} /></div><label className="toggle-row"><input type="checkbox" checked={!draftPreferences.shareRealStance} onChange={event => setDraftPreferences(current => ({ ...current, shareRealStance: !event.target.checked }))} /><span>{t('settings.keepStancePrivate')}</span><small>{t('settings.scoreDisclaimer')}</small></label><label className="toggle-row"><input type="checkbox" checked={draftProfile.challengeShowName} onChange={event => setDraftProfile(current => ({ ...current, challengeShowName: event.target.checked }))} /><span>{t('settings.showProfile')}</span></label><div className="settings-links"><a href="/privacy">{t('shell.privacy')}</a><a href="/terms">{t('shell.betaTerms')}</a><a href="/community">{t('shell.communityRules')}</a></div><Button variant="secondary" onClick={onDelete}>{t('shell.deleteData')}</Button></section><section className="settings-section card-surface beta-settings"><div className="settings-section-heading"><div><span className="eyebrow">PRIVATE BETA</span><h2>{t('settings.aboutBuild')}</h2></div><Icon name="info" size={21} /></div><div className="beta-facts"><span><strong>{t('settings.backend')}</strong>{backendLabel}</span><span><strong>{t('settings.aiStatus')}</strong>{aiRuntimeLabel(aiMode)}</span><span><strong>{t('settings.version')}</strong>SideShift beta</span></div><p className="field-help">{t('settings.scoreDisclaimer')}</p></section><BetaFeedbackForm language={profile.interfaceLanguage} surface="settings" screen="settings" onSubmit={onSubmitFeedback} /><div className="settings-footer"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('common.back')}</button><Button variant="dark" icon="check" onClick={() => void save()} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button></div></div>
}

function BackendGate({ title, message, action }: { title: string; message: string; action?: { label: string; onClick: () => void } }) {
  return <div className="onboarding-page"><div className="created-challenge"><Tag tone="coral">PRIVATE BETA</Tag><h1>{title}</h1><p className="stage-intro" role="alert">{message}</p>{action && <Button onClick={action.onClick}>{action.label}</Button>}</div></div>
}

function SignedOutWelcome({ language, onStart, onRequestSignInOtp, onVerifySignInOtp }: { language: Language; onStart: () => Promise<void>; onRequestSignInOtp: (email: string) => Promise<void>; onVerifySignInOtp: (email: string, code: string) => Promise<void> }) {
  const t = useTranslations(language)
  const [view, setView] = useState<'welcome' | 'sign-in' | 'learn'>('welcome')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function continueAsGuest() {
    setStarting(true); setError('')
    try { await onStart() } catch { setError(t('auth.otpRequestFailed')); setStarting(false) }
  }

  if (view === 'sign-in') return <div className="onboarding-page signed-out-page"><div className="onboarding-top"><Logo /><span className="onboarding-meta"><Icon name="lock" size={14} /> {t('common.privateByDefault')}</span></div><main className="signed-out-panel"><button type="button" className="back-link" onClick={() => setView('welcome')}><Icon name="arrow" size={15} /> {t('auth.backToWelcome')}</button><EmailOtpFlow language={language} mode="sign-in" requestCode={onRequestSignInOtp} verifyCode={onVerifySignInOtp} /></main></div>
  if (view === 'learn') return <div className="onboarding-page signed-out-page"><div className="onboarding-top"><Logo /><span className="onboarding-meta"><Icon name="lock" size={14} /> {t('common.privateByDefault')}</span></div><main className="signed-out-panel signed-out-learn-panel"><button type="button" className="back-link" onClick={() => setView('welcome')}><Icon name="arrow" size={15} /> {t('auth.backToWelcome')}</button><Tag tone="coral">{t('auth.learnTitle')}</Tag><h1>{t('auth.learnTitle')}</h1><p className="stage-intro">{t('auth.learnBody')}</p><div className="public-explainer-list"><article><h2>{t('auth.sideSwitchTitle')}</h2><p>{t('auth.sideSwitchBody')}</p></article><article><h2>{t('auth.aiTitle')}</h2><p>{t('auth.aiBody')}</p></article><article><h2>{t('auth.friendTitle')}</h2><p>{t('auth.friendBody')}</p></article><article><h2>{t('auth.teamTitle')}</h2><p>{t('auth.teamBody')}</p></article><article><h2>{t('auth.privacyTitle')}</h2><p>{t('auth.privacyBody')}</p></article></div><div className="signed-out-actions"><Button className="full-width" icon="arrow" onClick={() => void continueAsGuest()} disabled={starting}>{starting ? t('auth.guestStarting') : t('auth.continueGuest')}</Button><Button className="full-width" variant="secondary" onClick={() => setView('sign-in')} disabled={starting}>{t('auth.signIn')}</Button></div>{error && <p className="form-error" role="alert">{error}</p>}</main></div>
  return <div className="onboarding-page signed-out-page"><div className="onboarding-top"><Logo /><span className="onboarding-meta"><Icon name="lock" size={14} /> {t('common.privateByDefault')}</span></div><main className="signed-out-panel"><Tag tone="coral">{t('profileSettings.signedOut')}</Tag><h1>{t('profileSettings.signedOut')}</h1><p className="stage-intro">{t('profileSettings.signedOutBody')}</p><div className="signed-out-actions"><Button className="full-width" icon="arrow" onClick={() => void continueAsGuest()} disabled={starting}>{starting ? t('auth.guestStarting') : t('auth.continueGuest')}</Button><Button className="full-width" variant="secondary" onClick={() => setView('sign-in')} disabled={starting}>{t('auth.signIn')}</Button><button type="button" className="text-link signed-out-learn" onClick={() => setView('learn')} disabled={starting}>{t('auth.learn')}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</main></div>
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
  const [profileViewKey, setProfileViewKey] = useState<string | null>(null)
  const [profileViewReturn, setProfileViewReturn] = useState<Screen>('home')
  const [userName, setUserName] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage())
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
  const [showOnboarding, setShowOnboarding] = useState(false)
  const mockAi = import.meta.env.VITE_AI_MOCK === 'true'
  const [aiRuntime, setAiRuntime] = useState<AiRuntimeSnapshot>(() => createAiRuntimeSnapshot({ mock: mockAi, puterStatus: 'disconnected', basicServerAvailable: false }))
  const aiMode = aiRuntime.primary
  const mockAiProvider = useMemo<AiProvider>(() => createMockAiProvider({ streamDelayMs: 1 }), [])
  const basicAiProvider = useMemo<AiProvider>(() => mockAi ? mockAiProvider : createBasicAiProvider({ accessToken: auth.accessToken, userId }), [auth.accessToken, mockAi, mockAiProvider, userId])
  const unavailablePuterProvider = useMemo<AiProvider>(() => createUnavailableAiProvider('puter'), [])
  const [liveAiProvider, setLiveAiProvider] = useState<AiProvider | null>(null)
  const [aiTake, setAiTake] = useState<Take>(takes[0])
  const [aiConfig, setAiConfig] = useState<AiStartConfig | null>(null)
  const [aiSnapshot, setAiSnapshot] = useState<AiDebateData | null>(null)
  const [aiPreset, setAiPreset] = useState<Partial<AiStartConfig> | undefined>()
  const [teamSession, setTeamSession] = useState<TeamDebateSession | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [teamInitialTopic, setTeamInitialTopic] = useState<{ statement: string; context: string; takeId: string | null; custom: boolean } | undefined>()
  const aiCompletionGuardRef = useRef(createAiDebateCompletionGuard())
  const teamCompletionRef = useRef(new Set<string>())
  const personalStats = useMemo(() => calculatePersonalStats(history, statsSnapshot), [history, statsSnapshot])
  const debateSaveQueueRef = useRef(Promise.resolve())
  const latestQueuedDebateRef = useRef<{ id: string; step: number } | null>(null)
  const aiProvider = mockAi ? mockAiProvider : aiConfig?.opponent.id === 'sideshift-basic' ? basicAiProvider : liveAiProvider || unavailablePuterProvider

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
    if (!auth.signedOut) return
    setHydratedUserId(null)
    setDataError(null)
    setHasOnboarded(false)
    setScreen('home')
    setProfileViewKey(null)
    setUserName('')
    setInterests([])
    setProfileData(defaultProfile(''))
    setPreferencesData(defaultPreferences(''))
    setStatsSnapshot(emptyStatsSnapshot)
    setActiveTake(takes[0])
    setActiveMode('sideswitch')
    setDebateId('')
    setDebateStep(0)
    setResponses({})
    setOpponentMessages({})
    setLastResult(null)
    setHistory([])
    setAiTake(takes[0])
    setAiConfig(null)
    setAiSnapshot(null)
    setTeamSession(null)
    setActiveGroupId(null)
    setTeamInitialTopic(undefined)
    setShowGuide(false)
    setShowOnboarding(false)
    setToast('')
    debateSaveQueueRef.current = Promise.resolve()
    latestQueuedDebateRef.current = null
    aiCompletionGuardRef.current.clear()
    teamCompletionRef.current.clear()
  }, [auth.signedOut])
  useEffect(() => {
    const handleNativeBack = (event: Event) => {
      if (event.defaultPrevented) return
      setScreen(current => current === 'settings' || current === 'friends' || current === 'groups' ? current : current === 'profileView' ? profileViewReturn : current === 'aiDebate' || current === 'debate' || current === 'team' ? 'home' : current === 'aiSetup' || current === 'debateChoice' || current === 'clash' ? 'home' : current)
    }
    window.addEventListener('sideshift-native-back', handleNativeBack)
    return () => window.removeEventListener('sideshift-native-back', handleNativeBack)
  }, [profileViewReturn])
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
  useEffect(() => { publishProfileAvatar(!auth.signedOut && repository && userId ? { profile: profileData, repository, userId, revision: profileData.avatarRevision || 0 } : null) }, [auth.signedOut, profileData, repository, userId])
  useEffect(() => {
    const handleDebateEntry = () => beginDebateEntry(activeTake)
    window.addEventListener('sideshift-debate-entry', handleDebateEntry)
    return () => window.removeEventListener('sideshift-debate-entry', handleDebateEntry)
  }, [activeTake])
  useEffect(() => {
    const handleBasicEntry = () => beginAiSetup(activeTake)
    const handleOnboardingLanguage = () => setLanguage(getInitialLanguage())
    window.addEventListener('sideshift-basic-entry', handleBasicEntry)
    window.addEventListener('sideshift-onboarding-language', handleOnboardingLanguage)
    return () => { window.removeEventListener('sideshift-basic-entry', handleBasicEntry); window.removeEventListener('sideshift-onboarding-language', handleOnboardingLanguage) }
  }, [activeTake])
  useEffect(() => {
    const handleGuide = () => setShowGuide(true)
    window.addEventListener('sideshift-open-guide', handleGuide)
    return () => window.removeEventListener('sideshift-open-guide', handleGuide)
  }, [])
  useEffect(() => {
    const handleOnboarding = () => setShowOnboarding(true)
    window.addEventListener('sideshift-open-onboarding', handleOnboarding)
    return () => window.removeEventListener('sideshift-open-onboarding', handleOnboarding)
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
      const nextLanguage = readStoredLanguage() || profile?.interfaceLanguage || preferences?.debateLanguages[0] || getInitialLanguage()
      setProfileData(nextProfile)
      setPreferencesData(nextPreferences)
      setUserName(nextProfile.displayName || '')
      setInterests(nextPreferences.topicPreferences)
      setLanguage(nextLanguage)
      persistLanguage(nextLanguage)
      setHasOnboarded(nextPreferences.onboardingCompleted)
      const storedTake = result?.take || getTake(debate?.takeId || takes[0].id)
      const snapshotTake = debate?.worldPulse ? { ...storedTake, id: `world-pulse:${debate.worldPulse.id}`, category: debate.worldPulse.category, statement: debate.worldPulse.debateStatement, context: debate.worldPulse.neutralContext, supportLabel: debate.worldPulse.sideALabel, opposeLabel: debate.worldPulse.sideBLabel, worldPulse: debate.worldPulse } : storedTake
      const restoredTake = debate?.ai?.customMotion ? privateTake(debate.ai.customMotion, snapshotTake) : snapshotTake
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
    if (aiCompletionGuardRef.current.isActive(debateId)) return
    const currentDebateId = debateId
    const timeout = window.setTimeout(() => {
      if (aiCompletionGuardRef.current.isActive(currentDebateId)) return
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

  async function completeOnboarding(name: string, nextInterests: string[], onboardingGoal: UserPreferences['onboardingGoal']) {
    if (!online) throw new Error('You are offline. Reconnect before saving your private setup.')
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    const nextProfile = normalizeProfile({ ...profileData, id: userId, displayName: name, interfaceLanguage: language })
    const nextPreferences = normalizePreferences({ ...preferencesData, userId, topicPreferences: nextInterests, debateLanguages: [language], onboardingCompleted: true, onboardingStage: 2, onboardingGoal, onboardingDismissed: false })
    await repository.saveProfile(nextProfile)
    await repository.savePreferences(nextPreferences)
    persistLanguage(language)
    setProfileData(nextProfile); setPreferencesData(nextPreferences); setUserName(name); setInterests(nextInterests); setHasOnboarded(true); setScreen('home'); trackEvent('onboarding_completed', { interests_count: nextInterests.length }); notify('Preferences saved to your private account.')
  }

  function applyProfileState(next: UserProfile, forceAvatarRevision = false) {
    const revision = Math.max(next.avatarRevision || 0, (profileData.avatarRevision || 0) + (forceAvatarRevision || profileData.avatarPath !== next.avatarPath ? 1 : 0))
    const nextProfile = { ...next, avatarRevision: revision }
    setProfileData(nextProfile); setUserName(nextProfile.displayName || ''); setLanguage(nextProfile.interfaceLanguage)
  }

  async function saveProfileSettings(next: UserProfile) {
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    const normalized = normalizeProfile({ ...next, id: userId })
    await repository.saveProfile(normalized)
    persistLanguage(normalized.interfaceLanguage)
    applyProfileState(normalized)
  }

  async function savePreferenceSettings(next: UserPreferences) {
    if (!repository || !userId) throw new Error('Authentication is not ready yet.')
    const normalized = normalizePreferences({ ...next, userId })
    await repository.savePreferences(normalized)
    clearAiSetupDraft()
    setPreferencesData(normalized); setInterests(normalized.topicPreferences); setActiveMode(normalized.preferredMode)
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
      await repository.recordLeagueActivity(userId, owned.id, 'team_debate', owned.groupId).catch(caught => notify(caught instanceof Error ? caught.message : 'Team League activity could not be recorded.'))
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
    if (window.location.pathname.startsWith('/group/')) window.history.replaceState({}, '', '/')
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
    const outcome = await runAiDebateCompletion({
      debateId,
      transcript,
      aiTake,
      aiConfig,
      aiSnapshot,
      language,
      repository,
      userId,
      guard: aiCompletionGuardRef.current,
      makeId: makeUuid,
      evaluate: async () => {
        const contextTranscript = transcript.map(turn => ({ role: turn.role === 'opponent' ? 'assistant' as const : 'user' as const, round: turn.round, content: turn.content }))
        return aiProvider.evaluate(buildEvaluationContext({ motion: aiDebateMotion(aiTake, language, aiSnapshot.customMotion), userSide: aiConfig.userSide, aiSide: aiConfig.aiSide, language, transcript: contextTranscript }), aiSnapshot.modelId, { debateId, requestId: `${debateId}-evaluation` })
      },
    })
    if (outcome.status === 'aborted') return
    const now = outcome.result.completedAt
    const nextHistory = [outcome.result, ...history.filter(item => item.id !== outcome.result.id)].slice(0, 20)
    setLastResult(outcome.result); setHistory(nextHistory); setAiSnapshot(outcome.completedSnapshot); setDebateId(''); setScreen('aiResults'); setStatsSnapshot(current => ({ ...current, activityDates: [...current.activityDates, now] })); trackEvent('debate_completed', { score: outcome.result.score, movement: 0, ai_opponent: aiConfig.opponent.id })
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
    const snapshot: DebateSnapshot = { id: debateId, takeId: activeTake.id, mode: activeMode, step: nextStep, stance, postStance, confidence, understanding, responses: nextResponses, opponentMessages: nextOpponentMessages, assignedSide: assignSide(stance, activeMode, activeTake), language, status: 'active', updatedAt: new Date().toISOString(), worldPulse: activeTake.worldPulse }
    await queueClassicDebateSave(snapshot)
  }
  async function beginDebate(mode: Mode, take = activeTake) {
    if (!online) return notify('Reconnect before starting a debate.')
    if (!repository || !userId) return
    const id = makeUuid()
    const snapshot: DebateSnapshot = { id, takeId: take.id, mode, step: 0, stance: 1, postStance: 1, confidence: 4, understanding: 'yes', responses: {}, opponentMessages: {}, assignedSide: assignSide(1, mode, take), language, status: 'active', updatedAt: new Date().toISOString(), worldPulse: take.worldPulse }
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
      judge = await apiFetch<ReturnType<typeof calculateMockScore>>('/api/ai/judge', { method: 'POST', headers: { ...(auth.accessToken ? { authorization: `Bearer ${auth.accessToken}` } : {}), ...(repository.backend === 'local' ? { 'x-sideshift-user-id': userId } : {}) }, body: JSON.stringify({ transcript, language }) })
    } catch {
      setAiRuntime(current => ({ ...current, primary: 'basic_unavailable', basicServer: 'basic_unavailable' }))
      if (import.meta.env.MODE === 'production') throw new Error('Server AI scoring is unavailable. No simulated score was added.')
      judge = calculateMockScore(responses, understanding, movementBetween(stance, postStance))
      notify('Development mock scoring was used because server AI was unavailable.')
    }
    const now = new Date().toISOString()
    const result: ResultData = { id: makeUuid(), debateId, score: judge.total, movement: movementBetween(stance, postStance), understanding, mode: activeMode, take: activeTake, assignedSide: assignSide(stance, activeMode, activeTake), transcript, scores: judge.scores, coaching: judge.coaching, completedAt: now }
    const completedDebate: DebateSnapshot = { id: debateId, takeId: activeTake.id, mode: activeMode, step: 6, stance, postStance, confidence, understanding, responses, opponentMessages, assignedSide: assignSide(stance, activeMode, activeTake), language, status: 'completed', updatedAt: now, worldPulse: activeTake.worldPulse }
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
    const feedbackId = await repository.submitBetaFeedback(userId, payload)
    await apiFetch<{ accepted: boolean }>('/api/feedback/notify', { method: 'POST', headers: { ...(auth.accessToken ? { authorization: `Bearer ${auth.accessToken}` } : {}), ...(repository.backend === 'local' ? { 'x-sideshift-user-id': userId } : {}) }, body: JSON.stringify({ feedbackId, ...payload, language, platform: 'web' }) }).catch(() => undefined)
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
  if (auth.signedOut) return <SignedOutWelcome language={language} onStart={auth.continueAsGuest} onRequestSignInOtp={auth.requestSignInOtp} onVerifySignInOtp={auth.verifySignInOtp} />
  if (!repository || !userId) return <BackendGate title="Backend unavailable" message="SideShift could not establish an authenticated data path." action={{ label: 'Retry connection', onClick: auth.retry }} />
  if (legalPath === '/internal/world-pulse') return <Suspense fallback={<FeatureLoading language={language} />}><WorldPulseAdmin repository={repository} userId={userId} language={language} /></Suspense>
  if (challengeToken) return <Suspense fallback={<FeatureLoading language={language} />}><FriendClashRecipient token={challengeToken} repository={repository} userId={userId} language={language} online={online} /></Suspense>
  if (dataError) return <BackendGate title="Private data unavailable" message={dataError} action={{ label: 'Retry session', onClick: auth.retry }} />
  if (hydratedUserId !== userId) return <BackendGate title="Loading your space…" message="Restoring your private debates and preferences." />
  if (!hasOnboarded || showOnboarding) return <Onboarding userId={userId} language={language} initialProgress={{ stage: preferencesData.onboardingStage, goal: preferencesData.onboardingGoal, name: profileData.displayName || '', selected: preferencesData.topicPreferences }} onProgress={async (stage, goal, name, selected) => { if (!repository || !userId) return; const next = normalizePreferences({ ...preferencesData, userId, onboardingStage: stage, onboardingGoal: goal, topicPreferences: selected }); setPreferencesData(next); await repository.savePreferences(next); if (name.trim() && name !== profileData.displayName) { const nextProfile = normalizeProfile({ ...profileData, id: userId, displayName: name }); setProfileData(nextProfile); await repository.saveProfile(nextProfile) } }} onComplete={async (...args) => { await completeOnboarding(...args); setShowOnboarding(false) }} onLanguageChange={setLanguage} onFirstAction={action => { setActiveTake(activeTake); if (action === 'person') setScreen('clash'); else openTeamDebate() }} />
  const hasUnsavedDraft = screen === 'debate' ? Boolean(responses[debateStep]?.trim()) : screen === 'aiDebate' ? hasArgumentDraft(`ai:${debateId}`) || Boolean(aiSnapshot?.partialResponse) : false
  function navigate(next: Screen) {
    if (next === 'results' && !lastResult) return notify('Complete a debate to unlock your shifts.')
    if (next === screen) return
    if (hasUnsavedDraft && !window.confirm('You have an unsent argument. Leave it saved and return later?')) return
    setScreen(next)
  }
  const legacyChildren = screen === 'aiSetup' ? <AiSetup provider={aiProvider} basicProvider={basicAiProvider} puterProvider={mockAi ? mockAiProvider : liveAiProvider || unavailablePuterProvider} take={aiTake} language={language} preferences={preferencesData} preset={aiPreset} mock={mockAi} onStart={startAiDebate} onBack={() => setScreen('home')} /> : screen === 'aiDebate' && aiConfig && aiSnapshot ? <AiDebate provider={aiProvider} take={aiTake} language={language} config={aiConfig} snapshot={aiSnapshot} draftId={debateId} onSnapshot={setAiSnapshot} onComplete={completeAiDebate} onExit={() => void exitAiDebate()} onFeedback={recordAiFeedback} onNotify={notify} /> : screen === 'aiResults' && lastResult ? <><AiResults language={language} result={lastResult} onRematch={() => beginAiSetup(aiTake, aiConfig ? { ...aiConfig } : undefined)} onSwap={() => { if (aiConfig) void startAiDebate({ ...aiConfig, userSide: aiConfig.aiSide, aiSide: aiConfig.userSide }, aiTake).catch(caught => notify(caught instanceof Error ? caught.message : 'The AI rematch could not start.')) }} onChangeOpponent={() => beginAiSetup(aiTake)} onAnotherTake={() => beginAiSetup(selectPersonalizedTakes(interests, history.map(result => result.take.id), 1)[0] || takes[0])} /><BetaFeedbackForm language={language} surface="debate_result" screen="aiResults" aiModelId={lastResult.ai?.modelId} onSubmit={submitBetaFeedback} /></> : screen === 'home' ? <PersonalHome userName={userName} language={language} interests={interests} history={history} stats={personalStats} activeDebate={Boolean(debateId)} lastResult={lastResult} preferredMode={preferencesData.preferredMode} onBegin={beginDebate} onChooseDebate={beginDebateChoice} onResume={() => setScreen(aiSnapshot && aiConfig ? 'aiDebate' : 'debate')} onExplore={() => setScreen('explore')} onClash={() => setScreen('clash')} onProfile={() => setScreen('profile')} onSettings={() => setScreen('settings')} onNotify={notify} /> : screen === 'explore' ? <PersonalExplore language={language} interests={interests} recentIds={history.map(result => result.take.id)} onBegin={beginDebate} onChooseDebate={beginDebateChoice} onNotify={notify} /> : screen === 'profile' ? <PersonalProfile profile={profileData} language={language} stats={personalStats} history={history} onSettings={() => setScreen('settings')} onBack={() => setScreen('home')} /> : <SettingsScreen profile={profileData} preferences={preferencesData} aiMode={aiMode} backendLabel={repository.backend === 'supabase' ? 'Private cloud beta' : 'Device-only development'} repository={repository} userId={userId} onSaveProfile={saveProfileSettings} onSavePreferences={savePreferenceSettings} onDelete={() => void deleteBetaData()} onBack={() => setScreen('profile')} onNotify={notify} onSubmitFeedback={submitBetaFeedback} />
  const settingsChildren = <ProfileSettings profile={profileData} preferences={preferencesData} user={auth.user} userId={userId} repository={repository} language={language} onSaveProfile={saveProfileSettings} onSavePreferences={savePreferenceSettings} onBack={() => setScreen('profile')} onNotify={notify} onDelete={() => void deleteBetaData()} onSignOut={auth.resetSession} onRequestSecureAccountOtp={auth.requestSecureAccountOtp} onVerifySecureAccountOtp={auth.verifySecureAccountOtp} onOpenOnboarding={() => setShowOnboarding(true)} onOpenProfile={key => { setProfileViewKey(key); setProfileViewReturn('settings'); setScreen('profileView') }} hasUnsavedDraft={hasUnsavedDraft} />
// Active tree: App -> AppShellV2 -> screen-specific children.
  const children = <Suspense fallback={<FeatureLoading language={language} />}>
    {screen === 'friends' ? <Friends userId={userId} language={language} repository={repository} profile={profileData} onProfile={setProfileData} onBack={() => setScreen('home')} online={online} onNotify={notify} /> : screen === 'groups' ? <Groups userId={userId} language={language} repository={repository} initialGroupId={groupPathId} onStartTeam={openTeamDebate} onBack={() => setScreen('home')} onNotify={notify} /> : screen === 'team' ? <TeamDebate userId={userId} language={language} initialTake={activeTake} initialTopic={teamInitialTopic} groupId={activeGroupId} session={teamSession} onStart={startTeamSession} onSave={saveTeamSession} onBack={() => setScreen('home')} onNotify={notify} /> : screen === 'profileView' && profileViewKey ? <ProfileViewScreen userId={userId} profileKey={profileViewKey} language={language} repository={repository} onBack={() => setScreen(profileViewReturn)} /> : screen === 'settings' ? settingsChildren : screen === 'debateChoice' ? <ClassicDebateSetup take={activeTake} language={language} onBack={() => setScreen('home')} onAi={() => beginAiSetup(activeTake)} onPerson={() => setScreen('clash')} onTeam={() => openTeamDebate()} /> : screen === 'debate' ? <ClassicDebateSession activeTake={activeTake} language={language} mode={activeMode} step={debateStep} setStep={setDebateStep} stance={stance} setStance={setStance} confidence={confidence} setConfidence={setConfidence} postStance={postStance} setPostStance={setPostStance} understanding={understanding} setUnderstanding={setUnderstanding} responses={responses} setResponses={setResponses} opponentMessages={opponentMessages} setOpponentMessages={setOpponentMessages} onModeChange={setActiveMode} onComplete={completeDebate} onExit={() => setScreen('home')} onNotify={notify} onReport={submitReport} onPersistRound={persistDebateRound} aiMode={aiMode} online={online} /> : screen === 'results' && lastResult ? <><ClassicDebateResult result={lastResult} language={language} onBegin={beginDebate} onClash={() => setScreen('clash')} onNotify={notify} /><BetaFeedbackForm language={language} surface="debate_result" screen="results" onSubmit={submitBetaFeedback} /></> : screen === 'clash' ? <FriendClashSetup userId={userId} language={language} repository={repository} initialTake={activeTake} onBack={() => setScreen('home')} onBegin={beginDebate} onNotify={notify} online={online} /> : legacyChildren}
  </Suspense>
  function cycleLanguage() {
    const index = supportedLanguages.indexOf(language)
    const nextLanguage = supportedLanguages[(index + 1) % supportedLanguages.length]
    setLanguage(nextLanguage)
    persistLanguage(nextLanguage)
    if (repository && userId && profileData.id === userId) {
      const nextProfile = { ...profileData, interfaceLanguage: nextLanguage }
      const nextPreferences = { ...preferencesData, debateLanguages: [nextLanguage] }
      void Promise.all([repository.saveProfile(nextProfile), repository.savePreferences(nextPreferences)]).then(() => { setProfileData(nextProfile); setPreferencesData(nextPreferences) }).catch(() => undefined)
    }
  }
  return <AppShellV2 screen={screen} name={userName} historyCount={history.length} onNavigate={navigate} onLanguage={cycleLanguage} language={language} aiMode={aiMode} onNotify={notify} online={online} onDelete={() => void deleteBetaData()} hasUnsavedDraft={hasUnsavedDraft}>{repository.backend === 'local' && <div className="backend-warning" role="status">Development only: local persistence is active.</div>}{children}{toast && <div className="toast" role="status"><Icon name="info" size={15} /> {toast}</div>}{showGuide && <FirstUseGuide language={language} onClose={() => { markFirstUseGuideSeen(); setShowGuide(false) }} />}</AppShellV2>
}

export default App
