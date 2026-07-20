import { useEffect, useMemo, useState } from 'react'
import { AvatarPhotoPicker } from './components/AvatarPhotoPicker'
import { Button, Icon } from './components/SideShiftUI'
import type { AppRepository } from './data/repository'
import type { AccentTheme, ProfileField, ProfileFieldVisibility, ProfileVisibility, SocialLink, SocialProvider, UserPreferences, UserProfile } from './data/types'
import type { Language, Mode } from './domain'
import { accountSecurityState, type AccountSecurityState } from './accountSecurity'
import { normalizePreferences, normalizeProfile } from './profile'
import { filterProfileForViewer, validateSocialLink, type ProfileViewerRole } from './profileVisibility'
import { useTranslations } from './i18n'

type Section = 'hub' | 'profile' | 'privacy' | 'debate' | 'appearance' | 'account' | 'help'

type ProfileSettingsProps = {
  profile: UserProfile
  preferences: UserPreferences
  user: { is_anonymous?: boolean; email?: string | null; identities?: Array<{ provider?: string | null }> | null } | null
  userId: string
  repository: AppRepository
  language: Language
  onSaveProfile: (profile: UserProfile) => Promise<void>
  onSavePreferences: (preferences: UserPreferences) => Promise<void>
  onBack: () => void
  onNotify: (message: string) => void
  onDelete: () => void
  onSignOut: () => Promise<void>
  onOpenOnboarding: () => void
  onOpenProfile: (profileKey: string) => void
}

const socialProviders: SocialProvider[] = ['instagram', 'tiktok', 'youtube', 'twitch', 'github', 'spotify', 'x', 'website']
const profileFields: Array<ProfileField> = ['displayName', 'bio', 'avatar', 'profileAccent', 'statistics', 'socialLinks']

function visibilityLabel(value: ProfileVisibility, t: ReturnType<typeof useTranslations>): string {
  return value === 'public' ? t('profileSettings.publicViewer') : value === 'friends' ? t('profileSettings.friendViewer') : value === 'shared_groups' ? t('profileSettings.groupViewer') : t('profileSettings.outsiderViewer')
}

function fieldLabel(field: ProfileField, t: ReturnType<typeof useTranslations>): string {
  return field === 'displayName' ? t('onboarding.displayName') : field === 'profileAccent' ? t('settings.accent') : field === 'statistics' ? t('profileSettings.statistics') : field === 'socialLinks' ? t('profileSettings.socialLinks') : field === 'avatar' ? t('friends.photo') : t('settings.shortBio')
}

