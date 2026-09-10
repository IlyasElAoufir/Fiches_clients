import 'server-only'

/**
 * Lecture et validation des variables d'environnement.
 *
 * Ce module est marqué `server-only` : toute tentative de l'importer depuis un
 * composant client provoque une erreur de build. Aucun secret ne peut donc
 * atterrir dans le bundle navigateur.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Copiez .env.example vers .env.local et renseignez-la.`,
    )
  }
  return value.trim()
}

function optional(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim()
}

export const serverEnv = {
  sql: {
    /** Serveurs autorisés, indexés par code d'environnement. */
    servers: {
      PROD: required('SQL_PROD_SERVER'),
      INT: required('SQL_INT_SERVER'),
    } as const,
    user: required('SQL_USER'),
    password: required('SQL_PASSWORD'),
    systemDatabase: optional('SQL_SYSTEM_DATABASE', 'NovamapSystemDB'),
  },

  auth: {
    clientId: optional('AZURE_AD_CLIENT_ID'),
    clientSecret: optional('AZURE_AD_CLIENT_SECRET'),
    tenantId: optional('AZURE_AD_TENANT_ID'),
    secret: optional('AUTH_SECRET'),
    /** Domaines e-mail autorisés, vérifiés côté serveur. */
    allowedDomains: optional('ALLOWED_EMAIL_DOMAINS', 'novamap.fr')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  },
} as const

/**
 * L'authentification Entra ID est-elle configurée ?
 * Permet de démarrer en local sans Azure AD tout en refusant l'accès en
 * production si la configuration est incomplète.
 */
export const isAuthConfigured =
  serverEnv.auth.clientId !== '' &&
  serverEnv.auth.clientSecret !== '' &&
  serverEnv.auth.tenantId !== ''

/**
 * Mode « poste local, sans authentification ».
 *
 * Destine a l'application lancee sur un poste par les raccourcis de `local/`.
 * En production, l'absence d'Entra ID fait normalement REFUSER l'acces ; ce
 * mode est la seule exception, et il est verrouille par trois conditions
 * cumulatives :
 *
 *   1. Entra ID n'est pas configure — des qu'il l'est, il reprend la main ;
 *   2. ACCES_LOCAL_SANS_AUTH vaut « 1 », choix explicite, jamais par defaut ;
 *   3. le serveur ecoute sur une adresse de boucle locale.
 *
 * La troisieme condition est la garantie de fond : une instance hebergee
 * ecoute sur 0.0.0.0 et ne peut donc pas activer ce mode, meme si la variable
 * traine dans sa configuration. Ne la definissez jamais sur un serveur.
 */
export const isLocalNoAuth = (() => {
  if (isAuthConfigured) return false
  if (optional('ACCES_LOCAL_SANS_AUTH') !== '1') return false
  const bind = optional('HOSTNAME').toLowerCase()
  return bind === '127.0.0.1' || bind === '::1' || bind === 'localhost'
})()

if (isLocalNoAuth) {
  console.warn(
    '[auth] Mode local sans authentification : ecoute restreinte a la boucle ' +
      'locale. A ne jamais activer sur un serveur.',
  )
}
