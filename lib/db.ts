import 'server-only'
import sql from 'mssql'

import { serverEnv } from '@/config/env'
import { isEnvId, type EnvId } from '@/config/environments'

/**
 * =========================================================================
 * COUCHE SQL CENTRALISÉE — LECTURE SEULE
 * =========================================================================
 *
 * Règles appliquées ici, et nulle part ailleurs dans l'application :
 *
 *  1. Toute requête passe par `readQuery()`, qui refuse tout ce qui n'est pas
 *     une lecture (`assertReadOnly`). Il n'existe aucune autre fonction
 *     d'exécution exportée.
 *  2. Les paramètres utilisateur sont TOUJOURS liés via `request.input()`.
 *     Aucune concaténation de valeur dans le SQL.
 *  3. Le nom de base n'arrive jamais brut de l'extérieur : il est validé par
 *     `assertSafeDatabaseName` ET doit avoir été résolu au préalable depuis
 *     NOVA_CLIENT / DASHBOARD_CLIENT (voir services/clientService).
 *  4. Un pool par couple (serveur, base), réutilisé entre les requêtes.
 *
 * Il n'existe volontairement aucune route API acceptant du SQL. Toutes les
 * requêtes sont écrites en dur dans `services/`.
 */

// ---------------------------------------------------------------------------
// Garde-fou lecture seule
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|DBCC|SHUTDOWN|KILL|RECONFIGURE|WAITFOR)\b/i

/** `SELECT ... INTO table` crée une table : interdit, contrairement aux CTE. */
const SELECT_INTO = /\bINTO\s+[#@[\w]/i

export class ReadOnlyViolationError extends Error {
  constructor(reason: string) {
    super(`Requête refusée par la couche lecture seule : ${reason}`)
    this.name = 'ReadOnlyViolationError'
  }
}

/**
 * Refuse toute requête qui n'est pas une lecture pure.
 * Filet de sécurité : les requêtes sont déjà écrites en dur dans `services/`,
 * mais une erreur d'écriture de code ne doit jamais pouvoir modifier la base.
 */
export function assertReadOnly(query: string): void {
  const stripped = query
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()

  const firstWord = stripped.replace(/^\(+/, '').split(/\s+/)[0]?.toUpperCase()
  if (firstWord !== 'SELECT' && firstWord !== 'WITH') {
    throw new ReadOnlyViolationError(
      `doit commencer par SELECT ou WITH (reçu « ${firstWord ?? '∅'} »)`,
    )
  }

  const forbidden = FORBIDDEN_KEYWORDS.exec(stripped)
  if (forbidden) {
    throw new ReadOnlyViolationError(`mot-clé interdit « ${forbidden[0]} »`)
  }

  if (SELECT_INTO.test(stripped)) {
    throw new ReadOnlyViolationError('SELECT ... INTO crée un objet')
  }
}

// ---------------------------------------------------------------------------
// Validation du nom de base
// ---------------------------------------------------------------------------

/**
 * Les bases Novamap portent des noms de fantaisie (`<nom>`, `<nom>-int`,
 * `vince-int_SI-GTP`, `NovamapSharedDB`. On accepte lettres, chiffres, tiret,
 * underscore et point — jamais de crochet, guillemet, espace ou point-virgule.
 */
const SAFE_DB_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,126}$/

export function assertSafeDatabaseName(name: string): string {
  if (!SAFE_DB_NAME.test(name)) {
    throw new ReadOnlyViolationError(`nom de base invalide « ${name} »`)
  }
  return name
}

// ---------------------------------------------------------------------------
// Pools de connexions
// ---------------------------------------------------------------------------

type PoolKey = `${EnvId}::${string}`

const pools = new Map<PoolKey, Promise<sql.ConnectionPool>>()

function baseConfig(server: string, database: string): sql.config {
  return {
    server,
    database,
    user: serverEnv.sql.user,
    password: serverEnv.sql.password,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
      // Azure SQL : on ne veut pas d'attente illimitée si une base est froide.
      requestTimeout: 20_000,
      connectTimeout: 15_000,
    },
    pool: {
      max: 8,
      min: 0,
      idleTimeoutMillis: 60_000,
    },
  }
}

function serverFor(env: EnvId): string {
  if (!isEnvId(env)) {
    throw new ReadOnlyViolationError(`environnement inconnu « ${env} »`)
  }
  return serverEnv.sql.servers[env]
}

async function getPool(env: EnvId, database: string): Promise<sql.ConnectionPool> {
  const db = assertSafeDatabaseName(database)
  const key: PoolKey = `${env}::${db}`

  const existing = pools.get(key)
  if (existing) {
    try {
      const pool = await existing
      if (pool.connected || pool.connecting) return pool
    } catch {
      // Pool en erreur : on le jette et on retente une connexion propre.
    }
    pools.delete(key)
  }

  const created = new sql.ConnectionPool(baseConfig(serverFor(env), db))
    .connect()
    .catch((err: unknown) => {
      pools.delete(key)
      throw err
    })

  pools.set(key, created)
  return created
}

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

export type SqlParams = Record<string, string | number | boolean | Date | null>

export class DatabaseUnavailableError extends Error {
  constructor(
    readonly database: string,
    readonly cause: unknown,
  ) {
    super(`Base « ${database} » indisponible`)
    this.name = 'DatabaseUnavailableError'
  }
}

/**
 * Exécute une requête de LECTURE. Seule voie d'accès à SQL de l'application.
 *
 * @param env       Environnement (validé contre la liste blanche).
 * @param database  Nom de base déjà résolu côté serveur.
 * @param query     SQL écrit en dur dans `services/` — jamais reçu du client.
 * @param params    Valeurs liées, jamais concaténées.
 */
export async function readQuery<T = Record<string, unknown>>(
  env: EnvId,
  database: string,
  query: string,
  params: SqlParams = {},
): Promise<T[]> {
  assertReadOnly(query)

  const pool = await getPool(env, database)
  const request = pool.request()

  for (const [name, value] of Object.entries(params)) {
    request.input(name, value)
  }

  const result = await request.query<T>(query)
  return result.recordset ?? []
}

/**
 * Variante tolérante : renvoie `fallback` si la base est injoignable plutôt
 * que de faire échouer toute la page. Utilisée pour les KPI d'une base client,
 * qui peut être hors ligne sans que la fiche devienne inaccessible.
 */
export async function readQuerySafe<T = Record<string, unknown>>(
  env: EnvId,
  database: string,
  query: string,
  params: SqlParams = {},
  fallback: T[] = [],
): Promise<{ rows: T[]; ok: boolean; error?: string }> {
  try {
    const rows = await readQuery<T>(env, database, query, params)
    return { rows, ok: true }
  } catch (error) {
    if (error instanceof ReadOnlyViolationError) throw error // jamais silencieux
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[db] Lecture impossible sur ${env}/${database} : ${message}`)
    return { rows: fallback, ok: false, error: message }
  }
}

/** Requête sur la base système (toujours sur le serveur de production). */
export function readSystem<T = Record<string, unknown>>(
  query: string,
  params: SqlParams = {},
): Promise<T[]> {
  return readQuery<T>('PROD', serverEnv.sql.systemDatabase, query, params)
}
