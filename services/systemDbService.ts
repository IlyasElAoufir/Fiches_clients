import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import { readSystem } from '@/lib/db'
import { isEnvId, type EnvId } from '@/config/environments'
import { DB_MAPPING_OVERRIDES } from '@/config/client-mapping'
import type { ClientInstance, ClientModule } from '@/types'

/**
 * Accès à NovamapSystemDB.
 *
 * NovamapSystemDB n'existe que sur le serveur de production : elle est commune a tous
 * les environnements (vérifié en phase d'analyse — le login fonctionne sur
 * le serveur d'integration mais la base n'y est pas). `readSystem` cible donc toujours
 * le serveur de production.
 */

// ---------------------------------------------------------------------------
// Résolution client → base
// ---------------------------------------------------------------------------

/**
 * CLT_LI_DB_CONNECTION est chiffrée pour ~2/3 des clients (256 ou 280
 * caractères, alphabet base64, aucun séparateur) : la vue VW_NOVA_CLIENT_BASE
 * ne résout que les chaînes restées en clair.
 *
 * On complète avec DASHBOARD_CLIENT, qui porte le couple IdClient →
 * DatabaseName. Sur leur intersection les deux sources ne divergent jamais
 * (vérifié : 0 désaccord sur 236 clients), ce qui rend le croisement sûr.
 *
 * Ce qui reste non résolu passe par DB_MAPPING_OVERRIDES — un mapping
 * explicite, jamais une déduction.
 */
const CLIENTS_QUERY = `
WITH derniers_snapshots AS (
    SELECT d.IdClient, d.DatabaseName, d.SQLServers,
           ROW_NUMBER() OVER (PARTITION BY d.IdClient ORDER BY d.Date DESC) AS rang
    FROM DASHBOARD_CLIENT d
    WHERE d.IdClient IS NOT NULL
      AND d.DatabaseName IS NOT NULL
),
agents_par_client AS (
    SELECT CLT_ID_CLIENT, COUNT(*) AS nb_agents
    FROM NOVA_AGENT_CLIENT
    GROUP BY CLT_ID_CLIENT
)
SELECT  c.CLT_ID_CLIENT                       AS id,
        c.CLT_LI_NOM_CLIENT                   AS name,
        c.AGT_CO_AGENT_PREFIX                 AS code,
        c.CTL_TYPE_ENVIRONEMENT               AS env,
        c.ORG_ID_ORGANISATION                 AS organisationId,
        c.CLT_NB_USER                         AS userQuota,
        CASE WHEN c.CLT_BIN_ICON_CLIENT IS NULL THEN 0 ELSE 1 END AS hasIcon,
        v.base                                AS dbFromView,
        s.DatabaseName                        AS dbFromDashboard,
        COALESCE(a.nb_agents, 0)              AS agentCount
FROM        NOVA_CLIENT c
LEFT JOIN   VW_NOVA_CLIENT_BASE v ON v.CLT_ID_CLIENT = c.CLT_ID_CLIENT
LEFT JOIN   derniers_snapshots s  ON s.IdClient = c.CLT_ID_CLIENT AND s.rang = 1
LEFT JOIN   agents_par_client a   ON a.CLT_ID_CLIENT = c.CLT_ID_CLIENT
WHERE       c.CTL_TYPE_ENVIRONEMENT IN ('PROD', 'INT')
`

interface ClientRow {
  id: number
  name: string
  code: string | null
  env: string
  organisationId: number | null
  userQuota: number | null
  hasIcon: number
  dbFromView: string | null
  dbFromDashboard: string | null
  agentCount: number
}

/**
 * Toutes les instances client des environnements exposés.
 *
 * Double niveau de cache, volontairement au niveau des DONNÉES et non des
 * pages : les pages restent dynamiques pour que le contrôle d'accès soit
 * réévalué à chaque requête, jamais servi depuis un cache.
 *
 *  - `unstable_cache` : cache partagé entre requêtes, 2 minutes. Le parc
 *    client change rarement, inutile d'interroger la base système à chaque
 *    affichage.
 *  - `cache` (React) : déduplique les appels pendant le rendu d'une même page.
 */
