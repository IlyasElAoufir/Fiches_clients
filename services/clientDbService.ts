import 'server-only'

import { readQuerySafe } from '@/lib/db'
import type { EnvId } from '@/config/environments'
import type { Kpi, NamedCount } from '@/types'

/**
 * Lecture des bases clients.
 *
 * Le nom de base reçu ici a TOUJOURS été résolu au préalable par
 * `resolveClientDatabase` à partir de NovamapSystemDB. Aucune fonction de ce
 * module n'accepte un nom de base venu d'une URL ou d'un paramètre client.
 *
 * Le schéma métier a été vérifié comme identique sur 12 bases de production
 * (verification menee sur 12 bases de production couvrant les deux formats
 * de nommage) : les requetes ci-dessous sont portables.
 *
 * Toutes les lectures passent par `readQuerySafe` : si une base client est
 * hors ligne, la page reste affichable et signale l'indisponibilité.
 */

/**
 * Hiérarchie patrimoniale, portée par BLOC.BLC_TYPE_BLOC :
 *   SOC société · RES résidence · BAT bâtiment · ENT entrée/cage
 *   LOG logement · TEC local technique · NIV niveau (certains clients)
 *
 * BLOC est une table temporelle système-versionnée (ValidFrom/ValidTo), mais
 * la validité MÉTIER est BLC_DT_FIN — c'est celle qu'il faut filtrer.
 * La sentinelle « pas de fin » est 2090-12-31.
 */
const PATRIMONY_QUERY = `
SELECT  BLC_TYPE_BLOC AS type,
        COUNT(*)      AS total
FROM    BLOC
WHERE   BLC_DT_FIN > GETDATE()
GROUP BY BLC_TYPE_BLOC`

const EQUIPMENT_QUERY = `
SELECT  COUNT(*) AS total
FROM    EQUIPEMENT
WHERE   EQPT_VF_ACTIF = 1
  AND   EQPT_VF_SYSTEME = 0`

const EQUIPMENT_BY_TYPE_QUERY = `
SELECT TOP (12)
        et.EQT_LI_EQUIPEMENT AS name,
        COUNT(*)             AS value
FROM    EQUIPEMENT e
JOIN    EQUIPEMENT_TYPE et ON et.ID_EQUIPEMENT_TYPE = e.ID_EQUIPEMENT_TYPE
WHERE   e.EQPT_VF_ACTIF = 1
  AND   e.EQPT_VF_SYSTEME = 0
GROUP BY et.EQT_LI_EQUIPEMENT
ORDER BY COUNT(*) DESC`

const TENANTS_QUERY = `SELECT COUNT(*) AS total FROM GMP_LOCATAIRE`

const CLAIMS_QUERY = `
SELECT  COUNT(*) AS total,
        SUM(CASE WHEN DT_CREATION >= DATEADD(month, -12, GETDATE())
                 THEN 1 ELSE 0 END) AS last12Months
FROM    GMP_RECLAMATION`

const BLOC_LABELS: Record<string, string> = {
  SOC: 'Sociétés',
  RES: 'Résidences',
  BAT: 'Bâtiments',
  ENT: 'Entrées',
  NIV: 'Niveaux',
  LOG: 'Logements',
  TEC: 'Locaux techniques',
}

/** Ordre d'affichage : du plus englobant au plus fin. */
const BLOC_ORDER = ['RES', 'BAT', 'ENT', 'NIV', 'LOG', 'TEC']

export interface ClientDbSnapshot {
  kpis: Kpi[]
  patrimony: NamedCount[]
  equipmentByType: NamedCount[]
  available: boolean
  error?: string
}

export async function getClientDbSnapshot(
  env: EnvId,
  database: string,
): Promise<ClientDbSnapshot> {
  // Les quatre lectures sont indépendantes : on les lance en parallèle.
  const [patrimonyRes, equipmentRes, equipmentTypesRes, tenantsRes, claimsRes] =
    await Promise.all([
      readQuerySafe<{ type: string; total: number }>(env, database, PATRIMONY_QUERY),
      readQuerySafe<{ total: number }>(env, database, EQUIPMENT_QUERY),
      readQuerySafe<NamedCount>(env, database, EQUIPMENT_BY_TYPE_QUERY),
      readQuerySafe<{ total: number }>(env, database, TENANTS_QUERY),
      readQuerySafe<{ total: number; last12Months: number }>(
        env,
        database,
        CLAIMS_QUERY,
      ),
    ])

  const available = patrimonyRes.ok
  const error = patrimonyRes.error ?? equipmentRes.error

  const byType = new Map(patrimonyRes.rows.map((r) => [r.type?.trim(), r.total]))
  const count = (type: string) => byType.get(type) ?? null

  const patrimony: NamedCount[] = BLOC_ORDER.filter((t) => byType.has(t)).map(
    (type) => ({ name: BLOC_LABELS[type] ?? type, value: byType.get(type) ?? 0 }),
  )

  const kpis: Kpi[] = [
    {
      key: 'residences',
      label: 'Résidences',
      value: count('RES'),
      source: "BLOC · BLC_TYPE_BLOC = 'RES' · BLC_DT_FIN > maintenant",
    },
    {
      key: 'batiments',
      label: 'Bâtiments',
      value: count('BAT'),
      source: "BLOC · BLC_TYPE_BLOC = 'BAT' · BLC_DT_FIN > maintenant",
    },
    {
      key: 'logements',
      label: 'Logements',
      value: count('LOG'),
      source: "BLOC · BLC_TYPE_BLOC = 'LOG' · BLC_DT_FIN > maintenant",
    },
    {
      key: 'equipements',
      label: 'Équipements',
      value: equipmentRes.rows[0]?.total ?? null,
      source: 'EQUIPEMENT · EQPT_VF_ACTIF = 1 · EQPT_VF_SYSTEME = 0',
      note: 'Équipements actifs, hors équipements système',
    },
    {
      key: 'locataires',
      label: 'Fiches locataires',
      value: tenantsRes.rows[0]?.total ?? null,
      source: 'GMP_LOCATAIRE · COUNT(*)',
      note: 'Historique inclus — la table ne porte pas d’indicateur d’occupation',
    },
    {
      key: 'reclamations',
      label: 'Réclamations (12 mois)',
      value: claimsRes.rows[0]?.last12Months ?? null,
      source: 'GMP_RECLAMATION · DT_CREATION ≥ il y a 12 mois',
    },
  ]

  return {
    kpis,
    patrimony,
    equipmentByType: equipmentTypesRes.rows.map((r) => ({
      name: r.name?.trim() || '—',
      value: r.value,
    })),
    available,
    error,
  }
}
