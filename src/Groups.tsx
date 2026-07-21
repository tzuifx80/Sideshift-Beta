import { useEffect, useState } from 'react'
import { takes, type Language } from './domain'
import { formatGroupInviteCode, normalizeGroupInviteCode, type CreateGroupInput, type CreateGroupTopicInput, type GroupDetail, type GroupSummary, type GroupTopic } from './collaboration'
import type { AppRepository } from './data/repository'
import { useTranslations } from './i18n'
import type { Translator } from './i18n'
import { ProfileViewScreen } from './ProfileView'
import { humanProfileKey } from './profileNavigation'
import { LeaguePanel } from './features/league/LeaguePanel'

type GroupsProps = {
  userId: string
  language: Language
  repository: AppRepository
  onStartTeam: (topic: GroupTopic | null, group: GroupSummary) => void
  onBack: () => void
  onNotify: (message: string) => void
  initialGroupId?: string
}

function groupRoleLabel(role: string, t: Translator): string {
  return role === 'owner' ? t('groups.roleOwner') : role === 'moderator' ? t('groups.roleModerator') : t('groups.roleMember')
}

function setGroupPath(groupId?: string) {
  const nextPath = groupId ? `/group/${encodeURIComponent(groupId)}` : '/'
  if (window.location.pathname !== nextPath) window.history.replaceState({}, '', nextPath)
}

function GroupForm({ language, onSubmit, onCancel }: { language: Language; onSubmit: (input: CreateGroupInput) => Promise<void>; onCancel?: () => void }) {
  const t = useTranslations(language)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (name.trim().length < 2 || name.trim().length > 60) return setError(`${t('groups.name')}: 2–60`)
    if (description.length > 240 || rules.length > 600) return setError(`${t('groups.description')} / ${t('groups.rules')}: 240 / 600`)
    setBusy(true); setError('')
    try { await onSubmit({ name, description, rules, icon: '✦', accent: 'coral', language, memberLimit: null, leaderboardEnabled }) } catch (caught) { setError(caught instanceof Error ? caught.message : t('groups.createError')) } finally { setBusy(false) }
  }
  return <section className="card-surface group-form"><div className="settings-section-heading"><div><span className="eyebrow">{t('groups.private')}</span><h2>{t('groups.create')}</h2></div></div><label className="field-label">{t('groups.name')}<input className="text-input" maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder={t('groups.example')} /></label><label className="field-label">{t('groups.description')}<textarea className="settings-textarea" maxLength={240} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('groups.roomFor')} /></label><label className="field-label">{t('groups.rules')}<textarea className="settings-textarea" maxLength={600} value={rules} onChange={event => setRules(event.target.value)} placeholder={t('groups.rulesPlaceholder')} /></label><label className="toggle-row"><input type="checkbox" checked={leaderboardEnabled} onChange={event => setLeaderboardEnabled(event.target.checked)} /><span>{t('groups.pointsToggle')}</span><small>{t('groups.pointsHelp')}</small></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="group-form-actions"><button type="button" className="button button-primary" onClick={() => void submit()} disabled={busy}>{busy ? t('common.saving') : t('groups.createPrivate')}</button>{onCancel && <button type="button" className="button button-ghost" onClick={onCancel}>{t('common.cancel')}</button>}</div></section>
}

