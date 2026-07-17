import { useEffect, useState } from 'react'
import { getTake, takeText, type Language } from '../../domain'
import { RepositoryError, type AppRepository, type ChallengeResolved } from '../../data/repository'
import { useOnlineStatus } from '../../pwa'
import { trackEvent } from '../../analytics'
import { useTranslations } from '../../i18n'
import { Button, Icon, Tag } from '../../components/SideShiftUI'

type ChallengeView = ChallengeResolved & { take: ReturnType<typeof getTake> }

function challengeError(caught: unknown, t: ReturnType<typeof useTranslations>): string {
  if (caught instanceof RepositoryError) {
    if (caught.code === 'not_found') return t('clash.expired')
    if (caught.code === 'conflict') return t('clash.alreadyAnswered')
  }
  return t('clash.responseFailed')
}

export function ChallengeRecipient({ token, repository, userId, language, online }: { token: string; repository: AppRepository; userId: string; language: Language; online?: boolean }) {
  const [challenge, setChallenge] = useState<ChallengeView | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const browserOnline = useOnlineStatus()
  const isOnline = online ?? browserOnline
  const t = useTranslations(language)

  useEffect(() => { repository.loadChallenge(token).then(value => { setChallenge({ ...value, take: getTake(value.takeId) }); trackEvent('challenge_opened', { status: value.status }) }).catch(caught => setError(challengeError(caught, t))).finally(() => setLoading(false)) }, [repository, token])

  async function submit() {
    if (!isOnline) return setError(t('clash.offlineResponse'))
    if (answer.trim().length < 12 || !challenge) return setError(t('clash.minArgument'))
    setLoading(true)
    setError('')
    try { const output = await repository.respondToChallenge(token, answer.trim(), userId); setResult(output.result); setChallenge({ ...output, take: getTake(output.takeId) }); trackEvent('challenge_completed', { score: output.result?.total || 0 }) } catch (caught) { setError(challengeError(caught, t)) } finally { setLoading(false) }
  }

  if (loading && !challenge) return <div className="onboarding-page"><div className="created-challenge"><span className="eyebrow">{t('clash.tag')}</span><h1>{t('clash.loading')}</h1></div></div>
  if (error && !challenge) return <div className="onboarding-page"><div className="created-challenge"><Tag tone="coral">{t('clash.unavailable')}</Tag><h1>{t('clash.reset')}</h1><p className="stage-intro" role="alert">{error}</p></div></div>
  if (!challenge) return null
  const text = takeText(challenge.take, language)
  if (challenge.status === 'expired') return <div className="onboarding-page"><div className="created-challenge"><Tag tone="coral">{t('clash.unavailable')}</Tag><h1>{t('clash.expired')}</h1></div></div>
  if (challenge.status === 'revoked') return <div className="onboarding-page"><div className="created-challenge"><Tag tone="coral">{t('clash.unavailable')}</Tag><h1>{t('clash.revoked')}</h1></div></div>
  const answered = Boolean(result || challenge.response || challenge.status === 'completed' || !challenge.canRespond)
  return <div className="onboarding-page"><div className="created-challenge challenge-recipient"><Tag tone="yellow">{t('clash.recipientTag')}</Tag><h1>{t('clash.recipientTitle')}</h1><p className="stage-intro">{t('clash.recipientBody')}</p><div className="challenge-preview card-surface"><Tag tone="yellow">{t('clash.take')}</Tag><h3>{text.statement}</h3><p className="muted">{text.context}</p><div className="preview-quote">“{challenge.argument}”</div></div>{answered ? <div className="created-icon"><Icon name="check" size={27} /></div> : <div className="clash-form card-surface"><label className="field-label" htmlFor="challenge-response">{t('clash.response')}</label><textarea id="challenge-response" className="clash-textarea" value={answer} onChange={event => setAnswer(event.target.value.slice(0, 350))} placeholder={t('clash.responsePlaceholder')} disabled={loading} /><Button className="full-width" icon="send" onClick={() => void submit()} disabled={answer.trim().length < 12 || loading}>{loading ? t('clash.submitting') : t('clash.sendCounter')}</Button>{error && <p className="form-error" role="alert">{error}</p>}</div>}{result && <p className="recipient-result" role="status">{t('clash.complete')} <strong>{result.total}/100</strong></p>}{challenge.response && !result && <p className="recipient-result" role="status">{t('clash.alreadyAnswered')}</p>}</div></div>
}

export const ChallengeRecipientDependencies = Object.freeze({ component: 'ChallengeRecipient', states: ['loading', 'open', 'completed', 'expired', 'revoked', 'error'] })