export function ProfileSettings({ profile, preferences, user, userId, repository, language, onSaveProfile, onSavePreferences, onBack, onNotify, onDelete, onSignOut, onOpenOnboarding, onOpenProfile }: ProfileSettingsProps) {
  const t = useTranslations(language)
  const [section, setSection] = useState<Section>('hub')
  const [draft, setDraft] = useState(profile)
  const [draftPreferences, setDraftPreferences] = useState(preferences)
  const [busy, setBusy] = useState(false)
  const [previewRole, setPreviewRole] = useState<ProfileViewerRole>('outsider')
  const security = accountSecurityState(user)
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(profile) || JSON.stringify(draftPreferences) !== JSON.stringify(preferences)
  useEffect(() => { if (!busy) { setDraft(profile); setDraftPreferences(preferences) } }, [busy, preferences, profile])
  useEffect(() => {
    function handleNativeBack(event: Event) {
      if (section === 'hub') return
      event.preventDefault()
      if (!hasChanges || window.confirm(t('common.cancel'))) setSection('hub')
    }
    window.addEventListener('sideshift-native-back', handleNativeBack)
    return () => window.removeEventListener('sideshift-native-back', handleNativeBack)
  }, [hasChanges, section, t])

  async function saveProfile() {
    setBusy(true)
    try { await onSaveProfile(normalizeProfile(draft)); onNotify(t('profileSettings.profileSaved')); setSection('hub') } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('friends.unavailable')) } finally { setBusy(false) }
  }

  async function savePreferences() {
    setBusy(true)
    try { await onSavePreferences(normalizePreferences(draftPreferences)); onNotify(t('settings.saved')); setSection('hub') } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('settings.deleteError')) } finally { setBusy(false) }
  }

  async function upload(file: Blob) {
    setBusy(true)
    try { const path = await repository.uploadAvatar(userId, file, 'image/webp'); await onSaveProfile(normalizeProfile({ ...draft, avatarPath: path, avatarRevision: (draft.avatarRevision || 0) + 1 })); onNotify(t('profileSettings.profileSaved')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('friends.unavailable')) } finally { setBusy(false) }
  }

  async function removeAvatar() {
    setBusy(true)
    try { await repository.removeAvatar(userId); await onSaveProfile(normalizeProfile({ ...draft, avatarPath: null, avatarRevision: (draft.avatarRevision || 0) + 1 })); onNotify(t('profileSettings.profileSaved')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('friends.unavailable')) } finally { setBusy(false) }
  }

  function addLink() {
    if (draft.socialLinks.length >= 5) return onNotify(t('profileSettings.linkLimit'))
    setDraft(current => ({ ...current, socialLinks: [...current.socialLinks, { provider: 'website', url: '', label: null, visibility: 'friends', order: current.socialLinks.length }] }))
  }

  function updateLink(index: number, patch: Partial<SocialLink>) {
    setDraft(current => ({ ...current, socialLinks: current.socialLinks.map((link, itemIndex) => itemIndex === index ? { ...link, ...patch } : link) }))
  }

  function removeLink(index: number) {
    setDraft(current => ({ ...current, socialLinks: current.socialLinks.filter((_, itemIndex) => itemIndex !== index).map((link, order) => ({ ...link, order })) }))
  }

  function validateLinks(): boolean {
    for (const link of draft.socialLinks) if (!validateSocialLink(link.provider, link.url)) { onNotify(t('profileSettings.linkInvalid')); return false }
    return true
  }

  const preview = useMemo(() => filterProfileForViewer({ overall: draft.profileVisibility, fields: draft.fieldVisibility }, previewRole, { displayName: draft.displayName, bio: draft.bio, socialLinks: draft.socialLinks }), [draft, previewRole])
  const title = section === 'hub' ? t('profileSettings.hub') : section === 'profile' ? t('profileSettings.profile') : section === 'privacy' ? t('profileSettings.privacy') : section === 'debate' ? t('profileSettings.debate') : section === 'appearance' ? t('profileSettings.appearance') : section === 'account' ? t('profileSettings.account') : t('profileSettings.help')

  function goBack() { if (section === 'hub') onBack(); else if (!hasChanges || window.confirm(t('common.cancel'))) setSection('hub') }

  if (section === 'hub') return <div className="page profile-settings-page"><div className="page-heading"><div><span className="eyebrow">{t('settings.eyebrow')}</span><h1>{t('profileSettings.hub')}<span className="heading-period">.</span></h1><p className="muted">{t('profileSettings.hubBody')}</p></div></div><div className="settings-hub-list">{(['profile', 'privacy', 'debate', 'appearance', 'account', 'help'] as const).map(item => <button type="button" className="settings-hub-row card-surface" key={item} onClick={() => setSection(item)}><span className="settings-hub-icon"><Icon name={item === 'profile' ? 'person' : item === 'privacy' || item === 'account' ? 'shield' : item === 'appearance' ? 'sun' : item === 'help' ? 'help' : 'spark'} size={20} /></span><span><strong>{t(`profileSettings.${item}`)}</strong><small>{t(`profileSettings.${item}Body`)}</small></span><Icon name="chevron" size={18} /></button>)}</div><button type="button" className="back-link" onClick={onBack}><Icon name="arrow" size={15} /> {t('common.back')}</button></div>

  return <div className="page profile-settings-page"><div className="page-heading compact-page-heading"><div><button type="button" className="back-link" onClick={goBack}><Icon name="arrow" size={15} /> {t('common.back')}</button><span className="eyebrow">{t('settings.eyebrow')}</span><h1>{title}<span className="heading-period">.</span></h1></div>{(section === 'profile' || section === 'debate' || section === 'appearance') && <Button variant="dark" onClick={() => void (section === 'profile' ? (validateLinks() ? saveProfile() : Promise.resolve()) : section === 'appearance' ? savePreferences() : savePreferences())} disabled={busy}>{busy ? t('common.saving') : t('common.save')}</Button>}</div>
    {section === 'profile' && <section className="settings-section card-surface profile-editor-section"><div className="profile-editor-avatar"><AvatarPhotoPicker language={language} hasAvatar={Boolean(draft.avatarPath)} busy={busy} onUpload={upload} onRemove={removeAvatar} onNotify={onNotify} /></div><label className="field-label">{t('onboarding.displayName')}<input className="text-input" maxLength={24} value={draft.displayName || ''} onChange={event => setDraft(current => ({ ...current, displayName: event.target.value }))} /></label><label className="field-label">{t('friends.handle')}<input className="text-input" maxLength={24} value={draft.handle || ''} onChange={event => setDraft(current => ({ ...current, handle: event.target.value }))} placeholder="@handle" /></label><label className="field-label">{t('settings.shortBio')} <span>({(draft.bio || '').length}/160)</span><textarea className="settings-textarea" maxLength={160} value={draft.bio || ''} onChange={event => setDraft(current => ({ ...current, bio: event.target.value }))} placeholder={t('settings.bioPlaceholder')} /></label><label className="field-label">{t('settings.presetAvatar')}<select className="settings-select" value={draft.avatarPreset} onChange={event => setDraft(current => ({ ...current, avatarPreset: event.target.value as UserProfile['avatarPreset'] }))}><option value="orbit">Orbit</option><option value="spark">Spark</option><option value="wave">Wave</option><option value="sun">Sun</option><option value="leaf">Leaf</option></select></label><h2>{t('profileSettings.socialLinks')}</h2><p className="field-help">{t('profileSettings.userProvided')}</p>{draft.socialLinks.map((link, index) => <div className="social-link-editor" key={`${link.provider}-${index}`}><select className="settings-select" value={link.provider} onChange={event => updateLink(index, { provider: event.target.value as SocialProvider })}>{socialProviders.map(provider => <option key={provider} value={provider}>{provider}</option>)}</select><input className="text-input" value={link.url} onChange={event => updateLink(index, { url: event.target.value })} placeholder={t('profileSettings.linkUrl')} /><select className="settings-select" value={link.visibility} onChange={event => updateLink(index, { visibility: event.target.value as ProfileVisibility })}>{(['private', 'friends', 'shared_groups', 'public'] as ProfileVisibility[]).map(value => <option key={value} value={value}>{visibilityLabel(value, t)}</option>)}</select><button type="button" className="text-link" onClick={() => removeLink(index)}>{t('profileSettings.removeLink')}</button></div>)}<Button variant="secondary" onClick={addLink} disabled={draft.socialLinks.length >= 5}>{t('profileSettings.addLink')}</Button></section>}
    {section === 'privacy' && <><section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('profileSettings.privacy')}</span><h2>{t('profileSettings.profileVisibility')}</h2></div><Icon name="lock" size={20} /></div><label className="field-label">{t('profileSettings.profileVisibility')}<select className="settings-select" value={draft.profileVisibility} onChange={event => setDraft(current => ({ ...current, profileVisibility: event.target.value as ProfileVisibility }))}>{(['private', 'friends', 'shared_groups', 'public'] as ProfileVisibility[]).map(value => <option key={value} value={value}>{visibilityLabel(value, t)}</option>)}</select></label><p className="field-help">{t('settings.privacyInfo')}</p>{profileFields.map(field => <label className="field-label" key={field}>{fieldLabel(field, t)}<select className="settings-select" value={draft.fieldVisibility[field]} onChange={event => setDraft(current => ({ ...current, fieldVisibility: { ...current.fieldVisibility, [field]: event.target.value as ProfileVisibility } }))}>{(['private', 'friends', 'shared_groups', 'public'] as ProfileVisibility[]).map(value => <option key={value} value={value}>{visibilityLabel(value, t)}</option>)}</select></label>)}<span className="field-label">{t('profileSettings.statistics')}</span>{(['debates', 'sideSwitches', 'constructive', 'argumentDna'] as const).map(stat => <label className="toggle-row" key={stat}><input type="checkbox" checked={draft.visibleStats[stat]} onChange={event => setDraft(current => ({ ...current, visibleStats: { ...current.visibleStats, [stat]: event.target.checked } }))} /><span>{stat === 'debates' ? t('friends.statDebates') : stat === 'sideSwitches' ? t('friends.statSideSwitches') : stat === 'constructive' ? t('friends.statConstructive') : t('friends.statArgumentDna')}</span></label>)}</section><section className="settings-section card-surface"><h2>{t('profileSettings.preview')}</h2><label className="field-label">{t('profileSettings.previewAs')}<select className="settings-select" value={previewRole} onChange={event => setPreviewRole(event.target.value as ProfileViewerRole)}><option value="outsider">{t('profileSettings.publicViewer')}</option><option value="friend">{t('profileSettings.friendViewer')}</option><option value="shared_group">{t('profileSettings.groupViewer')}</option></select></label><div className="profile-preview-box"><strong>{String(preview.displayName || t('profileSettings.privateProfile'))}</strong>{Boolean(preview.bio) && <p>{String(preview.bio)}</p>}{Array.isArray(preview.socialLinks) && preview.socialLinks.length > 0 && <small>{t('profileSettings.socialLinks')}: {preview.socialLinks.length}</small>}</div><Button variant="secondary" onClick={() => profile.publicProfileKey && onOpenProfile(profile.publicProfileKey)} disabled={!profile.publicProfileKey}>{t('profileSettings.preview')}</Button></section></>}
    {section === 'debate' && <section className="settings-section card-surface"><label className="field-label">{t('settings.interfaceLanguage')}<select className="settings-select" value={draftPreferences.debateLanguages[0]} onChange={event => setDraftPreferences(current => ({ ...current, debateLanguages: [event.target.value as Language] }))}><option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option><option value="it">Italiano</option></select></label><label className="field-label">{t('settings.defaultMode')}<select className="settings-select" value={draftPreferences.preferredMode} onChange={event => setDraftPreferences(current => ({ ...current, preferredMode: event.target.value as Mode }))}><option value="sideswitch">SideSwitch</option><option value="classic">Classic</option><option value="blindside">Blindside</option><option value="commonground">CommonGround</option></select></label><label className="field-label">{t('settings.aiFamily')}<select className="settings-select" value={draftPreferences.preferredAiFamily} onChange={event => setDraftPreferences(current => ({ ...current, preferredAiFamily: event.target.value as UserPreferences['preferredAiFamily'] }))}><option value="GPT">GPT</option><option value="Gemini">Gemini</option><option value="Claude">Claude</option><option value="DeepSeek">DeepSeek</option></select></label><label className="field-label">{t('settings.responseLength')}<select className="settings-select" value={draftPreferences.aiResponseLength} onChange={event => setDraftPreferences(current => ({ ...current, aiResponseLength: event.target.value as UserPreferences['aiResponseLength'] }))}><option value="concise">Concise</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label></section>}
    {section === 'appearance' && <section className="settings-section card-surface"><label className="field-label">{t('settings.theme')}<select className="settings-select" value={draftPreferences.theme} onChange={event => setDraftPreferences(current => ({ ...current, theme: event.target.value as UserPreferences['theme'] }))}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label className="field-label">{t('settings.textSize')}<select className="settings-select" value={draftPreferences.textSize} onChange={event => setDraftPreferences(current => ({ ...current, textSize: event.target.value as UserPreferences['textSize'] }))}><option value="compact">Standard</option><option value="comfortable">Large</option></select></label><label className="toggle-row"><input type="checkbox" checked={draftPreferences.reducedMotion} onChange={event => setDraftPreferences(current => ({ ...current, reducedMotion: event.target.checked }))} /><span>{t('settings.reduceMotion')}</span></label></section>}
    {section === 'account' && <section className="settings-section card-surface"><div className="settings-section-heading"><div><span className="eyebrow">{t('profileSettings.security')}</span><h2>{security === 'anonymous' ? t('profileSettings.anonymous') : security === 'email' ? t('profileSettings.email') : t('profileSettings.oauth')}</h2></div><Icon name="shield" size={20} /></div>{security === 'anonymous' && <p className="form-warning" role="alert">{t('profileSettings.anonymousWarning')}</p>}<p className="field-help">{t('profileSettings.accountBody')}</p><Button variant="secondary" onClick={() => { if (security === 'anonymous') { const phrase = window.prompt(`${t('profileSettings.signOutWarning')}\n\n${t('profileSettings.signOutConfirm')}`); if (phrase !== t('profileSettings.signOutConfirm')) return } else if (!window.confirm(t('profileSettings.signOut'))) return; void onSignOut() }}>{t('profileSettings.signOut')}</Button><Button variant="ghost" onClick={onDelete}>{t('shell.deleteData')}</Button></section>}
    {section === 'help' && <section className="settings-section card-surface"><Button variant="secondary" onClick={onOpenOnboarding}>{t('profileSettings.help')}</Button><p className="field-help">{t('profileSettings.helpBody')}</p><span className="muted">SideShift beta</span></section>}
  </div>
}
