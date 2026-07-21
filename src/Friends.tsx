import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Icon, Tag } from './components/SideShiftUI'
import type { AppRepository, FriendChallengeRecord, FriendshipRecord, GroupFriendInvitation, ProfilePreview } from './data/repository'
import type { GroupSummary } from './collaboration'
import type { Language } from './domain'
import type { UserProfile } from './data/types'
import { getTake, takes } from './domain'
import { useTranslations } from './i18n'
import { ProfileViewScreen } from './ProfileView'
import { humanProfileKey } from './profileNavigation'
import { LeaguePanel } from './features/league/LeaguePanel'

function displayName(profile: ProfilePreview | null) { return profile?.displayName || (profile?.handle ? `@${profile.handle}` : '') }
const ProfileNavigationContext = createContext<((profileKey: string) => void) | undefined>(undefined)

function Avatar({ repository, userId, profile }: { repository: AppRepository; userId: string; profile: ProfilePreview | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (!profile?.avatarPath) { setUrl(null); return () => { active = false } }
    setUrl(null)
    void repository.getAvatarUrl(userId, profile.avatarPath).then(value => { if (active) setUrl(value) }).catch(() => { if (active) setUrl(null) })
    return () => { active = false }
  }, [profile, repository, userId])
  return <span className="friends-avatar">{url ? <img src={url} alt="" /> : <span>{(profile?.displayName || profile?.handle || '?').slice(0, 1).toUpperCase()}</span>}</span>
}

function ProfilePreviewRow({ repository, userId, profile, fallback, children, onOpenProfile }: { repository: AppRepository; userId: string; profile: ProfilePreview | null; fallback: string; children?: ReactNode; onOpenProfile?: (profileKey: string) => void }) {
  const navigate = onOpenProfile || useContext(ProfileNavigationContext)
  if (!profile) return null
  return <div className="friend-preview"><button type="button" className="profile-preview-link" onClick={() => navigate?.(profile.profileKey)}><Avatar repository={repository} userId={userId} profile={profile} /><span><strong>{displayName(profile) || fallback}</strong>{profile.handle && <small>@{profile.handle}</small>}{profile.bio && <p>{profile.bio}</p>}</span></button><div className="friend-actions">{children}</div></div>
}

type FriendsProps = { userId: string; language: Language; repository: AppRepository; profile: UserProfile; onProfile: (profile: UserProfile, forceAvatarRevision?: boolean) => void; onOpenProfile?: (profileKey: string) => void; onBack?: () => void; online: boolean; onNotify: (message: string) => void }
type FriendsTab = 'friends' | 'requests' | 'league'

