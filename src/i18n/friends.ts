import type { Language } from '../domain'

export const friendsMessages: Record<Language, Record<string, string>> = {
  en: { 'friends.requests': 'Requests', 'friends.emptyRequests': 'No friend requests yet.', 'groups.overview': 'Overview', 'groups.shareInvite': 'Share invite' },
  de: { 'friends.requests': 'Anfragen', 'friends.emptyRequests': 'Noch keine Freundschaftsanfragen.', 'groups.overview': 'Übersicht', 'groups.shareInvite': 'Einladung teilen' },
  fr: { 'friends.requests': 'Demandes', 'friends.emptyRequests': 'Aucune demande d’amitié pour le moment.', 'groups.overview': 'Vue d’ensemble', 'groups.shareInvite': 'Partager l’invitation' },
  es: { 'friends.requests': 'Solicitudes', 'friends.emptyRequests': 'Todavía no hay solicitudes de amistad.', 'groups.overview': 'Resumen', 'groups.shareInvite': 'Compartir invitación' },
  it: { 'friends.requests': 'Richieste', 'friends.emptyRequests': 'Non ci sono ancora richieste di amicizia.', 'groups.overview': 'Panoramica', 'groups.shareInvite': 'Condividi invito' },
}