/* Legacy single-card Group detail removed. The tabbed mobile-safe view below is the only live route.
function GroupDetailViewBase({ detail, language, repository, userId, onStartTeam, onBack, onNotify, onReload, onOpenProfile }: { detail: GroupDetail; language: Language; repository: AppRepository; userId: string; onStartTeam: (topic: GroupTopic | null, group: GroupSummary) => void; onBack: () => void; onNotify: (message: string) => void; onReload: () => Promise<void>; onOpenProfile: (profileKey: string) => void }) {
  const t = useTranslations(language)
  const [invite, setInvite] = useState<string | null>(null)
  const [topic, setTopic] = useState<CreateGroupTopicInput>({ statement: '', context: '', sideLabels: ['Support', 'Question'], category: 'Group topic', language, sensitivity: 'standard' })
  const [topicError, setTopicError] = useState('')
  const [busy, setBusy] = useState(false)
  const isManager = detail.role === 'owner' || detail.role === 'moderator'
  async function createInvite() {
    try { const created = await repository.createGroupInvite(userId, detail.id); setInvite(formatGroupInviteCode(created.code)); await onReload(); onNotify(t('groups.inviteCreated')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('groups.inviteCreated')) }
  }
  async function createTopic() {
    if (topic.statement.trim().length < 8 || topic.statement.trim().length > 240) return setTopicError(t('groups.topicLengthError'))
    setBusy(true); setTopicError('')
    try { await repository.createGroupTopic(userId, detail.id, topic); setTopic({ ...topic, statement: '', context: '' }); await onReload(); onNotify(isManager ? t('groups.saveTopic') : t('groups.needsReview')) } catch (caught) { setTopicError(caught instanceof Error ? caught.message : t('groups.saveTopic')) } finally { setBusy(false) }
  }
  async function copyInvite() { if (invite && navigator.clipboard) { await navigator.clipboard.writeText(invite); onNotify(t('common.copy')) } }
  return <div className="page groups-page"><button type="button" className="back-link" onClick={onBack}>← {t('groups.backGroups')}</button><div className="page-heading group-heading"><div><span className="eyebrow">{t('groups.private')}</span><h1>{detail.icon} {detail.name}<span className="heading-period">.</span></h1><p className="muted">{detail.description || t('groups.privateRoomDescription')}</p></div><span className="group-member-count">{t('groups.membersCount', { count: detail.members.length })}</span></div><div className="group-dashboard-grid"><section className="card-surface group-main-card"><div className="group-action-row"><button type="button" className="button button-primary" onClick={() => onStartTeam(null, detail)}>{t('groups.startTeam')}</button>{isManager && <button type="button" className="button button-secondary" onClick={() => void createInvite()}>{t('groups.createInvite')}</button>}</div>{invite && <div className="group-invite-box"><span className="eyebrow">{t('groups.inviteCode')}</span><strong>{invite}</strong><button type="button" className="button button-ghost" onClick={() => void copyInvite()}>{t('groups.copyInvite')}</button><small>{t('groups.inviteHelpDetail')}</small></div>}<div className="group-section-heading"><div><span className="eyebrow">{t('groups.topics')}</span><h2>{t('groups.topicRoom')}</h2></div></div>{detail.topics.length ? <div className="group-topic-list">{detail.topics.map(item => <article key={item.id} className="group-topic-card"><div><span className="eyebrow">{item.category} · {item.status === 'pending' ? t('groups.needsReview') : item.sensitivity.toUpperCase()}</span><h3>{item.statement}</h3><p>{item.context}</p></div><button type="button" className="round-arrow" onClick={() => onStartTeam(item, detail)}>{t('groups.debateTopic')} →</button></article>)}</div> : <p className="muted group-empty">{t('groups.noTopics')}</p>}<div className="group-topic-create"><span className="eyebrow">{t('groups.suggestTopic')}</span><label className="field-label">{t('groups.statement')}<input className="text-input" maxLength={240} value={topic.statement} onChange={event => setTopic(current => ({ ...current, statement: event.target.value }))} placeholder={t('groups.topicRoom')} /></label><label className="field-label">{t('groups.context')}<textarea className="settings-textarea" maxLength={600} value={topic.context} onChange={event => setTopic(current => ({ ...current, context: event.target.value }))} placeholder={t('groups.context')} /></label><div className="settings-fields-grid"><label className="field-label">{t('groups.supportLabel')}<input className="text-input" maxLength={28} value={topic.sideLabels[0]} onChange={event => setTopic(current => ({ ...current, sideLabels: [event.target.value, current.sideLabels[1]] }))} /></label><label className="field-label">{t('groups.questionLabel')}<input className="text-input" maxLength={28} value={topic.sideLabels[1]} onChange={event => setTopic(current => ({ ...current, sideLabels: [current.sideLabels[0], event.target.value] }))} /></label></div><label className="field-label">{t('groups.sensitivity')}<select className="settings-select" value={topic.sensitivity} onChange={event => setTopic(current => ({ ...current, sensitivity: event.target.value as CreateGroupTopicInput['sensitivity'] }))}><option value="standard">{t('groups.sensitivity')}</option><option value="sensitive">{t('groups.sensitive')}</option></select></label>{topicError && <p className="form-error" role="alert">{topicError}</p>}<button type="button" className="button button-secondary" onClick={() => void createTopic()} disabled={busy}>{busy ? t('common.saving') : t('groups.saveTopic')}</button></div></section><aside className="group-sidebar"><section className="card-surface group-members-card"><div className="group-section-heading"><div><span className="eyebrow">{t('groups.members')}</span><h2>{t('groups.people')}</h2></div></div><div className="group-member-list">{detail.members.map(member => <div key={member.userId}><button type="button" className="profile-preview-link group-member-profile" disabled={!member.profileKey} onClick={() => member.profileKey && onOpenProfile(member.profileKey)}><span className="avatar avatar-coral">{member.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>{groupRoleLabel(member.role, t)} · {t('groups.points', { count: member.points })}</small></span></button></div>)}</div>{detail.rules && <p className="group-rules"><strong>{t('groups.rulesTitle')}</strong>{detail.rules}</p>}</section>{detail.leaderboardEnabled && <section className="card-surface group-leaderboard"><div className="group-section-heading"><div><span className="eyebrow">{t('groups.leaderboard')}</span><h2>{t('groups.constructivePoints')}</h2></div></div><p className="field-help">{t('groups.pointsBody')}</p>{detail.members.slice().sort((a, b) => b.points - a.points).map((member, index) => <div className="leaderboard-row" key={member.userId}><b>{index + 1}</b><span>{member.displayName}</span><strong>{member.points}</strong></div>)}</section>}</aside></div></div>
}

*/
function GroupDetailViewMobile({ detail, language, repository, userId, onStartTeam, onBack, onNotify, onReload, onOpenProfile }: { detail: GroupDetail; language: Language; repository: AppRepository; userId: string; onStartTeam: (topic: GroupTopic | null, group: GroupSummary) => void; onBack: () => void; onNotify: (message: string) => void; onReload: () => Promise<void>; onOpenProfile: (profileKey: string) => void }) {
  const t = useTranslations(language)
  const [invite, setInvite] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'topics' | 'members' | 'league'>('overview')
  const [topic, setTopic] = useState<CreateGroupTopicInput>({ statement: '', context: '', sideLabels: ['Support', 'Question'], category: 'Group topic', language, sensitivity: 'standard' })
  const [topicError, setTopicError] = useState('')
  const [busy, setBusy] = useState(false)
  const isManager = detail.role === 'owner' || detail.role === 'moderator'
  const displayInvite = invite ? formatGroupInviteCode(invite) : ''
  async function createInvite() { try { const created = await repository.createGroupInvite(userId, detail.id); setInvite(created.code); await onReload(); onNotify(t('groups.inviteCreated')) } catch (caught) { onNotify(caught instanceof Error ? caught.message : t('groups.inviteCreated')) } }
  async function copyInvite() { if (!displayInvite) return; await navigator.clipboard?.writeText(displayInvite); onNotify(t('common.copy')) }
  async function shareInvite() { if (!displayInvite) return; if (navigator.share) await navigator.share({ title: detail.name, text: displayInvite }).catch(() => undefined); else await copyInvite() }
  async function createTopic() {
    if (topic.statement.trim().length < 8 || topic.statement.trim().length > 240) return setTopicError(t('groups.topicLengthError'))
    setBusy(true); setTopicError('')
    try { await repository.createGroupTopic(userId, detail.id, topic); setTopic(current => ({ ...current, statement: '', context: '' })); await onReload(); onNotify(isManager ? t('groups.saveTopic') : t('groups.needsReview')) } catch (caught) { setTopicError(caught instanceof Error ? caught.message : t('groups.saveTopic')) } finally { setBusy(false) }
  }
  const tabs: Array<{ id: typeof tab; label: string }> = [{ id: 'overview', label: t('groups.overview') }, { id: 'topics', label: t('groups.topics') }, { id: 'members', label: t('groups.members') }, { id: 'league', label: t('league.title') }]
  return <div className="page groups-page group-detail-page"><button type="button" className="back-link" onClick={onBack}>← {t('groups.backGroups')}</button><header className="group-detail-header"><div><span className="eyebrow">{t('groups.private')}</span><h1>{detail.icon} {detail.name}<span className="heading-period">.</span></h1><p className="muted group-description">{detail.description || t('groups.privateRoomDescription')}</p></div><span className="group-member-count">{t('groups.membersCount', { count: detail.members.length })}</span></header><div className="group-detail-actions"><button type="button" className="button button-primary" onClick={() => onStartTeam(null, detail)}>{t('groups.startTeam')}</button>{isManager && <button type="button" className="button button-secondary" onClick={() => void createInvite()}>{t('groups.createInvite')}</button>}</div>{invite && <section className="group-invite-card card-surface" aria-labelledby="group-invite-heading"><div><span className="eyebrow" id="group-invite-heading">{t('groups.inviteCode')}</span><code className="group-invite-code">{displayInvite}</code><p>{t('groups.inviteHelpDetail')}</p></div><div className="group-invite-actions"><button type="button" className="button button-secondary" onClick={() => void copyInvite()}>{t('groups.copyInvite')}</button>{typeof navigator.share === 'function' && <button type="button" className="button button-ghost" onClick={() => void shareInvite()}>{t('groups.shareInvite')}</button>}</div></section>}<nav className="group-detail-tabs" role="tablist" aria-label={t('groups.title')}>{tabs.map(item => <button type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>{tab === 'overview' && <div className="group-detail-sections"><section className="group-overview-card card-surface"><span className="eyebrow">{t('groups.topicRoom')}</span><h2>{detail.topics.length ? detail.topics[0].statement : t('groups.noTopics')}</h2><p className="muted">{detail.topics.length ? detail.topics[0].context : t('groups.emptyBody')}</p>{detail.topics[0] && <button type="button" className="button button-secondary" onClick={() => onStartTeam(detail.topics[0], detail)}>{t('groups.debateTopic')}</button>}</section><section className="group-overview-card card-surface"><span className="eyebrow">{t('groups.members')}</span><h2>{t('groups.people')}</h2><div className="group-member-list">{detail.members.slice(0, 4).map(member => <button type="button" className="profile-preview-link group-member-profile" key={member.userId} disabled={!member.profileKey} onClick={() => member.profileKey && onOpenProfile(member.profileKey)}><span className="avatar avatar-coral">{member.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>{groupRoleLabel(member.role, t)} · {t('groups.points', { count: member.points })}</small></span></button>)}</div><button type="button" className="text-link" onClick={() => setTab('members')}>{t('groups.members')}</button></section></div>}{tab === 'topics' && <section className="group-detail-section card-surface"><div className="group-section-heading"><div><span className="eyebrow">{t('groups.topics')}</span><h2>{t('groups.topicRoom')}</h2></div></div>{detail.topics.length ? <div className="group-topic-list">{detail.topics.map(item => <article key={item.id} className="group-topic-card"><div><span className="eyebrow">{item.category} · {item.status === 'pending' ? t('groups.needsReview') : item.sensitivity.toUpperCase()}</span><h3>{item.statement}</h3><p>{item.context}</p></div><button type="button" className="round-arrow" onClick={() => onStartTeam(item, detail)}>{t('groups.debateTopic')} →</button></article>)}</div> : <p className="muted group-empty">{t('groups.noTopics')}</p>}<div className="group-topic-create"><span className="eyebrow">{t('groups.suggestTopic')}</span><label className="field-label">{t('groups.statement')}<input className="text-input" maxLength={240} value={topic.statement} onChange={event => setTopic(current => ({ ...current, statement: event.target.value }))} placeholder={t('groups.topicRoom')} /></label><label className="field-label">{t('groups.context')}<textarea className="settings-textarea" maxLength={600} value={topic.context} onChange={event => setTopic(current => ({ ...current, context: event.target.value }))} placeholder={t('groups.context')} /></label><div className="settings-fields-grid"><label className="field-label">{t('groups.supportLabel')}<input className="text-input" maxLength={28} value={topic.sideLabels[0]} onChange={event => setTopic(current => ({ ...current, sideLabels: [event.target.value, current.sideLabels[1]] }))} /></label><label className="field-label">{t('groups.questionLabel')}<input className="text-input" maxLength={28} value={topic.sideLabels[1]} onChange={event => setTopic(current => ({ ...current, sideLabels: [current.sideLabels[0], event.target.value] }))} /></label></div><label className="field-label">{t('groups.sensitivity')}<select className="settings-select" value={topic.sensitivity} onChange={event => setTopic(current => ({ ...current, sensitivity: event.target.value as CreateGroupTopicInput['sensitivity'] }))}><option value="standard">{t('groups.sensitivity')}</option><option value="sensitive">{t('groups.sensitive')}</option></select></label>{topicError && <p className="form-error" role="alert">{topicError}</p>}<button type="button" className="button button-secondary" onClick={() => void createTopic()} disabled={busy}>{busy ? t('common.saving') : t('groups.saveTopic')}</button></div></section>}{tab === 'members' && <section className="group-detail-section card-surface"><div className="group-section-heading"><div><span className="eyebrow">{t('groups.members')}</span><h2>{t('groups.people')}</h2></div></div><div className="group-member-list">{detail.members.map(member => <button type="button" className="profile-preview-link group-member-profile" key={member.userId} disabled={!member.profileKey} onClick={() => member.profileKey && onOpenProfile(member.profileKey)}><span className="avatar avatar-coral">{member.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>{groupRoleLabel(member.role, t)} · {t('groups.points', { count: member.points })}</small></span></button>)}</div>{detail.rules && <p className="group-rules"><strong>{t('groups.rulesTitle')}</strong>{detail.rules}</p>}{detail.leaderboardEnabled && <div className="group-leaderboard-inline"><h2>{t('groups.constructivePoints')}</h2>{detail.members.slice().sort((a, b) => b.points - a.points).map((member, index) => <div className="leaderboard-row" key={member.userId}><b>{index + 1}</b><span>{member.displayName}</span><strong>{member.points}</strong></div>)}</div>}</section>}{tab === 'league' && <section className="group-detail-section group-league-inline card-surface"><LeaguePanel userId={userId} language={language} repository={repository} leagueType="group" groupId={detail.id} /></section>}</div>
}

function GroupDetailView(props: { detail: GroupDetail; language: Language; repository: AppRepository; userId: string; onStartTeam: (topic: GroupTopic | null, group: GroupSummary) => void; onBack: () => void; onNotify: (message: string) => void; onReload: () => Promise<void>; onOpenProfile: (profileKey: string) => void }) {
  return <GroupDetailViewMobile {...props} />
}

export function Groups({ userId, language, repository, onStartTeam, onBack, onNotify, initialGroupId }: GroupsProps) {
  const t = useTranslations(language)
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [selected, setSelected] = useState<GroupDetail | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewingProfileKey, setViewingProfileKey] = useState<string | null>(null)

  async function reload() {
    setLoading(true); setError('')
    try { const next = await repository.listGroups(userId); setGroups(next); if (selected) setSelected(await repository.loadGroup(userId, selected.id)) } catch (caught) { setError(caught instanceof Error ? caught.message : t('groups.loading')) } finally { setLoading(false) }
  }
  useEffect(() => {
    void (async () => {
      await reload()
      if (initialGroupId) {
        try { setSelected(await repository.loadGroup(userId, initialGroupId)) } catch (caught) { setError(caught instanceof Error ? caught.message : t('groups.emptyBody')) }
      }
    })()
  }, [initialGroupId, repository, userId])
  useEffect(() => {
    function handleNativeBack(event: Event) {
      event.preventDefault()
      if (viewingProfileKey) setViewingProfileKey(null)
      else if (selected) { setGroupPath(); setSelected(null) }
      else onBack()
    }
    window.addEventListener('sideshift-native-back', handleNativeBack)
    return () => window.removeEventListener('sideshift-native-back', handleNativeBack)
  }, [onBack, selected, viewingProfileKey])
  async function create(input: CreateGroupInput) { const created = await repository.createGroup(userId, input); await reload(); const next = await repository.loadGroup(userId, created.id); setSelected(next); setGroupPath(next.id); setShowCreate(false); onNotify(t('groups.createPrivate')) }
  async function join() { if (!inviteCode.trim()) return; try { const joined = await repository.joinGroupByInvite(userId, normalizeGroupInviteCode(inviteCode)); await reload(); const next = await repository.loadGroup(userId, joined.id); setSelected(next); setGroupPath(next.id); setInviteCode(''); onNotify(t('common.join')) } catch (caught) { setError(caught instanceof Error ? caught.message : t('groups.inviteHelp')) } }
  if (viewingProfileKey) return <ProfileViewScreen userId={userId} profileKey={viewingProfileKey} language={language} repository={repository} onBack={() => setViewingProfileKey(null)} />
  if (selected) return <GroupDetailView detail={selected} language={language} repository={repository} userId={userId} onStartTeam={onStartTeam} onBack={() => { setGroupPath(); setSelected(null) }} onNotify={onNotify} onReload={reload} onOpenProfile={profileKey => { const nextKey = humanProfileKey({ kind: 'human', profileKey }); if (nextKey) setViewingProfileKey(nextKey) }} />
  return <div className="page groups-page"><div className="page-heading"><div><span className="eyebrow">{t('groups.eyebrow')}</span><h1>{t('groups.title')}<span className="heading-period">.</span></h1><p className="muted">{t('groups.body')}</p></div><button type="button" className="button button-primary" onClick={() => setShowCreate(value => !value)}>{t('groups.create')}</button></div>{showCreate && <GroupForm language={language} onSubmit={create} onCancel={() => setShowCreate(false)} />}<section className="card-surface group-join-card"><div><span className="eyebrow">{t('groups.haveInvite')}</span><h2>{t('groups.joinRoom')}</h2><p className="muted">{t('groups.inviteHelp')}</p></div><div className="group-join-form"><input className="text-input" maxLength={40} value={inviteCode} onChange={event => setInviteCode(event.target.value.toUpperCase())} placeholder={t('groups.invitePlaceholder')} /><button type="button" className="button button-secondary" onClick={() => void join()}>{t('groups.joinGroup')}</button></div></section>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="muted">{t('groups.loading')}</p> : groups.length ? <div className="group-list">{groups.map(group => <button type="button" className="card-surface group-list-card" key={group.id} onClick={() => void repository.loadGroup(userId, group.id).then(next => { setGroupPath(next.id); setSelected(next) }).catch(caught => setError(caught instanceof Error ? caught.message : t('groups.openError')))}><span className="group-list-icon">{group.icon}</span><span><strong>{group.name}</strong><small>{t('groups.membersCount', { count: group.memberCount })} · {group.role} · {group.description || t('groups.privateRoomDescription')}</small></span><span>→</span></button>)}</div> : <div className="empty-state card-surface"><strong>{t('groups.emptyTitle')}</strong><span>{t('groups.emptyBody')}</span></div>}<button type="button" className="back-link groups-back" onClick={onBack}>← {t('groups.backHome')}</button></div>
}