function FriendsBase({ userId, language, repository, profile, onProfile, onOpenProfile, onBack, online, onNotify }: FriendsProps) {
  const t = useTranslations(language)
  const [activeTab, setActiveTab] = useState<FriendsTab>('friends')
  const [friendships, setFriendships] = useState<FriendshipRecord[]>([])
  const [blocks, setBlocks] = useState<ProfilePreview[]>([])
  const [challenges, setChallenges] = useState<FriendChallengeRecord[]>([])
  const [groupInvites, setGroupInvites] = useState<GroupFriendInvitation[]>([])
  const [viewingProfileKey, setViewingProfileKey] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [query, setQuery] = useState('')
  const [queryKind, setQueryKind] = useState<'handle' | 'code'>('handle')
  const [result, setResult] = useState<ProfilePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [challengeTarget, setChallengeTarget] = useState<ProfilePreview | null>(null)
  const [challengeTakeId, setChallengeTakeId] = useState(takes[0].id)
  const [challengeArgument, setChallengeArgument] = useState('')
  const [challengeMode, setChallengeMode] = useState('classic')
  const [answerId, setAnswerId] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [groupTarget, setGroupTarget] = useState<ProfilePreview | null>(null)
  const [groupId, setGroupId] = useState('')

  useEffect(() => {
    function handleNativeBack(event: Event) { event.preventDefault(); if (viewingProfileKey) setViewingProfileKey(null); else onBack?.() }
    window.addEventListener('sideshift-native-back', handleNativeBack)
    return () => window.removeEventListener('sideshift-native-back', handleNativeBack)
  }, [onBack, viewingProfileKey])

  const openProfile = (profileKey: string) => {
    const nextKey = humanProfileKey({ kind: 'human', profileKey })
    if (!nextKey) return
    ;(onOpenProfile || setViewingProfileKey)(nextKey)
  }

  async function load() {
    if (repository.backend === 'local') return
    try {
      const [nextFriends, nextBlocks, nextChallenges, nextInvites, nextGroups] = await Promise.all([repository.listFriendships(userId), repository.listBlocks(userId), repository.listFriendChallenges(userId), repository.listGroupFriendInvitations(userId), repository.listGroups(userId)])
      setFriendships(nextFriends); setBlocks(nextBlocks); setChallenges(nextChallenges); setGroupInvites(nextInvites); setGroups(nextGroups)
    } catch (caught) { setError(caught instanceof Error ? caught.message : t('friends.unavailable')) }
  }
  useEffect(() => { void load() }, [repository, userId])

  const incoming = friendships.filter(item => item.status === 'pending' && item.direction === 'incoming')
  const outgoing = friendships.filter(item => item.status === 'pending' && item.direction === 'outgoing')
  const accepted = friendships.filter(item => item.status === 'accepted')
  const memberGroups = useMemo(() => groups.filter(group => group.role === 'owner' || group.role === 'moderator'), [groups])

  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); try { await action(); await load() } catch (caught) { setError(caught instanceof Error ? caught.message : t('friends.unavailable')) } finally { setBusy(false) } }
  async function lookup() { await run(async () => { const next = queryKind === 'handle' ? await repository.lookupProfileByHandle(userId, query) : await repository.lookupProfileByFriendCode(userId, query); setResult(next) }) }
  async function regenerateCode() { await run(async () => { const code = await repository.regenerateFriendCode(userId); onProfile({ ...profile, friendCode: code }); onNotify(t('friends.codeRegenerate')) }) }
  async function copyCode() { if (!profile.friendCode) return; await navigator.clipboard?.writeText(profile.friendCode); onNotify(t('friends.copyCode')) }

  if (repository.backend === 'local') return <div className="page friends-page"><div className="page-heading"><div><span className="eyebrow">{t('friends.eyebrow')}</span><h1>{t('friends.title')}<span className="heading-period">.</span></h1></div></div><section className="empty-state card-surface"><Icon name="lock" size={22} /><strong>{t('friends.deviceOnly')}</strong><span>{t('friends.privateOnly')}</span></section></div>
  if (viewingProfileKey) return <ProfileViewScreen userId={userId} profileKey={viewingProfileKey} language={language} repository={repository} onBack={() => setViewingProfileKey(null)} />

  const tabs: Array<{ id: FriendsTab; label: string }> = [{ id: 'friends', label: t('friends.title') }, { id: 'requests', label: t('friends.requests') }, { id: 'league', label: t('league.title') }]
  return <ProfileNavigationContext.Provider value={openProfile}><div className="page friends-page"><header className="friends-destination-header"><div><span className="eyebrow">{t('friends.eyebrow')}</span><h1>{t('friends.title')}<span className="heading-period">.</span></h1><p className="muted">{t('friends.body')}</p></div><div className="friends-heading-actions"><Tag tone="coral"><Icon name="lock" size={13} /> {t('common.private')}</Tag><Button variant="secondary" onClick={() => setActiveTab('requests')}>{t('friends.add')}</Button></div></header><nav className="friends-tabs" role="tablist" aria-label={t('friends.title')}>{tabs.map(tab => <button type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}{tab.id === 'requests' && incoming.length > 0 && <span className="friends-tab-count">{incoming.length}</span>}</button>)}</nav>{activeTab === 'friends' && <div className="friends-tab-panel" role="tabpanel"><section className="friends-identity-strip card-surface"><div><span className="eyebrow">{t('friends.code')}</span><strong>{profile.friendCode || '—'}</strong><small>{t('friends.lookupHint')}</small></div><div className="friend-code-actions"><button type="button" className="text-link" onClick={() => void copyCode()}>{t('friends.copyCode')}</button><button type="button" className="text-link" onClick={() => void regenerateCode()}>{t('friends.codeRegenerate')}</button></div></section><section className="friends-section"><div className="friends-section-heading"><div><span className="eyebrow">{accepted.length}</span><h2>{t('friends.title')}</h2></div></div>{accepted.length ? accepted.map(item => <ProfilePreviewRow key={item.id} repository={repository} userId={userId} profile={item.profile} fallback={t('friends.member')}><Button variant="secondary" onClick={() => setChallengeTarget(item.profile)}>{t('friends.challenge')}</Button><Button variant="secondary" onClick={() => setGroupTarget(item.profile)}>{t('friends.inviteToGroup')}</Button><button type="button" className="text-link" onClick={() => void run(() => repository.updateFriendRequest(userId, item.id, 'remove').then(() => undefined))}>{t('friends.remove')}</button><button type="button" className="text-link" onClick={() => void run(() => repository.blockUser(userId, item.profile?.profileKey || '').then(() => undefined))}>{t('friends.block')}</button></ProfilePreviewRow>) : <div className="friends-empty-state"><strong>{t('friends.empty')}</strong><span>{t('friends.lookupHint')}</span><Button variant="secondary" onClick={() => setActiveTab('requests')}>{t('friends.add')}</Button></div>}</section>{challenges.length > 0 && <section className="friends-section"><div className="friends-section-heading"><h2>{t('friends.challenges')}</h2></div>{challenges.map(item => <div className="friend-challenge" key={item.id}>{(item.direction === 'incoming' ? item.creator : item.recipient) && <ProfilePreviewRow repository={repository} userId={userId} profile={item.direction === 'incoming' ? item.creator : item.recipient} fallback={t('friends.member')} onOpenProfile={openProfile} />}<div><Tag tone={item.direction === 'incoming' ? 'yellow' : 'mint'}>{item.direction === 'incoming' ? t('friends.answer') : item.status}</Tag><strong>{getTake(item.takeId) ? getTake(item.takeId).statement : item.takeId}</strong><p>{item.argument}</p></div>{item.direction === 'incoming' && item.status === 'open' && <Button variant="secondary" onClick={() => setAnswerId(item.id)}>{t('friends.answer')}</Button>}{answerId === item.id && <div className="friend-answer"><textarea className="settings-textarea" value={answer} onChange={event => setAnswer(event.target.value)} placeholder={t('friends.answerPlaceholder')} /><Button onClick={() => void run(async () => { await repository.completeFriendChallenge(userId, item.id, answer); setAnswerId(null); setAnswer('') })} disabled={answer.trim().length < 12}>{t('friends.submitAnswer')}</Button></div>}</div>)}</section>}{blocks.length > 0 && <section className="friends-section"><div className="friends-section-heading"><h2>{t('friends.blocked')}</h2></div>{blocks.map(item => <ProfilePreviewRow key={item.profileKey} repository={repository} userId={userId} profile={item} fallback={t('friends.member')}><button type="button" className="text-link" onClick={() => void run(() => repository.unblockUser(userId, item.profileKey))}>{t('friends.unblock')}</button></ProfilePreviewRow>)}</section>}</div>}{activeTab === 'requests' && <div className="friends-tab-panel" role="tabpanel"><section className="friends-section friends-add-section"><div className="friends-section-heading"><div><span className="eyebrow">{t('friends.add')}</span><h2>{t('friends.lookup')}</h2></div><Icon name="search" size={21} /></div><p className="field-help">{t('friends.lookupHint')}</p><div className="friends-lookup-row"><select className="settings-select" value={queryKind} onChange={event => setQueryKind(event.target.value as 'handle' | 'code')}><option value="handle">{t('friends.handle')}</option><option value="code">{t('friends.code')}</option></select><input className="text-input" value={query} onChange={event => setQuery(event.target.value)} placeholder={queryKind === 'handle' ? '@handle' : 'SS-XXXXXXXXXX'} /><Button variant="dark" onClick={() => void lookup()} disabled={!query.trim() || busy}>{t('friends.lookup')}</Button></div>{result ? <ProfilePreviewRow onOpenProfile={openProfile} repository={repository} userId={userId} profile={result} fallback={t('friends.member')}><Button variant="secondary" onClick={() => void run(async () => { await repository.sendFriendRequest(userId, result.profileKey); setResult(null) })}>{t('friends.request')}</Button></ProfilePreviewRow> : query && <p className="muted">{t('friends.noResults')}</p>}</section>{incoming.length > 0 && <section className="friends-section"><div className="friends-section-heading"><h2>{t('friends.incoming')}</h2></div>{incoming.map(item => <ProfilePreviewRow key={item.id} repository={repository} userId={userId} profile={item.profile} fallback={t('friends.member')}><Button variant="secondary" onClick={() => void run(() => repository.updateFriendRequest(userId, item.id, 'accept').then(() => undefined))}>{t('friends.accept')}</Button><button type="button" className="text-link" onClick={() => void run(() => repository.updateFriendRequest(userId, item.id, 'decline').then(() => undefined))}>{t('friends.decline')}</button></ProfilePreviewRow>)}</section>}{outgoing.length > 0 && <section className="friends-section"><div className="friends-section-heading"><h2>{t('friends.sent')}</h2></div>{outgoing.map(item => <ProfilePreviewRow key={item.id} repository={repository} userId={userId} profile={item.profile} fallback={t('friends.member')}><button type="button" className="text-link" onClick={() => void run(() => repository.updateFriendRequest(userId, item.id, 'cancel').then(() => undefined))}>{t('friends.cancel')}</button></ProfilePreviewRow>)}</section>}{groupInvites.length > 0 && <section className="friends-section"><div className="friends-section-heading"><h2>{t('friends.groupInvites')}</h2></div>{groupInvites.map(item => <div className="friend-preview" key={item.id}><button type="button" className="profile-preview-link" disabled={!item.inviter} onClick={() => item.inviter && openProfile(item.inviter.profileKey)}><Avatar repository={repository} userId={userId} profile={item.inviter} /><span><strong>{item.groupName}</strong><small>{displayName(item.inviter) || t('friends.member')}</small></span></button><div className="friend-actions"><Button variant="secondary" onClick={() => void run(() => repository.respondGroupFriendInvitation(userId, item.id, 'accept'))}>{t('friends.acceptInvite')}</Button><button type="button" className="text-link" onClick={() => void run(() => repository.respondGroupFriendInvitation(userId, item.id, 'decline'))}>{t('friends.declineInvite')}</button></div></div>)}</section>}<div className="friends-empty-state"><strong>{incoming.length || outgoing.length || groupInvites.length ? '' : t('friends.emptyRequests')}</strong>{!incoming.length && !outgoing.length && !groupInvites.length && <span>{t('friends.lookupHint')}</span>}</div></div>}{activeTab === 'league' && <div className="friends-tab-panel" role="tabpanel"><section className="friends-league-section card-surface"><LeaguePanel userId={userId} language={language} repository={repository} leagueType="friends" /></section></div>}{error && <p className="form-error" role="alert">{error}</p>}{!online && <p className="muted">{t('common.offline')}</p>}{challengeTarget && <div className="modal-scrim"><section className="modal-card card-surface"><button className="modal-close" type="button" onClick={() => setChallengeTarget(null)} aria-label={t('common.close')}><Icon name="close" size={18} /></button><span className="eyebrow">{t('friends.challenge')}</span><button type="button" className="profile-preview-link challenge-target-link" onClick={() => openProfile(challengeTarget.profileKey)}><Avatar repository={repository} userId={userId} profile={challengeTarget} /><span><strong>{displayName(challengeTarget)}</strong>{challengeTarget.handle && <small>@{challengeTarget.handle}</small>}</span></button><label className="field-label">{t('common.startThisTake')}<select className="settings-select" value={challengeTakeId} onChange={event => setChallengeTakeId(event.target.value)}>{takes.slice(0, 12).map(take => <option key={take.id} value={take.id}>{take.statement}</option>)}</select></label><label className="field-label">{t('friends.challengeMode')}<select className="settings-select" value={challengeMode} onChange={event => setChallengeMode(event.target.value)}><option value="classic">{t('shell.classic')}</option><option value="sideswitch">{t('shell.sideSwitch')}</option></select></label><label className="field-label">{t('friends.challengeArgument')}<textarea className="settings-textarea" value={challengeArgument} onChange={event => setChallengeArgument(event.target.value.slice(0, 350))} placeholder={t('friends.challengePlaceholder')} /></label><Button onClick={() => void run(async () => { const take = getTake(challengeTakeId); await repository.createFriendChallenge(userId, { profileKey: challengeTarget.profileKey, takeId: challengeTakeId, mode: challengeMode, creatorSide: take.supportLabel, argument: challengeArgument }); setChallengeTarget(null); setChallengeArgument('') })} disabled={challengeArgument.trim().length < 12}>{t('friends.sendChallenge')}</Button></section></div>}{groupTarget && <div className="modal-scrim"><section className="modal-card card-surface"><button className="modal-close" type="button" onClick={() => setGroupTarget(null)} aria-label={t('common.close')}><Icon name="close" size={18} /></button><span className="eyebrow">{t('friends.inviteToGroup')}</span><h2>{displayName(groupTarget)}</h2><select className="settings-select" value={groupId} onChange={event => setGroupId(event.target.value)}><option value="">{t('friends.chooseGroup')}</option>{memberGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><Button onClick={() => void run(async () => { await repository.createGroupFriendInvitation(userId, groupId, groupTarget.profileKey); setGroupTarget(null); setGroupId('') })} disabled={!groupId}>{t('friends.inviteToGroup')}</Button></section></div>}</div></ProfileNavigationContext.Provider>
}

export function Friends(props: FriendsProps) {
  return <FriendsBase {...props} />
}
