import 'server-only'

import { readSystem } from '@/lib/db'
import type { ClientUser, PagedResult } from '@/types'

/**
 * Utilisateurs d'un client : NOVA_AGENT_CLIENT ⋈ NOVA_AGENT.
 *
 * Recherche, tri et pagination sont exécutés CÔTÉ SQL : certains clients ont
 * plus de 1 000 agents, et la base en compte 19 830 au total. On ne rapatrie
 * jamais l'ensemble pour filtrer en mémoire.
 *
 * Le tri n'est jamais interpolé depuis l'entrée utilisateur : la colonne est
 * choisie dans une liste blanche (`ORDER_BY`), et seul un identifiant validé
 * y donne accès.
 */

export type UserSortKey =
  | 'name'
  | 'login'
  | 'email'
  | 'lastConnect'
  | 'status'

export type UserStatusFilter = 'all' | 'active' | 'inactive'

/**
 * Liste blanche des tris. Les valeurs sont des fragments SQL constants
 * définis ici, jamais construits à partir d'une entrée externe.
 */
const ORDER_BY: Record<UserSortKey, string> = {
  name: 'a.AGT_NOM_AGT, a.AGT_PRENOM_AGT',
  login: 'a.AGT_CO_AGENT',
  email: 'a.AGT_MAIL_AGT',
  lastConnect: 'ac.AGT_DT_LAST_CONNECT DESC',
  status: 'a.AGT_DT_FIN DESC',
}

function orderClause(sort: string | undefined, direction: string | undefined): string {
  const key = (sort ?? 'name') as UserSortKey
  const column = ORDER_BY[key] ?? ORDER_BY.name
  // La direction est appliquée uniquement aux tris simples ; lastConnect et
  // status portent déjà leur sens.
  if (key === 'lastConnect' || key === 'status') return column
  return direction === 'desc' ? `${column} DESC` : column
}

/**
 * Un agent est actif si sa date de fin est absente ou future.
 * AGT_ISALLOW n'est pas utilisable : il vaut 0 pour 485 des 498 agents
 * du client pilote, y compris pour des comptes connectes la veille.
 */
const ACTIVE_PREDICATE = '(a.AGT_DT_FIN IS NULL OR a.AGT_DT_FIN > GETDATE())'

interface UserRow {
  login: string
  lastName: string
  firstName: string
  email: string
  phone: string | null
  mobile: string | null
  endDate: Date | null
  lastConnect: Date | null
  isNovaAccount: boolean
  isFederated: number
  permissionCount: number
  totalRows: number
}

export interface GetClientUsersOptions {
  clientId: number
  search?: string
  status?: UserStatusFilter
  sort?: string
  direction?: string
  page?: number
  pageSize?: number
}

export async function getClientUsers(
  options: GetClientUsersOptions,
): Promise<PagedResult<ClientUser>> {
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const pageSize = Math.min(200, Math.max(10, Math.floor(options.pageSize ?? 25)))
  const search = (options.search ?? '').trim()
  const status: UserStatusFilter = options.status ?? 'all'

  const statusFilter =
    status === 'active'
      ? `AND ${ACTIVE_PREDICATE}`
      : status === 'inactive'
        ? `AND NOT ${ACTIVE_PREDICATE}`
        : ''

  // @search est lié en paramètre : aucune concaténation de la saisie.
  const searchFilter = search
    ? `AND (a.AGT_NOM_AGT   LIKE @search
        OR a.AGT_PRENOM_AGT LIKE @search
        OR a.AGT_MAIL_AGT   LIKE @search
        OR a.AGT_CO_AGENT   LIKE @search)`
    : ''

  const query = `
SELECT  a.AGT_CO_AGENT        AS login,
        a.AGT_NOM_AGT         AS lastName,
        a.AGT_PRENOM_AGT      AS firstName,
        a.AGT_MAIL_AGT        AS email,
        a.AGT_TEL_AGT         AS phone,
        a.AGT_MOB_AGT         AS mobile,
        a.AGT_DT_FIN          AS endDate,
        ac.AGT_DT_LAST_CONNECT AS lastConnect,
        a.AGT_IS_NOVA_ACCOUNT AS isNovaAccount,
        CASE WHEN a.AGT_AD_OBJECTID IS NULL THEN 0 ELSE 1 END AS isFederated,
        (SELECT COUNT(*)
           FROM NOVA_GROUP_MEMBER gm
          WHERE gm.AGT_CO_AGENT = a.AGT_CO_AGENT
            AND gm.GRP_IS_GRANTED = 1)                  AS permissionCount,
        COUNT(*) OVER ()                                AS totalRows
FROM    NOVA_AGENT_CLIENT ac
JOIN    NOVA_AGENT a ON a.AGT_CO_AGENT = ac.AGT_CO_AGENT
WHERE   ac.CLT_ID_CLIENT = @clientId
        ${statusFilter}
        ${searchFilter}
ORDER BY ${orderClause(options.sort, options.direction)}
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`

  const rows = await readSystem<UserRow>(query, {
    clientId: options.clientId,
    offset: (page - 1) * pageSize,
    pageSize,
    ...(search ? { search: `%${search}%` } : {}),
  })

  const now = Date.now()

  return {
    rows: rows.map((r) => ({
      login: r.login?.trim() ?? '',
      lastName: r.lastName?.trim() ?? '',
      firstName: r.firstName?.trim() === '.' ? '' : (r.firstName?.trim() ?? ''),
      email: r.email?.trim() ?? '',
      phone: r.phone?.trim() || null,
      mobile: r.mobile?.trim() || null,
      isActive: !r.endDate || new Date(r.endDate).getTime() > now,
      endDate: r.endDate ? new Date(r.endDate).toISOString() : null,
      lastConnect: r.lastConnect ? new Date(r.lastConnect).toISOString() : null,
      isNovaAccount: Boolean(r.isNovaAccount),
      isFederated: r.isFederated === 1,
      permissionCount: r.permissionCount ?? 0,
    })),
    total: rows[0]?.totalRows ?? 0,
    page,
    pageSize,
  }
}

/** Compteurs affichés en tête de l'onglet Utilisateurs. */
export async function getClientUserStats(clientId: number): Promise<{
  total: number
  active: number
  connectedLast3Months: number
  federated: number
}> {
  const rows = await readSystem<{
    total: number
    active: number
    connectedLast3Months: number
    federated: number
  }>(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN ${ACTIVE_PREDICATE} THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN ac.AGT_DT_LAST_CONNECT >= DATEADD(month, -3, GETDATE())
                 THEN 1 ELSE 0 END) AS connectedLast3Months,
        SUM(CASE WHEN a.AGT_AD_OBJECTID IS NULL THEN 0 ELSE 1 END) AS federated
     FROM   NOVA_AGENT_CLIENT ac
     JOIN   NOVA_AGENT a ON a.AGT_CO_AGENT = ac.AGT_CO_AGENT
     WHERE  ac.CLT_ID_CLIENT = @clientId`,
    { clientId },
  )

  return (
    rows[0] ?? { total: 0, active: 0, connectedLast3Months: 0, federated: 0 }
  )
}
