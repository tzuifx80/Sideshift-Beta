import type { Language } from '../domain'
import type { LocaleMessages, TranslationKey } from './types'

type GroupMessages = Partial<Record<TranslationKey, string>>

export const groupMessages: Record<Language, GroupMessages> = {
  en: { 'groups.roleOwner': 'Owner', 'groups.roleModerator': 'Moderator', 'groups.roleMember': 'Member', 'groups.points': '{count} points', 'groups.constructivePoints': 'Constructive points' },
  de: { 'groups.roleOwner': 'Besitzer', 'groups.roleModerator': 'Moderation', 'groups.roleMember': 'Mitglied', 'groups.points': '{count} Punkte', 'groups.constructivePoints': 'Konstruktive Punkte' },
  fr: { 'groups.roleOwner': 'Propriétaire', 'groups.roleModerator': 'Modération', 'groups.roleMember': 'Membre', 'groups.points': '{count} points', 'groups.constructivePoints': 'Points constructifs' },
  es: { 'groups.roleOwner': 'Propietario', 'groups.roleModerator': 'Moderación', 'groups.roleMember': 'Miembro', 'groups.points': '{count} puntos', 'groups.constructivePoints': 'Puntos constructivos' },
  it: { 'groups.roleOwner': 'Proprietario', 'groups.roleModerator': 'Moderatore', 'groups.roleMember': 'Membro', 'groups.points': '{count} punti', 'groups.constructivePoints': 'Punti costruttivi' },
}