const loadClientInstances = unstable_cache(
  async (): Promise<ClientInstance[]> => {
    const rows = await readSystem<ClientRow>(CLIENTS_QUERY)

    return rows
      .filter((row) => isEnvId(row.env) && row.code)
      .map((row) => {
        const override = DB_MAPPING_OVERRIDES[row.id]
        const database = row.dbFromView ?? row.dbFromDashboard ?? override ?? null

        const databaseSource: ClientInstance['databaseSource'] = row.dbFromView
          ? 'view'
          : row.dbFromDashboard
            ? 'dashboard'
            : override
              ? 'mapping'
              : null

        return {
          id: row.id,
          name: row.name.trim(),
          code: (row.code ?? '').trim().toUpperCase(),
          env: row.env as EnvId,
          database,
          databaseSource,
          organisationId: row.organisationId,
          hasIcon: row.hasIcon === 1,
          userQuota: row.userQuota,
          agentCount: row.agentCount,
        } satisfies ClientInstance
      })
  },
  ['nova-client-instances'],
  { revalidate: 120, tags: ['clients'] },
)

export const getClientInstances = cache(
  (): Promise<ClientInstance[]> => loadClientInstances(),
)

/**
 * Résout la base d'un client À PARTIR DE LA BASE SYSTÈME, jamais depuis
 * l'URL. C'est le point de passage obligé avant toute connexion à une base
 * client : une requête qui fournirait `?database=xxx` n'a aucun effet.
 */
export async function resolveClientDatabase(
  clientId: number,
  env: EnvId,
): Promise<{ database: string; instance: ClientInstance } | null> {
  const instances = await getClientInstances()
  const instance = instances.find((i) => i.id === clientId && i.env === env)
  if (!instance?.database) return null
  return { database: instance.database, instance }
}

// ---------------------------------------------------------------------------
// Icône client
// ---------------------------------------------------------------------------

/** Logo stocké dans NOVA_CLIENT.CLT_BIN_ICON_CLIENT (type `image`). */
export async function getClientIcon(clientId: number): Promise<Buffer | null> {
  const rows = await readSystem<{ icon: Buffer | null }>(
    `SELECT CLT_BIN_ICON_CLIENT AS icon
     FROM NOVA_CLIENT
     WHERE CLT_ID_CLIENT = @clientId`,
    { clientId },
  )
  const icon = rows[0]?.icon
  return icon && icon.length > 0 ? icon : null
}

// ---------------------------------------------------------------------------
// Modules activés
// ---------------------------------------------------------------------------

/**
 * Modules réellement activés, depuis NOVA_MODULE_CLIENT.
 * C'est la source fiable : la section « Applications & modules » de l'Excel
 * n'est presque jamais renseignée (198 cellules contiennent encore le
 * gabarit « Oui/Non »).
 */
export async function getClientModules(clientId: number): Promise<ClientModule[]> {
  const rows = await readSystem<{
    code: string
    label: string
    domain: string | null
  }>(
    `SELECT  m.MOD_CO_MODULE             AS code,
             m.MOD_LI_MODULE             AS label,
             da.DAC_LI_DOMAINE_ACTIVITE  AS domain
     FROM      NOVA_MODULE_CLIENT mc
     JOIN      NOVA_MODULE m ON m.MOD_ID_MODULE = mc.MOD_ID_MODULE
     LEFT JOIN NOVA_DOMAINE_ACTIVITE da
            ON da.DAC_ID_DOMAINE_ACTIVITE = m.DAC_ID_DOMAINE_ACTIVITE
     WHERE   mc.CLT_ID_CLIENT = @clientId
       -- MCLT_DT_FIN borne l'abonnement au module : on ne garde que l'actif.
       AND   mc.MCLT_DT_FIN > GETDATE()
     ORDER BY da.DAC_LI_DOMAINE_ACTIVITE, m.MOD_LI_MODULE`,
    { clientId },
  )
  return rows.map((r) => ({
    code: r.code?.trim() ?? '',
    label: r.label?.trim() || r.code?.trim() || '—',
    domain: r.domain?.trim() ?? null,
    active: true,
  }))
}
