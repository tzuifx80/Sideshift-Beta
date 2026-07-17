import type { ReactNode } from 'react'

export type IconName = 'arrow' | 'arrowUp' | 'bolt' | 'book' | 'calendar' | 'check' | 'chevron' | 'clock' | 'close' | 'copy' | 'flame' | 'globe' | 'help' | 'home' | 'info' | 'layers' | 'link' | 'lock' | 'message' | 'more' | 'person' | 'plus' | 'search' | 'send' | 'settings' | 'share' | 'shield' | 'spark' | 'star' | 'sun' | 'target' | 'trophy' | 'users' | 'x'

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
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

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark"><span /></span>{!compact && <span className="brand-word">Side<span>Shift</span></span>}</div>
}

export function Button({ children, variant = 'primary', icon, onClick, type = 'button', className = '', disabled = false }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'dark' | 'soft'; icon?: IconName; onClick?: () => void; type?: 'button' | 'submit'; className?: string; disabled?: boolean }) {
  return <button type={type} className={`button button-${variant} ${className}`} onClick={onClick} disabled={disabled}>{children}{icon && <Icon name={icon} size={16} />}</button>
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`tag tag-${tone}`}>{children}</span>
}
