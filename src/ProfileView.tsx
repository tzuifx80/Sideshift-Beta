import { useEffect, useState } from 'react'
import { Button, Icon, Tag } from './components/SideShiftUI'
import { ProfileAvatar } from './components/ProfileAvatar'
import type { AppRepository, ProfileView as ProfileViewData } from './data/repository'
import type { Language } from './domain'
import { useTranslations } from './i18n'

export function ProfileViewScreen({ userId, profileKey, language, repository, onBack }: { userId: string; profileKey: string; language: Language; repository: AppRepository; onBack: () => void }) {
  const t = useTranslations(language)
  const [view, setView] = useState<ProfileViewData | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setView(null); setError(false)
    void repository.getProfileForViewer(userId, profileKey).then(next => { if (active) setView(next) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [profileKey, repository, userId])
  if (error) return <div className="page profile-detail-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('common.back')}</button><section className="empty-state card-surface"><Icon name="info" size={22} /><strong>{t('profileSettings.unavailable')}</strong></section></div>
  if (!view) return <div className="page profile-detail-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('common.back')}</button><p className="muted">{t('common.loading')}</p></div>
  if (view.state !== 'available' || !view.profile) return <div className="page profile-detail-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('common.back')}</button><section className="empty-state card-surface"><Icon name="lock" size={22} /><strong>{view.state === 'private' ? t('profileSettings.privateProfile') : t('profileSettings.unavailable')}</strong></section></div>
  const profile = view.profile
  const avatar = { id: profile.profileKey, displayName: profile.displayName, avatarPreset: profile.avatarPreset, avatarPath: profile.avatarPath }
  const statLabels: Record<string, string> = { debatesCompleted: t('profileSettings.debatesCompleted'), sideSwitchesCompleted: t('profileSettings.sideSwitchesCompleted'), topicsExplored: t('profileSettings.topicsExplored'), challengeResponses: t('profileSettings.challengeResponses'), challengesCreated: t('profileSettings.challengesCreated'), languagesUsed: t('profileSettings.languagesUsed') }
  return <div className="page profile-detail-page"><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('common.back')}</button><section className="profile-detail-hero card-surface"><ProfileAvatar profile={avatar} repository={repository} userId={userId} className="profile-detail-avatar" /><div><span className="eyebrow">{view.isOwner ? t('profile.eyebrow') : view.relationship === 'friend' ? t('profileSettings.friendViewer') : t('profileSettings.profile')}</span><h1>{profile.displayName || profile.handle || t('friends.member')}</h1>{profile.handle && <p className="profile-handle">@{profile.handle}</p>}{profile.bio && <p className="profile-bio">{profile.bio}</p>}<Tag tone="coral">{view.isOwner ? t('common.private') : view.relationship === 'shared_group' ? t('profileSettings.groupViewer') : view.relationship === 'friend' ? t('profileSettings.friendViewer') : t('profileSettings.publicViewer')}</Tag></div></section>{Object.keys(view.statistics).length > 0 ? <section className="profile-detail-section"><div className="section-heading"><div><span className="eyebrow">{t('profileSettings.statistics')}</span><h2>{t('profileSettings.statistics')}</h2></div></div><div className="profile-stat-list">{Object.entries(view.statistics).map(([key, value]) => <div className="profile-stat-row" key={key}><strong>{value}</strong><span>{statLabels[key] || key}</span></div>)}</div></section> : <p className="muted profile-detail-muted">{t('profileSettings.noStats')}</p>}{view.socialLinks.length > 0 && <section className="profile-detail-section"><div className="section-heading"><div><span className="eyebrow">{t('profileSettings.socialLinks')}</span><h2>{t('profileSettings.socialLinks')}</h2></div></div><div className="profile-social-list">{view.socialLinks.map(link => <a key={`${link.provider}-${link.order}`} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.provider}. ${t('profileSettings.openExternal')}`}>{link.label || link.provider}<Icon name="link" size={14} /></a>)}</div><p className="field-help">{t('profileSettings.userProvided')}</p></section>}<Button variant="secondary" onClick={onBack}>{t('common.back')}</Button></div>
}
