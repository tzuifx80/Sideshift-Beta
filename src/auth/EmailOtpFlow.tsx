import { useEffect, useRef, useState } from 'react'
import { Button, Icon } from '../components/SideShiftUI'
import type { Language } from '../domain'
import { authFlowErrorCode, normalizeAuthEmail, type AuthFlowErrorCode } from './authFlow'
import { useTranslations } from '../i18n'

type EmailOtpFlowProps = {
  language: Language
  mode: 'sign-in' | 'secure-account'
  requestCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  onDone?: () => void
  onCancel?: () => void
  initialEmail?: string
}

const RESEND_COOLDOWN_SECONDS = 30

function errorKey(code: AuthFlowErrorCode): 'auth.emailInvalid' | 'auth.invalidCode' | 'auth.otpRequestFailed' | 'auth.otpVerificationFailed' | 'auth.rateLimited' | 'auth.expiredCode' | 'auth.emailInUse' | 'auth.sessionMissing' | 'auth.configDisabled' {
  if (code === 'invalid_email') return 'auth.emailInvalid'
  if (code === 'invalid_code') return 'auth.invalidCode'
  if (code === 'rate_limited') return 'auth.rateLimited'
  if (code === 'expired_code') return 'auth.expiredCode'
  if (code === 'email_in_use') return 'auth.emailInUse'
  if (code === 'session_missing') return 'auth.sessionMissing'
  if (code === 'auth_config_disabled') return 'auth.configDisabled'
  return code === 'otp_request_failed' ? 'auth.otpRequestFailed' : 'auth.otpVerificationFailed'
}

function safeErrorKey(error: unknown, phase: 'request' | 'verify'): Parameters<ReturnType<typeof useTranslations>>[0] {
  const code = authFlowErrorCode(error)
  if (code === 'otp_verification_failed' && phase === 'request') return 'auth.otpRequestFailed'
  return errorKey(code)
}

export function EmailOtpFlow({ language, mode, requestCode, verifyCode, onDone, onCancel, initialEmail = '' }: EmailOtpFlowProps) {
  const t = useTranslations(language)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code' | 'success'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const emailReady = (() => { try { normalizeAuthEmail(email); return true } catch { return false } })()

  useEffect(() => {
    if (!cooldown) return
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    if (stage !== 'code') return
    codeInputRef.current?.focus()
  }, [stage])

  async function sendCode() {
    setBusy(true); setError('')
    try {
      const nextEmail = normalizeAuthEmail(email)
      await requestCode(nextEmail)
      setEmail(nextEmail)
      setStage('code')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (caught) {
      setError(t(safeErrorKey(caught, 'request')))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true); setError('')
    try {
      await verifyCode(email, code)
      setStage('success')
      onDone?.()
    } catch (caught) {
      setError(t(safeErrorKey(caught, 'verify')))
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (stage === 'email') void sendCode()
    else if (code.length === 6) void verify()
  }

  if (stage === 'success') return <div className="auth-flow-success" role="status"><Icon name="check" size={20} /><strong>{mode === 'sign-in' ? t('auth.signedIn') : t('auth.accountSecured')}</strong></div>

  return <section className="auth-flow" aria-live="polite">
    <div className="auth-flow-heading"><span className="eyebrow">{mode === 'sign-in' ? t('auth.signInEyebrow') : t('auth.secureEyebrow')}</span><h2>{mode === 'sign-in' ? t('auth.signInTitle') : t('auth.secureTitle')}</h2><p className="muted">{mode === 'sign-in' ? t('auth.signInBody') : t('auth.secureBody')}</p></div>
    <form onSubmit={handleSubmit}>
      {stage === 'email' ? <>
        <label className="field-label" htmlFor={`auth-email-${mode}`}>{t('auth.emailLabel')}<input id={`auth-email-${mode}`} className="text-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setError('') }} placeholder={t('auth.emailPlaceholder')} /></label>
        <Button className="full-width" type="submit" disabled={busy || !emailReady}>{busy ? t('auth.sendingCode') : t('auth.sendCode')}</Button>
      </> : <>
        <p className="auth-flow-address">{email}</p>
        <label className="field-label" htmlFor={`auth-code-${mode}`}>{t('auth.codeLabel')}<input ref={codeInputRef} id={`auth-code-${mode}`} className="text-input auth-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} placeholder={t('auth.codePlaceholder')} /></label>
        <Button className="full-width" type="submit" disabled={busy || code.length !== 6}>{busy ? t('auth.verifyingCode') : t('auth.verifyCode')}</Button>
        <div className="auth-flow-secondary-actions"><button type="button" className="text-link" onClick={() => { setStage('email'); setCode(''); setError('') }} disabled={busy}>{t('auth.changeEmail')}</button><button type="button" className="text-link" onClick={() => void sendCode()} disabled={busy || cooldown > 0}>{cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resendCode')}</button></div>
      </>}
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {onCancel && <button type="button" className="text-link auth-flow-cancel" onClick={onCancel} disabled={busy}>{t('common.back')}</button>}
  </section>
}
