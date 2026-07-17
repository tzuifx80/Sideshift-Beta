import { useEffect, useState } from 'react'
import { getTake, takeText, takes, type Language, type Take, type Mode } from '../../domain'
import type { AppRepository, ChallengeRecord } from '../../data/repository'
import { useOnlineStatus } from '../../pwa'
import { trackEvent } from '../../analytics'
import { formatDate, useTranslations } from '../../i18n'
import { copyText } from '../../lib/clipboard'
import { Button, Icon, Tag } from '../../components/SideShiftUI'

export type CreatedChallenge = Omit<ChallengeRecord, 'token' | 'url'> & { token: string | null; url: string | null; take: Take }
type BeginHandler = (mode: Mode, take?: Take) => void | Promise<void>

function appUrl(path: string): string {
  const base = String(import.meta.env.VITE_APP_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  return `${base}${path}`
}

export function FriendClashSetup({ userId, language, repository, onBack, onBegin, onNotify, online, initialTake }: { userId: string; language: Language; repository: AppRepository; onBack: () => void; onBegin: BeginHandler; onNotify: (message: string) => void; online?: boolean; initialTake?: Take }) {
  const [argument, setArgument] = useState('')
  const [created, setCreated] = useState<CreatedChallenge | null>(null)
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState('')
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  const t = useTranslations(language)
  const challengeTake = initialTake || takes.find(take => take.id === 'society-media-age') || takes[0]

  useEffect(() => { let active = true; repository.listChallenges(userId).then(items => { const item = items[0]; if (!active || !item) return; setCreated({ ...item, token: null, url: null, take: getTake(item.takeId) }); setResponse(item.response) }).catch(() => undefined); return () => { active = false } }, [repository, userId])
  useEffect(() => { if (!created) return; let active = true; const check = async () => { try { const current = created.token ? await repository.loadChallenge(created.token) : (await repository.listChallenges(userId)).find(item => item.id === created.id); if (!active || !current) return; setResponse(current.response); setCreated(previous => previous ? { ...previous, status: current.status, response: current.response, result: current.result } : previous) } catch { /* polling is best effort */ } }; void check(); const timer = window.setInterval(check, 5000); return () => { active = false; window.clearInterval(timer) } }, [created?.id, created?.token, repository, userId])

  async function createChallenge() {
    if (!isOnline) return setError(t('clash.offlineCreate'))
    if (argument.trim().length < 12) return setError(t('clash.minArgument'))
    setError('')
    try { const output = await repository.createChallenge(userId, { takeId: challengeTake.id, argument: argument.trim(), mode: 'classic', creatorSide: challengeTake.supportLabel }); setCreated({ ...output, take: challengeTake }); setResponse(null); trackEvent('challenge_created', { mode: 'classic' }) } catch { setError(t('clash.creationFailed')) }
  }

  const content = !created
    ? <div className="clash-layout"><div className="clash-copy"><Tag tone="yellow">{t('clash.tag')}</Tag><h1>{t('clash.title')}</h1><p className="stage-intro">{t('clash.body')}</p><div className="clash-steps"><div><span>01</span><strong>{t('clash.stepOpen')}</strong><small>{t('clash.stepOpenBody')}</small></div><div><span>02</span><strong>{t('clash.stepCounter')}</strong><small>{t('clash.stepCounterBody')}</small></div><div><span>03</span><strong>{t('clash.stepRead')}</strong><small>{t('clash.stepReadBody')}</small></div></div></div><div className="clash-form card-surface"><div className="card-topline"><span className="eyebrow">{t('clash.chooseTake')}</span><Tag tone="mint"><Icon name="lock" size={12} /> {t('clash.secureLink')}</Tag></div><button type="button" className="clash-take-picker" onClick={() => void onBegin('classic', challengeTake)}><span className="take-picker-icon coral">✦</span><span><small>{t('clash.worldTake')}</small><strong>{takeText(challengeTake, language).statement}</strong></span><Icon name="chevron" size={17} /></button><div className="clash-form-divider" /><label className="field-label" htmlFor="clash-argument">{t('clash.opening')}</label><textarea id="clash-argument" className="clash-textarea" value={argument} onChange={event => setArgument(event.target.value.slice(0, 350))} placeholder={t('clash.openingPlaceholder')} /><div className="response-box-bottom"><span className="counter">{argument.length} / 350</span><Button icon="link" onClick={() => void createChallenge()} disabled={argument.trim().length < 12}>{t('clash.create')}</Button></div>{error && <p className="form-error" role="alert">{error}</p>}<p className="onboarding-footnote"><Icon name="shield" size={14} /> {t('clash.secureNote')}</p></div></div>
    : <FriendClashSession created={created} response={response} language={language} onBack={onBack} onNotify={onNotify} />

  return <div className="page clash-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('clash.back')}</button>{content}</div>
}

function FriendClashSession({ created, response, language, onBack, onNotify }: { created: CreatedChallenge; response: string | null; language: Language; onBack: () => void; onNotify: (message: string) => void }) {
  const [copied, setCopied] = useState(false)
  const t = useTranslations(language)
  const url = created.token && created.url ? appUrl(created.url) : ''
  async function shareChallenge() {
    if (!created.token || !created.url) return onNotify(t('clash.linkUnavailable'))
    trackEvent('share_attempted', { surface: 'challenge' })
    if (navigator.share) { try { await navigator.share({ title: t('clash.tag'), text: t('clash.body'), url }); return } catch { return } }
    onNotify(await copyText(url) ? t('clash.linkCopied') : t('clash.clipboardUnavailable'))
  }
  const take = takeText(created.take, language)
  return <div className="created-challenge"><div className="created-icon"><Icon name="link" size={27} /></div><span className="eyebrow">{t('clash.ready')}</span><h1>{t('clash.readyTitle')}</h1><p className="stage-intro">{t('clash.readyBody')}</p><div className="generated-link"><span><Icon name="globe" size={16} /> {url}</span><button type="button" aria-label={t('clash.copy')} onClick={async () => { setCopied(await copyText(url)); if (!navigator.clipboard) onNotify(t('clash.clipboardUnavailable')) }}>{copied ? <><Icon name="check" size={15} /> {t('clash.copied')}</> : <><Icon name="copy" size={15} /> {t('clash.copy')}</>}</button></div><div className="challenge-preview card-surface"><div><Tag tone="yellow">{t('clash.tag')}</Tag><h3>{take.statement}</h3></div><div className="preview-quote">“{created.argument}”</div><div className="preview-footer"><span><Icon name="clock" size={13} /> {t('clash.expires', { date: formatDate(created.expiresAt, language) })}</span><span><Icon name="users" size={13} /> {created.status === 'expired' ? t('clash.expired') : response ? t('clash.counterReceived') : t('clash.waitingCounter')}</span></div>{response && <FriendClashResult response={response} language={language} />}</div><div className="created-actions"><Button variant="dark" icon="share" onClick={() => void shareChallenge()}>{t('clash.share')}</Button><Button variant="secondary" icon="arrow" onClick={onBack}>{t('clash.done')}</Button></div></div>
}

export function FriendClashResult({ response, language }: { response: string; language: Language }) {
  const t = useTranslations(language)
  return <p className="challenge-response" role="status"><strong>{t('clash.friendResponse')}</strong> {response}</p>
}

export const FriendClashDependencies = Object.freeze({ setup: 'FriendClashSetup', session: 'FriendClashSession', result: 'FriendClashResult' })
