import 'server-only'

import type { EnvId } from '@/config/environments'

/**
 * Audit minimal des consultations.
 *
 * Volontairement en sortie standard (stdout) : l'application est en LECTURE
 * SEULE, elle n'écrit dans aucune base — y compris pour ses propres logs.
 * En production, la sortie est collectée par l'hébergeur (Vercel, App Service,
 * conteneur…).
 *
 * Ne sont jamais journalisés : jetons, mots de passe, chaînes de connexion,
 * contenu des données clients. Uniquement : qui, quand, quel client, quel
 * environnement.
 */

export interface AuditEvent {
  user: string
  action: 'view_clients' | 'view_client' | 'view_users' | 'view_dashboard' | 'view_logo'
  clientCode?: string
  clientId?: number
  env?: EnvId
}

export function audit(event: AuditEvent): void {
  const line = {
    ts: new Date().toISOString(),
    user: event.user,
    action: event.action,
    ...(event.clientCode ? { client: event.clientCode } : {}),
    ...(event.clientId ? { clientId: event.clientId } : {}),
    ...(event.env ? { env: event.env } : {}),
  }
  console.info(`[audit] ${JSON.stringify(line)}`)
}
