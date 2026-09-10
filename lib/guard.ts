import 'server-only'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { isAuthConfigured, isLocalNoAuth, serverEnv } from '@/config/env'

/**
 * Contrôle d'accès des pages.
 *
 * Deux comportements, volontairement asymétriques :
 *
 *  - En PRODUCTION, l'authentification est obligatoire. Si Entra ID n'est pas
 *    configuré, l'application refuse l'accès plutôt que de s'ouvrir : une
 *    configuration incomplète ne doit jamais dégrader en accès libre.
 *
 *  - En DÉVELOPPEMENT et uniquement si Entra ID n'est pas encore configuré,
 *    l'accès local est autorisé pour permettre de travailler avant la
 *    déclaration de l'application dans le tenant. Ce mode est signalé par un
 *    bandeau visible dans l'interface (`isDevBypass`).
 */

export interface AppUser {
  name: string
  email: string
  /** true quand la session est un accès de développement, sans Entra ID */
  isDevBypass: boolean
}

const IS_DEV = process.env.NODE_ENV === 'development'

/**
 * Acces local admis sans authentification : soit en developpement, soit sur un
 * poste ou l'application a ete lancee explicitement en mode local (voir
 * `isLocalNoAuth`). Dans tous les autres cas, l'authentification est exigee.
 */
const ACCES_LOCAL = IS_DEV || isLocalNoAuth

function emailDomainAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return Boolean(domain) && serverEnv.auth.allowedDomains.includes(domain!)
}

/** Exige une session valide, sinon redirige vers /login. */
export async function requireUser(): Promise<AppUser> {
  if (!isAuthConfigured) {
    if (ACCES_LOCAL) {
      return {
        name: 'Accès local',
        email: 'dev@localhost',
        isDevBypass: true,
      }
    }
    // En production, une configuration incomplète = accès refusé.
    redirect('/login?error=Configuration')
  }

  const session = await auth()
  const email = session?.user?.email

  if (!email) redirect('/login')
  if (!emailDomainAllowed(email)) redirect('/login?error=AccessDenied')

  return {
    name: session?.user?.name ?? email,
    email,
    isDevBypass: false,
  }
}

/**
 * Variante pour les routes API : renvoie un code plutôt qu'une redirection,
 * afin de distinguer 401 (non authentifié) et 403 (hors domaine autorisé).
 */
export async function checkApiAccess(): Promise<
  { ok: true; user: AppUser } | { ok: false; status: 401 | 403; message: string }
> {
  if (!isAuthConfigured) {
    if (ACCES_LOCAL) {
      return {
        ok: true,
        user: { name: 'Accès local', email: 'local@poste', isDevBypass: true },
      }
    }
    return {
      ok: false,
      status: 401,
      message: 'Authentification non configurée sur ce serveur.',
    }
  }

  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    return { ok: false, status: 401, message: 'Authentification requise.' }
  }
  if (!emailDomainAllowed(email)) {
    return {
      ok: false,
      status: 403,
      message: 'Ce compte n’appartient pas à un domaine autorisé.',
    }
  }

  return {
    ok: true,
    user: { name: session?.user?.name ?? email, email, isDevBypass: false },
  }
}
