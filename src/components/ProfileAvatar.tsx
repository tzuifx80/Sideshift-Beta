import { useEffect, useState } from 'react'
import type { AppRepository } from '../data/repository'
import type { UserProfile } from '../data/types'
import { avatarDisplayKey, avatarInitial } from '../profileAvatar'

const presetGlyphs: Record<UserProfile['avatarPreset'], string> = { orbit: '◌', spark: '✦', wave: '≈', sun: '☼', leaf: '⌁' }

export function ProfileAvatar({ profile, repository, userId, revision = 0, className = '' }: { profile: Pick<UserProfile, 'id' | 'displayName' | 'avatarPreset' | 'avatarPath'>; repository: AppRepository; userId: string; revision?: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const key = avatarDisplayKey(profile, revision)
  useEffect(() => {
    let active = true
    if (!profile.avatarPath) { setUrl(null); return () => { active = false } }
    setUrl(null)
    void repository.getAvatarUrl(userId, profile.avatarPath).then(value => { if (active) setUrl(value ? `${value}${value.includes('?') ? '&' : '?'}sideshift_avatar_revision=${revision}` : null) }).catch(() => { if (active) setUrl(null) })
    return () => { active = false }
  }, [profile.avatarPath, repository, revision, userId])
  return <span className={`profile-avatar ${className}`} data-avatar-key={key}>{url ? <img src={url} alt="" onError={() => setUrl(null)} /> : <span aria-hidden="true">{profile.avatarPath ? avatarInitial(profile) : presetGlyphs[profile.avatarPreset]}</span>}</span>
}
