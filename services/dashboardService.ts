import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import { readSystem } from '@/lib/db'
import { getClientDbSnapshot } from '@/services/clientDbService'
import { resolveClientDatabase } from '@/services/systemDbService'
import type { EnvId } from '@/config/environments'
import type { ClientDashboard, DashboardHistoryPoint } from '@/types'

/**
 * Tableau de bord d'un client.
 *
 * Deux sources, volontairement séparées :
 *
 *  - Les CHIFFRES DE TÊTE viennent de la base du client, calculés en direct.
 *    Chaque KPI porte sa requête exacte : c'est la règle du projet, on
 *    n'affiche que ce qu'on peut expliquer.
 *
 *  - Les COURBES viennent de DASHBOARD_CLIENT, une table de snapshots
 *    mensuels alimentée par un job Novamap (juillet 2023 → aujourd'hui).
 *    On l'utilise pour l'évolution, et pour le tableau de bord global qui
 *    couvrirait sinon 50 bases.
 *
 * Controle de coherence effectue en phase d'analyse : sur la base pilote, le
 * calcul direct donne 1 302 059 équipements contre 1 301 100 au snapshot du
 * 31/08 — soit 0,07 % d'écart, imputable à la date. Les deux sources se
 * valident mutuellement.
 *
 * En revanche NbLot et NbBloc de DASHBOARD_CLIENT n'ont pas de définition
 * retrouvable : ils ne sont pas exposés.
 */

interface HistoryRow {
  Date: Date
  NbUser: number | null
  NbCnx: number | null
  NbEquipement: number | null
  NbBloc: number | null
  NbLot: number | null
  NbTenant: number | null
  NbRCL: number | null
}

const HISTORY_QUERY = `
SELECT TOP (24)
        Date, NbUser, NbCnx, NbEquipement, NbBloc, NbLot, NbTenant, NbRCL
FROM    DASHBOARD_CLIENT
WHERE   DatabaseName = @database
ORDER BY Date DESC`

export async function getClientHistory(
  database: string,
): Promise<DashboardHistoryPoint[]> {
  const rows = await readSystem<HistoryRow>(HISTORY_QUERY, { database })

  return rows
    .map((r) => ({
      date: new Date(r.Date).toISOString().slice(0, 10),
      users: r.NbUser,
      connections: r.NbCnx,
      equipment: r.NbEquipement,
      blocks: r.NbBloc,
      lots: r.NbLot,
      tenants: r.NbTenant,
      claims: r.NbRCL,
    }))
    .reverse() // chronologique pour les graphiques
}

export async function getClientDashboard(
  clientId: number,
  env: EnvId,
): Promise<ClientDashboard> {
  const resolved = await resolveClientDatabase(clientId, env)

  if (!resolved) {
    return {
      kpis: [],
      equipmentByType: [],
      patrimony: [],
      history: [],
      liveDataAvailable: false,
      liveDataError:
        'La base de ce client n’a pas pu être résolue depuis NovamapSystemDB.',
    }
  }

  const [snapshot, history] = await Promise.all([
    getClientDbSnapshot(env, resolved.database),
    getClientHistory(resolved.database),
  ])

  return {
    kpis: snapshot.kpis,
    equipmentByType: snapshot.equipmentByType,
    patrimony: snapshot.patrimony,
    history,
    liveDataAvailable: snapshot.available,
    liveDataError: snapshot.error,
  }
}

// ---------------------------------------------------------------------------
// Tableau de bord global
// ---------------------------------------------------------------------------

/**
 * Agrégat global lu UNIQUEMENT depuis DASHBOARD_CLIENT.
 *
 * Interroger les 50 bases clients à chaque chargement serait à la fois lent
 * et inutilement coûteux pour la production. On lit le dernier snapshot de
 * chaque base, en une seule requête sur la base système.
 */
const GLOBAL_QUERY = `
WITH derniers AS (
    SELECT  d.DatabaseName, d.IdClient, d.NbUser, d.NbEquipement,
            d.NbTenant, d.Date,
            ROW_NUMBER() OVER (PARTITION BY d.IdClient ORDER BY d.Date DESC) AS rang
    FROM    DASHBOARD_CLIENT d
    JOIN    NOVA_CLIENT c ON c.CLT_ID_CLIENT = d.IdClient
    WHERE   d.IdClient IS NOT NULL
      AND   c.CTL_TYPE_ENVIRONEMENT = 'PROD'
)
SELECT  COUNT(*)              AS clients,
        SUM(NbEquipement)     AS equipements,
        SUM(NbTenant)         AS locataires,
        MAX(Date)             AS derniereDate
FROM    derniers
WHERE   rang = 1`

const loadGlobalStats = unstable_cache(
  async (): Promise<{
    clients: number
    equipements: number
    locataires: number
    utilisateurs: number
    derniereDate: string | null
  }> => {
    const [aggregate, users] = await Promise.all([
      readSystem<{
        clients: number
        equipements: number
        locataires: number
        derniereDate: Date | null
      }>(GLOBAL_QUERY),
      // Les utilisateurs viennent de la source vivante : c'est instantané.
      readSystem<{ total: number }>(
        `SELECT COUNT(DISTINCT ac.AGT_CO_AGENT) AS total
         FROM   NOVA_AGENT_CLIENT ac
         JOIN   NOVA_CLIENT c ON c.CLT_ID_CLIENT = ac.CLT_ID_CLIENT
         WHERE  c.CTL_TYPE_ENVIRONEMENT = 'PROD'`,
      ),
    ])

    const row = aggregate[0]
    return {
      clients: row?.clients ?? 0,
      equipements: row?.equipements ?? 0,
      locataires: row?.locataires ?? 0,
      utilisateurs: users[0]?.total ?? 0,
      derniereDate: row?.derniereDate
        ? new Date(row.derniereDate).toISOString().slice(0, 10)
        : null,
    }
  },
  ['nova-global-stats'],
  { revalidate: 600, tags: ['dashboard'] },
)

export const getGlobalStats = cache(() => loadGlobalStats())
