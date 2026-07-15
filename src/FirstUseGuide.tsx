import { useEffect, useRef } from 'react'
import type { Language } from './domain'

type GuideCopy = {
  title: string
  intro: string
  close: string
  next: string
  back: string
  steps: Array<{ title: string; body: string }>
}

const copy: Record<Language, GuideCopy> = {
  en: {
    title: 'How SideShift works',
    intro: 'A short, private perspective game. There is no right answer to discover.',
    close: 'Got it',
    next: 'Next',
    back: 'Back',
    steps: [
      { title: 'Choose a side', body: 'Start with your honest stance. SideSwitch may ask you to defend the opposite view.' },
      { title: 'Make the strongest case', body: 'Answer one focused prompt at a time. Your argument stays private unless you choose to share it.' },
      { title: 'Reflect, then review', body: 'Your movement and Argument DNA describe this conversation, not your intelligence or identity.' },
      { title: 'Invite a person', body: 'Person challenges are async: send a private link, then compare responses when they reply.' },
    ],
  },
  de: {
    title: 'So funktioniert SideShift',
    intro: 'Ein kurzes, privates Perspektivspiel. Es gibt keine richtige Antwort, die du finden musst.',
    close: 'Verstanden',
    next: 'Weiter',
    back: 'Zurück',
    steps: [
      { title: 'Wähle eine Seite', body: 'Starte mit deiner ehrlichen Haltung. Bei SideSwitch verteidigst du vielleicht die Gegenposition.' },
      { title: 'Führe das stärkste Argument an', body: 'Beantworte jeweils eine klare Frage. Dein Argument bleibt privat, außer du teilst es.' },
      { title: 'Reflektiere und prüfe', body: 'Bewegung und Argument-DNA beschreiben dieses Gespräch, nicht deine Intelligenz oder Identität.' },
      { title: 'Lade eine Person ein', body: 'Personen-Challenges sind asynchron: Sende einen privaten Link und vergleiche die Antworten später.' },
    ],
  },
}

export const GUIDE_SEEN_KEY = 'sideshift-guide-seen-v1'

export function hasSeenFirstUseGuide(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(GUIDE_SEEN_KEY) === '1'
}

export function markFirstUseGuideSeen(): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(GUIDE_SEEN_KEY, '1')
}

export function FirstUseGuide({ language, onClose }: { language: Language; onClose: () => void }) {
  const text = copy[language]
  const dialogRef = useRef<HTMLDivElement>(null)
  const step = 0
  // The component is intentionally static in the DOM so focus and screen-reader output stay predictable.
  useEffect(() => {
    dialogRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  return <div className="guide-backdrop" role="presentation"><div className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title" tabIndex={-1} ref={dialogRef}><div className="guide-dialog-top"><span className="eyebrow">SIDESHIFT</span><button type="button" className="icon-button" aria-label={language === 'de' ? 'Guide schließen' : 'Close guide'} onClick={onClose}>×</button></div><h2 id="guide-title">{text.title}</h2><p className="guide-intro">{text.intro}</p><div className="guide-steps">{text.steps.map((item, index) => <article className="guide-step" key={item.title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div><div className="guide-actions"><small>{step + 1} / {text.steps.length}</small><button type="button" className="button button-dark" onClick={onClose}>{text.close}</button></div></div></div>
}
