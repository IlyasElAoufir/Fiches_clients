/**
 * Environnements exposés par l'application.
 *
 * Novamap exploite quatre serveurs SQL (prod1, int, form1, dev). Seuls PROD et
 * INT sont exposés : c'est une liste blanche, pas un filtre d'affichage. Un
 * identifiant d'environnement reçu d'une URL est validé contre ce tableau
 * avant toute connexion (voir `isEnvId`).
 */
export const ENVIRONMENTS = [
  {
    id: 'PROD',
    label: 'Production',
    shortLabel: 'PROD',
    /** Valeurs de NOVA_CLIENT.CTL_TYPE_ENVIRONEMENT rattachées à cet environnement. */
    dbTypes: ['PROD'],
    tone: 'danger',
  },
  {
    id: 'INT',
    label: 'Intégration',
    shortLabel: 'INT',
    dbTypes: ['INT'],
    tone: 'info',
  },
] as const

export type EnvId = (typeof ENVIRONMENTS)[number]['id']

export const DEFAULT_ENV: EnvId = 'PROD'

const ENV_IDS = new Set<string>(ENVIRONMENTS.map((e) => e.id))

/** Garde de type : valide une valeur venue de l'extérieur (URL, query, form). */
export function isEnvId(value: unknown): value is EnvId {
  return typeof value === 'string' && ENV_IDS.has(value)
}

/** Normalise une valeur externe, en repliant sur PROD si elle est invalide. */
export function parseEnvId(value: unknown): EnvId {
  return isEnvId(value) ? value : DEFAULT_ENV
}

export function getEnvironment(id: EnvId) {
  return ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0]
}
